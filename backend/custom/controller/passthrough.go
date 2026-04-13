package controller

import (
	"bytes"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/ctxkey"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/middleware"
	dbmodel "github.com/songquanpeng/one-api/model"
	"github.com/songquanpeng/one-api/monitor"
	"github.com/songquanpeng/one-api/relay/adaptor/passthrough"
	"github.com/songquanpeng/one-api/relay/meta"
	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

// T-004: Native API passthrough relay controller.
// Transparent forwarding with vendor-specific auth and path rewriting.
// Supports auto channel selection (unlike proxy which requires specific channel ID).

func RelayPassthrough(c *gin.Context) {
	ctx := c.Request.Context()
	channelId := c.GetInt(ctxkey.ChannelId)
	userId := c.GetInt(ctxkey.Id)

	adaptor := &passthrough.Adaptor{}
	m := meta.GetByContext(c)
	adaptor.Init(m)

	// Read and buffer the request body for potential retries
	requestBody, _ := common.GetRequestBody(c)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))

	startTime := time.Now()
	bizErr := doPassthrough(c, adaptor, m)
	latencyMs := time.Since(startTime).Milliseconds()

	if bizErr == nil {
		monitor.Emit(channelId, true)
		monitor.RecordRequestHealth(channelId, latencyMs, false, false)
		return
	}

	// Record failure
	isTimeout := bizErr.StatusCode == http.StatusGatewayTimeout || bizErr.StatusCode == http.StatusRequestTimeout
	monitor.RecordRequestHealth(channelId, latencyMs, true, isTimeout)

	channelName := c.GetString(ctxkey.ChannelName)
	group := c.GetString(ctxkey.Group)
	originalModel := c.GetString(ctxkey.OriginalModel)
	go processChannelRelayError(ctx, userId, channelId, channelName, *bizErr)

	requestId := c.GetString(helper.RequestIdKey)

	if !shouldRetry(c, bizErr.StatusCode) {
		bizErr.Error.Message = helper.MessageWithRequestId(bizErr.Error.Message, requestId)
		c.JSON(bizErr.StatusCode, gin.H{"error": bizErr.Error})
		return
	}

	// Smart fallback with tried-channel exclusion
	triedChannels := map[int]bool{channelId: true}
	retryTimes := 2 // passthrough retries

	for i := retryTimes; i > 0; i-- {
		channel, err := dbmodel.CacheGetRandomSatisfiedChannelSmart(group, originalModel, triedChannels)
		if err != nil {
			logger.Errorf(ctx, "passthrough retry: no available channel: %+v", err)
			break
		}

		logger.Infof(ctx, "passthrough: retrying with channel #%d (remain %d)", channel.Id, i)
		triedChannels[channel.Id] = true

		middleware.SetupContextForSelectedChannel(c, channel, originalModel)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))

		retryMeta := meta.GetByContext(c)
		retryAdaptor := &passthrough.Adaptor{}
		retryAdaptor.Init(retryMeta)

		retryStart := time.Now()
		bizErr = doPassthrough(c, retryAdaptor, retryMeta)
		retryLatencyMs := time.Since(retryStart).Milliseconds()

		if bizErr == nil {
			monitor.Emit(channel.Id, true)
			monitor.RecordRequestHealth(channel.Id, retryLatencyMs, false, false)
			return
		}

		retryIsTimeout := bizErr.StatusCode == http.StatusGatewayTimeout || bizErr.StatusCode == http.StatusRequestTimeout
		monitor.RecordRequestHealth(channel.Id, retryLatencyMs, true, retryIsTimeout)
		go processChannelRelayError(ctx, userId, channel.Id, channel.Name, *bizErr)
	}

	if bizErr != nil {
		bizErr.Error.Message = helper.MessageWithRequestId(bizErr.Error.Message, requestId)
		c.JSON(bizErr.StatusCode, gin.H{"error": bizErr.Error})
	}
}

func doPassthrough(c *gin.Context, adaptor *passthrough.Adaptor, m *meta.Meta) *relaymodel.ErrorWithStatusCode {
	ctx := c.Request.Context()

	resp, err := adaptor.DoRequest(c, m, c.Request.Body)
	if err != nil {
		logger.Errorf(ctx, "passthrough DoRequest failed: %s", err.Error())
		return &relaymodel.ErrorWithStatusCode{
			StatusCode: http.StatusBadGateway,
			Error: relaymodel.Error{
				Message: err.Error(),
				Type:    "upstream_error",
			},
		}
	}

	_, respErr := adaptor.DoResponse(c, resp, m)
	return respErr
}
