package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`

	// --- 成本维度 ---
	PromptTokens     int     `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens int     `json:"completion_tokens" gorm:"default:0"`
	ModelRatio       float64 `json:"model_ratio" gorm:"type:decimal(10,6);default:0"`
	CompletionRatio  float64 `json:"completion_ratio" gorm:"type:decimal(10,6);default:0"`

	// --- 模型维度 ---
	ChannelId int    `json:"channel_id" gorm:"index;default:0"`
	Group     string `json:"group" gorm:"index;size:64;default:''"`

	// --- 时序数据 ---
	AvgUseTime   int `json:"avg_use_time" gorm:"default:0"`   // 平均延迟（毫秒）
	MaxUseTime   int `json:"max_use_time" gorm:"default:0"`   // 最大延迟（毫秒）
	StreamCount  int `json:"stream_count" gorm:"default:0"`    // 流式请求次数
	ErrorCount   int `json:"error_count" gorm:"default:0"`     // 错误次数
	TotalUseTime int `json:"total_use_time" gorm:"default:0"`  // 总延迟用于计算平均值
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog("正在更新数据看板数据...")
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}

// LogQuotaDataParams holds the parameters for logging quota data
type LogQuotaDataParams struct {
	UserId           int
	Username         string
	ModelName        string
	Quota            int
	CreatedAt        int64
	PromptTokens     int
	CompletionTokens int
	ChannelId        int
	Group            string
	UseTimeMs        int
	IsStream         bool
	IsError          bool
	ModelRatio       float64
	CompletionRatio  float64
}

func logQuotaDataCache(params LogQuotaDataParams) {
	key := fmt.Sprintf("%d-%s-%s-%d-%d-%s", params.UserId, params.Username, params.ModelName, params.CreatedAt, params.ChannelId, params.Group)
	tokenUsed := params.PromptTokens + params.CompletionTokens
	quotaData, ok := CacheQuotaData[key]
	if ok {
		quotaData.Count += 1
		quotaData.Quota += params.Quota
		quotaData.TokenUsed += tokenUsed
		quotaData.PromptTokens += params.PromptTokens
		quotaData.CompletionTokens += params.CompletionTokens
		quotaData.TotalUseTime += params.UseTimeMs
		if params.UseTimeMs > quotaData.MaxUseTime {
			quotaData.MaxUseTime = params.UseTimeMs
		}
		if params.IsStream {
			quotaData.StreamCount += 1
		}
		if params.IsError {
			quotaData.ErrorCount += 1
		}
		// 重新计算平均延迟
		if quotaData.Count > 0 {
			quotaData.AvgUseTime = quotaData.TotalUseTime / quotaData.Count
		}
		// 使用最新的 ratio 值（同一模型在同一时间段内 ratio 通常一致）
		quotaData.ModelRatio = params.ModelRatio
		quotaData.CompletionRatio = params.CompletionRatio
	} else {
		streamCount := 0
		if params.IsStream {
			streamCount = 1
		}
		errorCount := 0
		if params.IsError {
			errorCount = 1
		}
		quotaData = &QuotaData{
			UserID:           params.UserId,
			Username:         params.Username,
			ModelName:        params.ModelName,
			CreatedAt:        params.CreatedAt,
			Count:            1,
			Quota:            params.Quota,
			TokenUsed:        tokenUsed,
			PromptTokens:     params.PromptTokens,
			CompletionTokens: params.CompletionTokens,
			ChannelId:        params.ChannelId,
			Group:            params.Group,
			AvgUseTime:       params.UseTimeMs,
			MaxUseTime:       params.UseTimeMs,
			TotalUseTime:     params.UseTimeMs,
			StreamCount:      streamCount,
			ErrorCount:       errorCount,
			ModelRatio:       params.ModelRatio,
			CompletionRatio:  params.CompletionRatio,
		}
	}
	CacheQuotaData[key] = quotaData
}

// LogQuotaData is the legacy entry point maintained for backward compatibility.
// New callers should use LogQuotaDataEx with LogQuotaDataParams.
func LogQuotaData(userId int, username string, modelName string, quota int, createdAt int64, tokenUsed int) {
	// 只精确到小时
	createdAt = createdAt - (createdAt % 3600)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(LogQuotaDataParams{
		UserId:           userId,
		Username:         username,
		ModelName:        modelName,
		Quota:            quota,
		CreatedAt:        createdAt,
		PromptTokens:     tokenUsed / 2, // 无法拆分时平分
		CompletionTokens: tokenUsed - tokenUsed/2,
	})
}

