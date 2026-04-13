package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// ChannelHealth stores per-channel, per-hour aggregated health metrics.
// GORM AutoMigrate creates/updates the table automatically.
type ChannelHealth struct {
	Id               int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ChannelId        int    `json:"channel_id" gorm:"index:idx_ch_channel_time,priority:1;not null"`
	ChannelName      string `json:"channel_name" gorm:"size:128;default:''"`
	ChannelType      int    `json:"channel_type" gorm:"default:0"`
	CreatedAt        int64  `json:"created_at" gorm:"bigint;index:idx_ch_channel_time,priority:2;not null"`
	RequestCount     int    `json:"request_count" gorm:"default:0"`
	ErrorCount       int    `json:"error_count" gorm:"default:0"`
	TotalLatencyMs   int64  `json:"total_latency_ms" gorm:"bigint;default:0"`
	MaxLatencyMs     int64  `json:"max_latency_ms" gorm:"bigint;default:0"`
	MinLatencyMs     int64  `json:"min_latency_ms" gorm:"bigint;default:0"`
	SuccessCount     int    `json:"success_count" gorm:"default:0"`
	TimeoutCount     int    `json:"timeout_count" gorm:"default:0"`
	DisableCount     int    `json:"disable_count" gorm:"default:0"`
	AvgLatencyMs     int64  `json:"avg_latency_ms" gorm:"bigint;default:0"`
	ErrorRate        float64 `json:"error_rate" gorm:"type:decimal(6,4);default:0"`
}

// ChannelHealthSnapshot holds real-time health data kept in memory.
type ChannelHealthSnapshot struct {
	ChannelId      int
	ChannelName    string
	ChannelType    int
	RequestCount   int
	ErrorCount     int
	SuccessCount   int
	TimeoutCount   int
	DisableCount   int
	TotalLatencyMs int64
	MaxLatencyMs   int64
	MinLatencyMs   int64
}

// ChannelHealthSummary is the API response type for a single channel's health status.
type ChannelHealthSummary struct {
	ChannelId        int     `json:"channel_id"`
	ChannelName      string  `json:"channel_name"`
	ChannelType      int     `json:"channel_type"`
	Status           int     `json:"status"`
	RequestCount     int     `json:"request_count"`
	SuccessCount     int     `json:"success_count"`
	ErrorCount       int     `json:"error_count"`
	TimeoutCount     int     `json:"timeout_count"`
	DisableCount     int     `json:"disable_count"`
	ErrorRate        float64 `json:"error_rate"`
	AvgLatencyMs     int64   `json:"avg_latency_ms"`
	MaxLatencyMs     int64   `json:"max_latency_ms"`
	MinLatencyMs     int64   `json:"min_latency_ms"`
	LastTestTime     int64   `json:"last_test_time"`
	LastResponseTime int     `json:"last_response_time"`
	Availability     float64 `json:"availability"`
	HealthScore      int     `json:"health_score"`
}

// --- In-memory cache ---

var (
	healthCache     = make(map[int]*ChannelHealthSnapshot) // channelId -> snapshot
	healthCacheLock sync.Mutex
)

// RecordChannelRequest records a single request outcome into the in-memory cache.
func RecordChannelRequest(channelId int, channelName string, channelType int, latencyMs int64, isError bool, isTimeout bool) {
	healthCacheLock.Lock()
	defer healthCacheLock.Unlock()

	snap, ok := healthCache[channelId]
	if !ok {
		snap = &ChannelHealthSnapshot{
			ChannelId:    channelId,
			ChannelName:  channelName,
			ChannelType:  channelType,
			MinLatencyMs: latencyMs,
		}
		healthCache[channelId] = snap
	}

	snap.RequestCount++
	snap.TotalLatencyMs += latencyMs
	if latencyMs > snap.MaxLatencyMs {
		snap.MaxLatencyMs = latencyMs
	}
	if latencyMs < snap.MinLatencyMs || snap.MinLatencyMs == 0 {
		snap.MinLatencyMs = latencyMs
	}

	if isError {
		snap.ErrorCount++
	} else {
		snap.SuccessCount++
	}
	if isTimeout {
		snap.TimeoutCount++
	}
}

