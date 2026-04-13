package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetChannelHealthOverview returns health summaries for all channels in a time range.
// Admin only. Query params: start_timestamp, end_timestamp (defaults to last 24h).
func GetChannelHealthOverview(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	now := time.Now().Unix()
	if endTimestamp == 0 {
		endTimestamp = now
	}
	if startTimestamp == 0 {
		startTimestamp = now - 86400 // default 24h
	}

	healthRecords, err := model.GetAllChannelHealthSummary(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Enrich with live channel status and scoring
	summaries := make([]model.ChannelHealthSummary, 0, len(healthRecords))
	for _, rec := range healthRecords {
		var status int
		var lastTestTime int64
		var lastResponseTime int
		ch, chErr := model.CacheGetChannel(rec.ChannelId)
		if chErr == nil && ch != nil {
			status = ch.Status
			lastTestTime = ch.TestTime
			lastResponseTime = ch.ResponseTime
		}

		var availability float64
		if rec.RequestCount > 0 {
			availability = float64(rec.SuccessCount) / float64(rec.RequestCount) * 100
		}

		score := model.CalculateHealthScore(rec.ErrorRate, rec.AvgLatencyMs, rec.DisableCount, rec.RequestCount)

		summaries = append(summaries, model.ChannelHealthSummary{
			ChannelId:        rec.ChannelId,
			ChannelName:      rec.ChannelName,
			ChannelType:      rec.ChannelType,
			Status:           status,
			RequestCount:     rec.RequestCount,
			SuccessCount:     rec.SuccessCount,
			ErrorCount:       rec.ErrorCount,
			TimeoutCount:     rec.TimeoutCount,
			DisableCount:     rec.DisableCount,
			ErrorRate:        rec.ErrorRate,
			AvgLatencyMs:     rec.AvgLatencyMs,
			MaxLatencyMs:     rec.MaxLatencyMs,
			MinLatencyMs:     rec.MinLatencyMs,
			LastTestTime:     lastTestTime,
			LastResponseTime: lastResponseTime,
			Availability:     availability,
			HealthScore:      score,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    summaries,
	})
}

// GetChannelHealthDetail returns hourly health history for a single channel.
// Admin only. Path param: id. Query params: start_timestamp, end_timestamp.
func GetChannelHealthDetail(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	now := time.Now().Unix()
	if endTimestamp == 0 {
		endTimestamp = now
	}
	if startTimestamp == 0 {
		startTimestamp = now - 86400*7 // default 7 days
	}

	records, err := model.GetChannelHealthHistory(channelId, startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    records,
	})
}