// LogQuotaDataEx is the enhanced entry point that accepts full parameters.
func LogQuotaDataEx(params LogQuotaDataParams) {
	// 只精确到小时
	params.CreatedAt = params.CreatedAt - (params.CreatedAt % 3600)

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(params)
}

func SaveQuotaDataCache() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	size := len(CacheQuotaData)
	// 如果缓存中有数据，就保存到数据库中
	// 1. 先查询数据库中是否有数据
	// 2. 如果有数据，就更新数据
	// 3. 如果没有数据，就插入数据
	for _, quotaData := range CacheQuotaData {
		quotaDataDB := &QuotaData{}
		DB.Table("quota_data").Where("user_id = ? and username = ? and model_name = ? and created_at = ? and channel_id = ? and "+commonGroupCol+" = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.ChannelId, quotaData.Group).First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			increaseQuotaData(quotaData)
		} else {
			// 插入时计算 AvgUseTime
			if quotaData.Count > 0 {
				quotaData.AvgUseTime = quotaData.TotalUseTime / quotaData.Count
			}
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func increaseQuotaData(data *QuotaData) {
	updates := map[string]interface{}{
		"count":             gorm.Expr("count + ?", data.Count),
		"quota":             gorm.Expr("quota + ?", data.Quota),
		"token_used":        gorm.Expr("token_used + ?", data.TokenUsed),
		"prompt_tokens":     gorm.Expr("prompt_tokens + ?", data.PromptTokens),
		"completion_tokens": gorm.Expr("completion_tokens + ?", data.CompletionTokens),
		"total_use_time":    gorm.Expr("total_use_time + ?", data.TotalUseTime),
		"stream_count":      gorm.Expr("stream_count + ?", data.StreamCount),
		"error_count":       gorm.Expr("error_count + ?", data.ErrorCount),
	}

	// 更新最大延迟（仅当新值更大时）
	// CASE WHEN 在所有数据库中都兼容
	updates["max_use_time"] = gorm.Expr("CASE WHEN max_use_time < ? THEN ? ELSE max_use_time END", data.MaxUseTime, data.MaxUseTime)

	// 更新 model_ratio / completion_ratio（使用最新值）
	updates["model_ratio"] = data.ModelRatio
	updates["completion_ratio"] = data.CompletionRatio

	err := DB.Table("quota_data").Where("user_id = ? and username = ? and model_name = ? and created_at = ? and channel_id = ? and "+commonGroupCol+" = ?",
		data.UserID, data.Username, data.ModelName, data.CreatedAt, data.ChannelId, data.Group).Updates(updates).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("increaseQuotaData error: %s", err))
		return
	}

	// 在应用层重新计算平均延迟
	err = DB.Table("quota_data").Where("user_id = ? and username = ? and model_name = ? and created_at = ? and channel_id = ? and "+commonGroupCol+" = ?",
		data.UserID, data.Username, data.ModelName, data.CreatedAt, data.ChannelId, data.Group).
		Update("avg_use_time", gorm.Expr("CASE WHEN count > 0 THEN total_use_time / count ELSE 0 END")).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("increaseQuotaData avg_use_time error: %s", err))
	}
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, "+
			"sum(prompt_tokens) as prompt_tokens, sum(completion_tokens) as completion_tokens, "+
			"sum(stream_count) as stream_count, sum(error_count) as error_count, "+
			"sum(total_use_time) as total_use_time, "+
			"CASE WHEN sum(count) > 0 THEN sum(total_use_time) / sum(count) ELSE 0 END as avg_use_time").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("username, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetAllQuotaDates(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime)
	}
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").
		Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, "+
			"sum(prompt_tokens) as prompt_tokens, sum(completion_tokens) as completion_tokens, "+
			"sum(stream_count) as stream_count, sum(error_count) as error_count, "+
			"sum(total_use_time) as total_use_time, "+
			"CASE WHEN sum(count) > 0 THEN sum(total_use_time) / sum(count) ELSE 0 END as avg_use_time, "+
			"created_at").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}