// RecordChannelDisable records a channel disable event.
func RecordChannelDisable(channelId int) {
	healthCacheLock.Lock()
	defer healthCacheLock.Unlock()
	if snap, ok := healthCache[channelId]; ok {
		snap.DisableCount++
	} else {
		healthCache[channelId] = &ChannelHealthSnapshot{
			ChannelId:    channelId,
			DisableCount: 1,
		}
	}
}

// FlushHealthCache persists the in-memory snapshots to the database and resets the cache.
// This should be called periodically (e.g., every 5 minutes).
func FlushHealthCache() {
	healthCacheLock.Lock()
	cache := healthCache
	healthCache = make(map[int]*ChannelHealthSnapshot)
	healthCacheLock.Unlock()

	if len(cache) == 0 {
		return
	}

	now := time.Now().Unix()
	hourBucket := now - (now % 3600)

	for _, snap := range cache {
		if snap.RequestCount == 0 && snap.DisableCount == 0 {
			continue
		}

		var avgLatency int64
		if snap.RequestCount > 0 {
			avgLatency = snap.TotalLatencyMs / int64(snap.RequestCount)
		}
		var errorRate float64
		if snap.RequestCount > 0 {
			errorRate = float64(snap.ErrorCount) / float64(snap.RequestCount)
		}

		existing := &ChannelHealth{}
		err := DB.Table("channel_healths").
			Where("channel_id = ? AND created_at = ?", snap.ChannelId, hourBucket).
			First(existing).Error

		if err == nil && existing.Id > 0 {
			// Merge into existing row
			newTotal := existing.RequestCount + snap.RequestCount
			var newAvg int64
			if newTotal > 0 {
				newAvg = (existing.TotalLatencyMs + snap.TotalLatencyMs) / int64(newTotal)
			}
			newErrors := existing.ErrorCount + snap.ErrorCount
			var newErrorRate float64
			if newTotal > 0 {
				newErrorRate = float64(newErrors) / float64(newTotal)
			}

			newMax := existing.MaxLatencyMs
			if snap.MaxLatencyMs > newMax {
				newMax = snap.MaxLatencyMs
			}
			newMin := existing.MinLatencyMs
			if snap.MinLatencyMs < newMin || newMin == 0 {
				newMin = snap.MinLatencyMs
			}

			DB.Table("channel_healths").Where("id = ?", existing.Id).Updates(map[string]interface{}{
				"request_count":   newTotal,
				"error_count":     newErrors,
				"success_count":   existing.SuccessCount + snap.SuccessCount,
				"timeout_count":   existing.TimeoutCount + snap.TimeoutCount,
				"disable_count":   existing.DisableCount + snap.DisableCount,
				"total_latency_ms": existing.TotalLatencyMs + snap.TotalLatencyMs,
				"max_latency_ms":  newMax,
				"min_latency_ms":  newMin,
				"avg_latency_ms":  newAvg,
				"error_rate":      newErrorRate,
			})
		} else {
			// Insert new row
			record := &ChannelHealth{
				ChannelId:      snap.ChannelId,
				ChannelName:    snap.ChannelName,
				ChannelType:    snap.ChannelType,
				CreatedAt:      hourBucket,
				RequestCount:   snap.RequestCount,
				ErrorCount:     snap.ErrorCount,
				SuccessCount:   snap.SuccessCount,
				TimeoutCount:   snap.TimeoutCount,
				DisableCount:   snap.DisableCount,
				TotalLatencyMs: snap.TotalLatencyMs,
				MaxLatencyMs:   snap.MaxLatencyMs,
				MinLatencyMs:   snap.MinLatencyMs,
				AvgLatencyMs:   avgLatency,
				ErrorRate:      errorRate,
			}
			DB.Table("channel_healths").Create(record)
		}
	}
	common.SysLog(fmt.Sprintf("flushed channel health data: %d channels", len(cache)))
}

