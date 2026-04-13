package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/monitor"
)

// T-008: Health check API endpoints

// GetChannelHealth returns real-time sliding window health metrics for a specific channel
func GetChannelHealth(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid channel id",
		})
		return
	}

	metrics := monitor.GetChannelHealthMetrics(id)
	circuit := monitor.GetChannelCircuitStatus(id)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"channel_id": id,
			"metrics":    metrics,
			"circuit":    circuit,
			"multiplier": monitor.GetHealthMultiplier(id),
		},
	})
}

// GetAllChannelsHealth returns health info for all tracked channels
func GetAllChannelsHealth(c *gin.Context) {
	health := monitor.GetAllChannelHealth()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    health,
	})
}
