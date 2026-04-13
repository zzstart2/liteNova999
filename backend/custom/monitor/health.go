package monitor

import (
	"math"
	"sync"
	"time"
)

// T-008: Sliding window health metrics + Circuit breaker for channels

// --- Sliding Window ---

const (
	windowDuration = 5 * time.Minute
	bucketCount    = 10
	bucketDuration = windowDuration / bucketCount
	minSamples     = 5 // minimum requests before health score is meaningful
)

type bucket struct {
	requests  int64
	errors    int64
	timeouts  int64
	totalMs   int64
	maxMs     int64
	latencies []int64 // for P99 calculation
}

type SlidingWindow struct {
	mu      sync.RWMutex
	buckets [bucketCount]bucket
	current int
	lastTick time.Time
}

type WindowMetrics struct {
	RequestCount int64   `json:"request_count"`
	ErrorCount   int64   `json:"error_count"`
	TimeoutCount int64   `json:"timeout_count"`
	ErrorRate    float64 `json:"error_rate"`
	AvgLatencyMs float64 `json:"avg_latency_ms"`
	MaxLatencyMs int64   `json:"max_latency_ms"`
	P99LatencyMs int64   `json:"p99_latency_ms"`
	HealthScore  float64 `json:"health_score"` // 0-100
}

func newSlidingWindow() *SlidingWindow {
	return &SlidingWindow{
		lastTick: time.Now(),
	}
}

func (w *SlidingWindow) advance() {
	now := time.Now()
	elapsed := now.Sub(w.lastTick)
	ticks := int(elapsed / bucketDuration)
	if ticks <= 0 {
		return
	}
	if ticks >= bucketCount {
		// clear all buckets
		for i := range w.buckets {
			w.buckets[i] = bucket{}
		}
		w.current = 0
	} else {
		for i := 0; i < ticks; i++ {
			w.current = (w.current + 1) % bucketCount
			w.buckets[w.current] = bucket{}
		}
	}
	w.lastTick = now
}

func (w *SlidingWindow) Record(latencyMs int64, isError bool, isTimeout bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.advance()

	b := &w.buckets[w.current]
	b.requests++
	b.totalMs += latencyMs
	if latencyMs > b.maxMs {
		b.maxMs = latencyMs
	}
	b.latencies = append(b.latencies, latencyMs)
	if isError {
		b.errors++
	}
	if isTimeout {
		b.timeouts++
	}
}

func (w *SlidingWindow) GetMetrics() WindowMetrics {
	w.mu.RLock()
	defer w.mu.RUnlock()

	var m WindowMetrics
	var allLatencies []int64

	for i := range w.buckets {
		b := &w.buckets[i]
		m.RequestCount += b.requests
		m.ErrorCount += b.errors
		m.TimeoutCount += b.timeouts
		if b.maxMs > m.MaxLatencyMs {
			m.MaxLatencyMs = b.maxMs
		}
		allLatencies = append(allLatencies, b.latencies...)
	}

	if m.RequestCount > 0 {
		var totalMs int64
		for _, b := range w.buckets {
			totalMs += b.totalMs
		}
		m.ErrorRate = float64(m.ErrorCount) / float64(m.RequestCount)
		m.AvgLatencyMs = float64(totalMs) / float64(m.RequestCount)
	}

	// P99 calculation
	if len(allLatencies) > 0 {
		sortInt64s(allLatencies)
		idx := int(math.Ceil(float64(len(allLatencies))*0.99)) - 1
		if idx < 0 {
			idx = 0
		}
		m.P99LatencyMs = allLatencies[idx]
	}

	m.HealthScore = calculateHealthScore(m)
	return m
}

