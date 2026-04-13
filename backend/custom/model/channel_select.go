package model

import (
	"errors"
	"math/rand"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/monitor"
)

// T-009: Smart fallback — health-aware channel selection with tried-channel exclusion

// CacheGetRandomSatisfiedChannelSmart selects a channel with:
// 1. Exclusion of already-tried channels (prevents retry on same failed channel)
// 2. Health-aware weighted random selection (healthy channels get more traffic)
// 3. Circuit breaker integration (open circuits get no traffic)
//
// Falls back to CacheGetRandomSatisfiedChannel when health features are disabled.
func CacheGetRandomSatisfiedChannelSmart(group string, model string, excludeIds map[int]bool) (*Channel, error) {
	if !config.MemoryCacheEnabled {
		return GetRandomSatisfiedChannel(group, model, false)
	}

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()

	channels := group2model2channels[group][model]
	if len(channels) == 0 {
		return nil, errors.New("channel not found")
	}

	// Build candidate list: filter excluded channels and apply health weights
	type candidate struct {
		channel *Channel
		weight  float64
	}

	var candidates []candidate
	var totalWeight float64

	// Process channels by priority tiers
	// First, try highest priority tier with health filtering
	currentPriority := channels[0].GetPriority()
	tierStart := 0

	for tier := 0; tier < 2; tier++ { // try up to 2 priority tiers
		if tierStart >= len(channels) {
			break
		}

		candidates = candidates[:0]
		totalWeight = 0

		for i := tierStart; i < len(channels); i++ {
			ch := channels[i]

			// Move to next tier if priority changes
			if tier == 0 && ch.GetPriority() != currentPriority {
				break
			}

			// Skip excluded channels
			if excludeIds != nil && excludeIds[ch.Id] {
				continue
			}

			// Get health multiplier (0.0 for open circuit, 0.05 for half-open, 0.1-1.0 for closed)
			multiplier := monitor.GetHealthMultiplier(ch.Id)
			if multiplier <= 0 {
				continue // circuit open, skip entirely
			}

			w := multiplier
			if ch.Weight != nil && *ch.Weight > 0 {
				w *= float64(*ch.Weight)
			} else {
				w *= 1.0 // default weight
			}

			candidates = append(candidates, candidate{channel: ch, weight: w})
			totalWeight += w
		}

		if len(candidates) > 0 {
			break // found viable candidates in this tier
		}

		// No viable candidates in this tier, move to next
		for tierStart < len(channels) && channels[tierStart].GetPriority() == currentPriority {
			tierStart++
		}
		if tierStart < len(channels) {
			currentPriority = channels[tierStart].GetPriority()
		}
	}

	if len(candidates) == 0 {
		// Last resort: try any channel not in exclude list, ignoring health
		for _, ch := range channels {
			if excludeIds != nil && excludeIds[ch.Id] {
				continue
			}
			return ch, nil
		}
		return nil, errors.New("no available channel after exclusion and health filtering")
	}

	// Weighted random selection
	r := rand.Float64() * totalWeight
	for _, c := range candidates {
		r -= c.weight
		if r <= 0 {
			return c.channel, nil
		}
	}

	// Shouldn't reach here, but return last candidate as fallback
	return candidates[len(candidates)-1].channel, nil
}
