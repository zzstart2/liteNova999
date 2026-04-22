package controller

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/model"
)

// Provider groups channels by their provider label for the admin UI.
// This is a virtual grouping layer — channels are the real data.

// ProviderTypeMap maps channel type IDs to provider names and icons
var ProviderTypeMap = map[int]ProviderMeta{
	1:  {Name: "OpenAI", Icon: "openai"},
	3:  {Name: "Azure OpenAI", Icon: "azure"},
	14: {Name: "Anthropic", Icon: "anthropic"},
	15: {Name: "百度文心", Icon: "baidu"},
	16: {Name: "智谱 GLM", Icon: "zhipu"},
	17: {Name: "千问", Icon: "qwen"},
	19: {Name: "360 智脑", Icon: "ai360"},
	20: {Name: "OpenRouter", Icon: "openrouter"},
	23: {Name: "腾讯混元", Icon: "tencent"},
	24: {Name: "Google Gemini", Icon: "gemini"},
	25: {Name: "月之暗面 Kimi", Icon: "moonshot"},
	27: {Name: "MiniMax", Icon: "minimax"},
	28: {Name: "Mistral", Icon: "mistral"},
	29: {Name: "Groq", Icon: "groq"},
	30: {Name: "Ollama", Icon: "ollama"},
	31: {Name: "零一万物", Icon: "lingyiwanwu"},
	32: {Name: "阶跃星辰", Icon: "stepfun"},
	33: {Name: "AWS Claude", Icon: "aws"},
	34: {Name: "Coze", Icon: "coze"},
	35: {Name: "Cohere", Icon: "cohere"},
	36: {Name: "DeepSeek", Icon: "deepseek"},
	39: {Name: "Together AI", Icon: "together"},
	40: {Name: "字节豆包", Icon: "doubao"},
	44: {Name: "SiliconFlow", Icon: "siliconflow"},
	45: {Name: "xAI Grok", Icon: "xai"},
	48: {Name: "讯飞星火", Icon: "xunfei"},
	49: {Name: "千问", Icon: "qwen"}, // AliBailian is also Qwen
	50: {Name: "OpenAI 兼容", Icon: "openai"},
	51: {Name: "Gemini 兼容", Icon: "gemini"},
}

type ProviderMeta struct {
	Name string `json:"name"`
	Icon string `json:"icon"`
}

type ProviderInfo struct {
	Provider      string              `json:"provider"`
	Icon          string              `json:"icon"`
	Channels      []ProviderChannel   `json:"channels"`
	AllModels     []string            `json:"all_models"`
	Status        string              `json:"status"`
	TotalUsed     int64               `json:"total_used_quota"`
}

type ProviderChannel struct {
	Id           int    `json:"id"`
	Name         string `json:"name"`
	Type         int    `json:"type"`
	TypeName     string `json:"type_name"`
	Status       int    `json:"status"`
	Models       string `json:"models"`
	ModelCount   int    `json:"model_count"`
	ResponseTime int    `json:"response_time"`
	Priority     int64  `json:"priority"`
	UsedQuota    int64  `json:"used_quota"`
}

// GetProviders returns channels grouped by provider for the admin UI
func GetProviders(c *gin.Context) {
	var channels []model.Channel
	err := model.DB.Order("id").Find(&channels).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Group channels by provider name
	providerMap := make(map[string]*ProviderInfo)
	providerOrder := []string{}

	for _, ch := range channels {
		// Determine provider name from channel type
		providerName := "其他"
		providerIcon := "server"
		if meta, ok := ProviderTypeMap[ch.Type]; ok {
			providerName = meta.Name
			providerIcon = meta.Icon
		}

		if _, exists := providerMap[providerName]; !exists {
			providerMap[providerName] = &ProviderInfo{
				Provider: providerName,
				Icon:     providerIcon,
				Channels: []ProviderChannel{},
				Status:   "disabled",
			}
			providerOrder = append(providerOrder, providerName)
		}

		p := providerMap[providerName]

		// Parse models
		models := strings.Split(ch.Models, ",")
		modelCount := 0
		for _, m := range models {
			m = strings.TrimSpace(m)
			if m != "" {
				modelCount++
				// Add to all_models if not duplicate
				found := false
				for _, existing := range p.AllModels {
					if existing == m {
						found = true
						break
					}
				}
				if !found {
					p.AllModels = append(p.AllModels, m)
				}
			}
		}

		priority := int64(0)
		if ch.Priority != nil {
			priority = *ch.Priority
		}

		typeName := providerName
		if ch.Type == 17 {
			typeName = "DashScope 原生"
		} else if ch.Type == 49 {
			typeName = "百炼 OpenAI 兼容"
		}

		p.Channels = append(p.Channels, ProviderChannel{
			Id:           ch.Id,
			Name:         ch.Name,
			Type:         ch.Type,
			TypeName:     typeName,
			Status:       ch.Status,
			Models:       ch.Models,
			ModelCount:   modelCount,
			ResponseTime: ch.ResponseTime,
			Priority:     priority,
			UsedQuota:    ch.UsedQuota,
		})

		p.TotalUsed += ch.UsedQuota

		if ch.Status == model.ChannelStatusEnabled {
			p.Status = "enabled"
		}
	}

	// Build ordered result
	result := make([]ProviderInfo, 0, len(providerOrder))
	for _, name := range providerOrder {
		result = append(result, *providerMap[name])
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}