func calculateHealthScore(m WindowMetrics) float64 {
	if m.RequestCount < int64(minSamples) {
		return 100 // not enough data, assume healthy
	}

	// Error rate: 40 points (0% error = 40, 100% error = 0)
	errorScore := 40.0 * (1.0 - m.ErrorRate)

	// Latency (P99): 30 points (<500ms = 30, >5000ms = 0, linear)
	latencyScore := 30.0
	if m.P99LatencyMs > 500 {
		latencyScore = 30.0 * (1.0 - math.Min(float64(m.P99LatencyMs-500)/4500.0, 1.0))
	}

	// Timeout rate: 30 points (no timeouts = 30)
	timeoutRate := float64(m.TimeoutCount) / float64(m.RequestCount)
	timeoutScore := 30.0 * (1.0 - timeoutRate)

	score := errorScore + latencyScore + timeoutScore
	return math.Max(0, math.Min(100, score))
}

func sortInt64s(a []int64) {
	// simple insertion sort - window is small
	for i := 1; i < len(a); i++ {
		key := a[i]
		j := i - 1
		for j >= 0 && a[j] > key {
			a[j+1] = a[j]
			j--
		}
		a[j+1] = key
	}
}

// --- Circuit Breaker ---

type CircuitState int

const (
	CircuitClosed   CircuitState = iota // normal operation
	CircuitOpen                         // blocking requests
	CircuitHalfOpen                     // testing recovery
)

func (s CircuitState) String() string {
	switch s {
	case CircuitClosed:
		return "closed"
	case CircuitOpen:
		return "open"
	case CircuitHalfOpen:
		return "half_open"
	default:
		return "unknown"
	}
}

type CircuitBreaker struct {
	mu              sync.RWMutex
	state           CircuitState
	openedAt        time.Time
	halfOpenSuccesses int
	config          CircuitBreakerConfig
}

type CircuitBreakerConfig struct {
	ErrorThreshold  float64       // error rate to trigger open (default 0.5)
	MinRequests     int64         // minimum requests before checking (default 10)
	OpenDuration    time.Duration // how long to stay open (default 60s)
	HalfOpenMaxReqs int           // successful requests to close (default 3)
}

var DefaultCircuitConfig = CircuitBreakerConfig{
	ErrorThreshold:  0.5,
	MinRequests:     10,
	OpenDuration:    60 * time.Second,
	HalfOpenMaxReqs: 3,
}

type CircuitStatus struct {
	State       string    `json:"state"`
	OpenedAt    time.Time `json:"opened_at,omitempty"`
	RecoveryAt  time.Time `json:"recovery_at,omitempty"`
}

func newCircuitBreaker(cfg CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		state:  CircuitClosed,
		config: cfg,
	}
}

func (cb *CircuitBreaker) GetState() CircuitState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	if cb.state == CircuitOpen && time.Since(cb.openedAt) >= cb.config.OpenDuration {
		return CircuitHalfOpen // auto-transition
	}
	return cb.state
}

func (cb *CircuitBreaker) GetStatus() CircuitStatus {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	state := cb.state
	if state == CircuitOpen && time.Since(cb.openedAt) >= cb.config.OpenDuration {
		state = CircuitHalfOpen
	}

	status := CircuitStatus{State: state.String()}
	if state == CircuitOpen {
		status.OpenedAt = cb.openedAt
		status.RecoveryAt = cb.openedAt.Add(cb.config.OpenDuration)
	}
	return status
}

// RecordSuccess notifies the circuit breaker of a successful request
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitHalfOpen:
		cb.halfOpenSuccesses++
		if cb.halfOpenSuccesses >= cb.config.HalfOpenMaxReqs {
			cb.state = CircuitClosed
			cb.halfOpenSuccesses = 0
		}
	case CircuitOpen:
		// check for auto-transition
		if time.Since(cb.openedAt) >= cb.config.OpenDuration {
			cb.state = CircuitHalfOpen
			cb.halfOpenSuccesses = 1
		}
	}
}