// RunHealthDataFlusher starts the background loop that periodically flushes health data.
// It also cleans up records older than 30 days once per hour.
func RunHealthDataFlusher(intervalMinutes int) {
	if intervalMinutes <= 0 {
		intervalMinutes = 5
	}
	var cleanupTicker int
	for {
		time.Sleep(time.Duration(intervalMinutes) * time.Minute)
		FlushHealthCache()

		// Cleanup old records roughly once per hour
		cleanupTicker += intervalMinutes
		if cleanupTicker >= 60 {
			cleanupTicker = 0
			cutoff := time.Now().Unix() - 30*86400 // 30 days retention
			deleted, err := DeleteOldChannelHealth(cutoff, 1000)
			if err != nil {
				common.SysLog(fmt.Sprintf("failed to cleanup old channel health data: %s", err))
			} else if deleted > 0 {
				common.SysLog(fmt.Sprintf("cleaned up %d old channel health records", deleted))
			}
		}
	}
}

// --- Query functions ---

// GetChannelHealthHistory returns hourly health records for a single channel.
func GetChannelHealthHistory(channelId int, startTime int64, endTime int64) ([]*ChannelHealth, error) {
	var records []*ChannelHealth
	err := DB.Table("channel_healths").
		Where("channel_id = ? AND created_at >= ? AND created_at <= ?", channelId, startTime, endTime).
		Order("created_at ASC").
		Find(&records).Error
	return records, err
}

// GetAllChannelHealthSummary returns aggregated health for all channels in a time range.
func GetAllChannelHealthSummary(startTime int64, endTime int64) ([]*ChannelHealth, error) {
	var records []*ChannelHealth
	err := DB.Table("channel_healths").
		Select("channel_id, "+
			"MAX(channel_name) as channel_name, "+
			"MAX(channel_type) as channel_type, "+
			"SUM(request_count) as request_count, "+
			"SUM(error_count) as error_count, "+
			"SUM(success_count) as success_count, "+
			"SUM(timeout_count) as timeout_count, "+
			"SUM(disable_count) as disable_count, "+
			"SUM(total_latency_ms) as total_latency_ms, "+
			"MAX(max_latency_ms) as max_latency_ms, "+
			"COALESCE(MIN(CASE WHEN min_latency_ms > 0 THEN min_latency_ms END), 0) as min_latency_ms, "+
			"CASE WHEN SUM(request_count) > 0 THEN SUM(total_latency_ms) / SUM(request_count) ELSE 0 END as avg_latency_ms, "+
			"CASE WHEN SUM(request_count) > 0 THEN SUM(error_count) * 1.0 / SUM(request_count) ELSE 0 END as error_rate").
		Where("created_at >= ? AND created_at <= ?", startTime, endTime).
		Group("channel_id").
		Find(&records).Error
	return records, err
}

// DeleteOldChannelHealth cleans up health records older than the given timestamp.
func DeleteOldChannelHealth(beforeTimestamp int64, batchSize int) (int64, error) {
	result := DB.Where("created_at < ?", beforeTimestamp).Limit(batchSize).Delete(&ChannelHealth{})
	return result.RowsAffected, result.Error
}

// CalculateHealthScore computes a 0-100 score from error rate, avg latency, and availability.
// Higher is better.
func CalculateHealthScore(errorRate float64, avgLatencyMs int64, disableCount int, requestCount int) int {
	// Error rate component: 0% error = 40 points, 100% error = 0 points
	errorScore := 40.0 * (1.0 - errorRate)

	// Latency component: <500ms = 30 points, >5000ms = 0 points
	latencyScore := 30.0
	if avgLatencyMs > 500 {
		latencyScore = 30.0 * (1.0 - float64(avgLatencyMs-500)/4500.0)
		if latencyScore < 0 {
			latencyScore = 0
		}
	}

	// Availability component: no disables = 30 points
	availScore := 30.0
	if disableCount > 0 && requestCount > 0 {
		disableRatio := float64(disableCount) / float64(requestCount) * 100 // amplify
		availScore = 30.0 * (1.0 - disableRatio)
		if availScore < 0 {
			availScore = 0
		}
	}

	score := int(errorScore + latencyScore + availScore)
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return score
}
