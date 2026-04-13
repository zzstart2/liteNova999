package passthrough

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
	"github.com/songquanpeng/one-api/relay/adaptor"
	channelhelper "github.com/songquanpeng/one-api/relay/adaptor"
	"github.com/songquanpeng/one-api/relay/channeltype"
	"github.com/songquanpeng/one-api/relay/meta"
	"github.com/songquanpeng/one-api/relay/model"
	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

// T-004: Enhanced passthrough adaptor with vendor-specific auth and path rewriting.
// Unlike the basic proxy adaptor (which requires admin + specific channel ID),
// this adaptor supports auto-selected channels and vendor-aware transparent forwarding.

var _ adaptor.Adaptor = new(Adaptor)

const channelName = "passthrough"

type Adaptor struct{}

func (a *Adaptor) Init(meta *meta.Meta) {}

func (a *Adaptor) ConvertRequest(c *gin.Context, relayMode int, request *model.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("passthrough does not convert requests")
}

func (a *Adaptor) ConvertImageRequest(request *model.ImageRequest) (any, error) {
	return nil, errors.New("passthrough does not convert image requests")
}

func (a *Adaptor) GetModelList() []string { return nil }
func (a *Adaptor) GetChannelName() string { return channelName }

// GetRequestURL rewrites the request path based on vendor type.
// The client sends to /passthrough/v1/... and we rewrite to the vendor's native path.
func (a *Adaptor) GetRequestURL(meta *meta.Meta) (string, error) {
	// Strip the passthrough prefix from the path
	path := meta.RequestURLPath
	if idx := strings.Index(path, "/passthrough"); idx >= 0 {
		path = strings.TrimPrefix(path[idx:], "/passthrough")
	}

	// Vendor-specific path rewriting
	path = rewritePath(meta.ChannelType, path)

	baseURL := strings.TrimRight(meta.BaseURL, "/")
	return baseURL + path, nil
}

// rewritePath applies vendor-specific path transformations
func rewritePath(channelType int, path string) string {
	switch channelType {
	case channeltype.Ali, channeltype.AliBailian:
		// Qwen/DashScope: /v1/... → /compatible-mode/v1/...
		if strings.HasPrefix(path, "/v1/") {
			return "/compatible-mode" + path
		}
	case channeltype.Anthropic:
		// Anthropic: /v1/chat/completions → /v1/messages
		if strings.Contains(path, "/chat/completions") {
			return "/v1/messages"
		}
	case channeltype.Gemini:
		// Google Gemini uses different URL patterns, passthrough as-is
		return path
	case channeltype.Azure:
		// Azure has different URL patterns; passthrough preserves them
		return path
	}
	// Default: passthrough as-is
	return path
}

// SetupRequestHeader sets vendor-specific authentication headers
func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Request, meta *meta.Meta) error {
	// Copy relevant request headers (content-type, accept, etc.)
	for k, v := range c.Request.Header {
		lk := strings.ToLower(k)
		// Skip hop-by-hop headers and auth (we'll set our own auth)
		if lk == "host" || lk == "content-length" || lk == "accept-encoding" ||
			lk == "connection" || lk == "authorization" ||
			lk == "x-api-key" || lk == "api-key" {
			continue
		}
		req.Header.Set(k, v[0])
	}

	// Set vendor-specific auth headers
	setVendorAuth(meta.ChannelType, meta.APIKey, req)

	// Ensure content-type is set
	if ct := c.Request.Header.Get("Content-Type"); ct != "" {
		req.Header.Set("Content-Type", ct)
	}

	return nil
}

// setVendorAuth sets the correct authentication header per vendor
func setVendorAuth(channelType int, apiKey string, req *http.Request) {
	// Strip any existing "Bearer " prefix from the API key
	key := strings.TrimPrefix(apiKey, "Bearer ")

	switch channelType {
	case channeltype.Anthropic:
		req.Header.Set("x-api-key", key)
		req.Header.Set("anthropic-version", "2023-06-01")
	case channeltype.Azure:
		req.Header.Set("Api-Key", key)
	case channeltype.Gemini:
		req.Header.Set("x-goog-api-key", key)
	default:
		// OpenAI-compatible (includes Qwen/DashScope, DeepSeek, Moonshot, MiniMax, etc.)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", key))
	}
}

// DoRequest executes the HTTP request to the upstream
func (a *Adaptor) DoRequest(c *gin.Context, meta *meta.Meta, requestBody io.Reader) (*http.Response, error) {
	return channelhelper.DoRequestHelper(a, c, meta, requestBody)
}

// DoResponse streams the upstream response back to the client transparently
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, meta *meta.Meta) (usage *model.Usage, err *model.ErrorWithStatusCode) {
	// Copy all response headers
	for k, v := range resp.Header {
		for _, vv := range v {
			c.Writer.Header().Set(k, vv)
		}
	}

	c.Writer.WriteHeader(resp.StatusCode)

	// Stream the response body
	if _, gerr := io.Copy(c.Writer, resp.Body); gerr != nil {
		return nil, &relaymodel.ErrorWithStatusCode{
			StatusCode: http.StatusInternalServerError,
			Error: relaymodel.Error{
				Message: gerr.Error(),
			},
		}
	}

	// Check for upstream error
	if resp.StatusCode >= 400 {
		return nil, &relaymodel.ErrorWithStatusCode{
			StatusCode: resp.StatusCode,
			Error: relaymodel.Error{
				Message: fmt.Sprintf("upstream returned status %d", resp.StatusCode),
				Type:    "upstream_error",
			},
		}
	}

	return nil, nil
}