// RecordFailure notifies the circuit breaker of a failed request
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitHalfOpen:
		// any failure in half-open → open again
		cb.state = CircuitOpen
		cb.openedAt = time.Now()
		cb.halfOpenSuccesses = 0
	}
	// Closed → Open transitions are driven by CheckMetrics
}

// CheckMetrics evaluates sliding window metrics and transitions state if needed
func (cb *CircuitBreaker) CheckMetrics(m WindowMetrics) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.state != CircuitClosed {
		return
	}
	if m.RequestCount < cb.config.MinRequests {
		return
	}
	if m.ErrorRate >= cb.config.ErrorThreshold {
		cb.state = CircuitOpen
		cb.openedAt = time.Now()
		cb.halfOpenSuccesses = 0
	}
}

// --- Channel Health Manager ---

type channelHealth struct {
	window  *SlidingWindow
	circuit *CircuitBreaker
}

var (
	healthStore   = make(map[int]*channelHealth)
	healthStoreMu sync.RWMutex
)

func getOrCreateHealth(channelId int) *channelHealth {
	healthStoreMu.RLock()
	h, ok := healthStore[channelId]
	healthStoreMu.RUnlock()
	if ok {
		return h
	}

	healthStoreMu.Lock()
	defer healthStoreMu.Unlock()
	// double-check
	if h, ok := healthStore[channelId]; ok {
		return h
	}
	h = &channelHealth{
		window:  newSlidingWindow(),
		circuit: newCircuitBreaker(DefaultCircuitConfig),
	}
	healthStore[channelId] = h
	return h
}

// RecordRequestHealth records a request result for health tracking.
// Called after each relay attempt.
func RecordRequestHealth(channelId int, latencyMs int64, isError bool, isTimeout bool) {
	h := getOrCreateHealth(channelId)
	h.window.Record(latencyMs, isError, isTimeout)

	if isError || isTimeout {
		h.circuit.RecordFailure()
	} else {
		h.circuit.RecordSuccess()
	}

	// Periodically check metrics for circuit state transitions
	metrics := h.window.GetMetrics()
	h.circuit.CheckMetrics(metrics)
}

// GetChannelHealthMetrics returns real-time health metrics for a channel
func GetChannelHealthMetrics(channelId int) WindowMetrics {
	h := getOrCreateHealth(channelId)
	return h.window.GetMetrics()
}

// GetChannelCircuitStatus returns circuit breaker status for a channel
func GetChannelCircuitStatus(channelId int) CircuitStatus {
	h := getOrCreateHealth(channelId)
	return h.circuit.GetStatus()
}

// GetChannelCircuitState returns the current circuit state for a channel
func GetChannelCircuitState(channelId int) CircuitState {
	h := getOrCreateHealth(channelId)
	return h.circuit.GetState()
}

// GetHealthMultiplier returns a weight multiplier (0.0-1.0) based on health.
// Used by smart fallback to adjust channel selection weights.
func GetHealthMultiplier(channelId int) float64 {
	h := getOrCreateHealth(channelId)
	state := h.circuit.GetState()

	switch state {
	case CircuitOpen:
		return 0.0 // no traffic
	case CircuitHalfOpen:
		return 0.05 // probe traffic only
	default: // Closed
		metrics := h.window.GetMetrics()
		if metrics.RequestCount < int64(minSamples) {
			return 1.0 // not enough data
		}
		// Scale from 0.1 to 1.0 based on health score
		return 0.1 + 0.9*(metrics.HealthScore/100.0)
	}
}

// GetAllChannelHealth returns health info for all tracked channels
func GetAllChannelHealth() map[int]map[string]interface{} {
	healthStoreMu.RLock()
	defer healthStoreMu.RUnlock()

	result := make(map[int]map[string]interface{})
	for id, h := range healthStore {
		result[id] = map[string]interface{}{
			"metrics": h.window.GetMetrics(),
			"circuit": h.circuit.GetStatus(),
		}
	}
	return result
}
