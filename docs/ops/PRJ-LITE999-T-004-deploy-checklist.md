# 部署清单 — PRJ-LITE999-T-004 原生 API 透传路由设计

> **任务:** PRJ-LITE999-T-004 — 原生 API 透传路由设计
> **日期:** 2026-04-10
> **状态:** 已验证

---

## 一、功能概述

New-API 的原生 API 透传路由系统，将客户端请求按协议格式透传到 37 个上游服务商。

### 请求处理流水线

```
Client → Gin Router → Middleware Pipeline → Relay Controller → Adaptor → Upstream Provider
         (路由分组)    (鉴权/限流/分发)      (模式分派)         (协议转换)   (37 个服务商)
```

### 路由规模

| 维度 | 数量 |
|------|------|
| Relay 路由 | 53 条 (38 POST + 15 GET) |
| Video 路由 | 11 条 (6 POST + 5 GET) |
| RelayFormat 协议格式 | 13 种 |
| EndpointType 端点类型 | 9 种 |
| 服务商适配器 | 37 个 |
| Adaptor 接口方法 | 15 个 (+ TaskAdaptor 15 个) |
| ChannelType→APIType 映射 | 34 个 |
| 中间件 | 10 个 |

### 支持的协议格式

| 路由 | RelayFormat | 说明 |
|------|-------------|------|
| `/v1/chat/completions` | OpenAI | Chat Completions API |
| `/v1/completions` | OpenAI | Legacy Completions |
| `/v1/messages` | Claude | Anthropic Messages API |
| `/v1/responses` | OpenAIResponses | OpenAI Responses API |
| `/v1/responses/compact` | ResponsesCompaction | Responses 压缩模式 |
| `/v1beta/models/*` | Gemini | Google Gemini 原生 API |
| `/v1/embeddings` | Embedding | 向量嵌入 |
| `/v1/images/*` | OpenAIImage | 图像生成/编辑 |
| `/v1/audio/*` | OpenAIAudio | 语音转文字/TTS |
| `/v1/rerank` | Rerank | 重排序 |
| `/v1/realtime` (WS) | OpenAIRealtime | 实时音频 WebSocket |
| `/v1/moderations` | OpenAI | 内容审核 |
| `/mj/*`, `/suno/*` | Task/MjProxy | 异步任务类 |
| `/v1/video/*`, `/kling/*`, `/jimeng/*` | Task | 视频生成 |

### 37 个服务商

```
ai360  ali  aws  baidu  baidu_v2  claude  cloudflare  codex  cohere
coze  deepseek  dify  gemini  jimeng  jina  lingyiwanwu  minimax
mistral  mokaai  moonshot  ollama  openai  openrouter  palm
perplexity  replicate  siliconflow  submodel  task  tencent  vertex
volcengine  xai  xinference  xunfei  zhipu  zhipu_4v
```

---

## 二、关键代码路径

| 文件 | 职责 |
|------|------|
| `router/main.go` | 总路由注册入口：Api + Dashboard + Relay + Video + Web |
| `router/relay-router.go` | 核心透传路由：/v1/* 全部 API 端点映射 |
| `router/video-router.go` | 视频透传路由：Sora / Kling / Jimeng |
| `middleware/auth.go` | `TokenAuth()` — API Key 鉴权 |
| `middleware/distributor.go` | `Distribute()` — 模型→渠道分发 + Affinity |
| `middleware/model-rate-limit.go` | `ModelRequestRateLimit()` — 模型级限流 |
| `controller/relay.go` | `Relay()` — 按 RelayMode 分派到对应 Helper |
| `relay/channel/adapter.go` | `Adaptor` 接口 (15 方法) + `TaskAdaptor` 接口 |
| `relay/channel/*/` | 37 个服务商的具体 Adaptor 实现 |
| `relay/common/relay_info.go` | `GenRelayInfo()` — 请求元信息构造 (24 处 stream 支持) |
| `types/relay_format.go` | RelayFormat 枚举 |
| `constant/endpoint_type.go` | EndpointType 枚举 |
| `constant/channel.go` | ChannelType 常量 |
| `common/api_type.go` | `ChannelType2APIType()` — 渠道→API类型映射 |

---

## 三、中间件链 (执行顺序)

```
请求进入
  │
  ├─ CORS                          # 跨域处理
  ├─ DecompressRequestMiddleware   # 请求体解压 (gzip/br)
  ├─ BodyStorageCleanup            # 请求体缓存清理
  ├─ StatsMiddleware               # 请求统计
  ├─ RouteTag("relay")             # 路由标记 (监控区分)
  ├─ SystemPerformanceCheck        # 系统性能保护 (过载拒绝)
  ├─ TokenAuth                     # API Key → User/Token 鉴权
  ├─ ModelRequestRateLimit         # 模型级别限流
  └─ Distribute                    # 渠道选择 (Affinity/负载均衡/分组)
      │
      ▼
  Controller → Adaptor → Upstream
```

---

## 四、部署前验证 (已执行)

### 4.1 代码验证结果

| # | 验证项 | 结果 |
|---|--------|------|
| 1 | 路由文件完整性 (6 个文件) | ✅ 6/6 |
| 2 | Relay 路由注册 (53 条) | ✅ 38 POST + 15 GET |
| 3 | Video 路由注册 (11 条) | ✅ 6 POST + 5 GET |
| 4 | RelayFormat 类型 | ✅ 13 种 |
| 5 | EndpointType 类型 | ✅ 9 种 |
| 6 | 服务商适配器目录 | ✅ 37 个 |
| 7 | Adaptor 接口方法 | ✅ 15 个 (Adaptor) + 15 个 (TaskAdaptor) |
| 8 | 中间件链完整性 | ✅ 10 个中间件正确挂载 |
| 9 | 核心中间件文件 | ✅ 5/5 |
| 10 | ChannelType→APIType 映射 | ✅ 34 个 |
| 11 | SSE 流式支持 | ✅ relay_info.go 24 处 stream 引用 |
| 12 | WebSocket 支持 | ✅ /v1/realtime 路由 + upgrader 逻辑 |

### 4.2 渠道配置检查 (部署目标环境)

- [ ] 至少 1 个 OpenAI 兼容渠道已配置 (key + base_url)
- [ ] 至少 1 个 Claude 渠道已配置 (如需 /v1/messages)
- [ ] 至少 1 个 Gemini 渠道已配置 (如需 /v1beta)
- [ ] 渠道的 `models` 字段已填写支持的模型列表
- [ ] 渠道的 `base_url` 已确认可连通
- [ ] 至少 1 个 API Token 已创建 (用于客户端鉴权)

---

## 五、部署执行

### Step 1: 部署新版本

```bash
cd /opt/new-api

# 备份
docker compose exec postgres pg_dump -U root -Fc new-api > backups/pre-T004_$(date +%Y%m%d_%H%M%S).dump

# 更新
docker compose pull
docker compose up -d --remove-orphans

# 健康检查
timeout 90 bash -c 'until curl -sf http://localhost:3000/api/status | grep -q "success.*true"; do sleep 5; done'
```

### Step 2: 端到端路由验证

```bash
API_BASE="http://localhost:3000"
TOKEN="sk-your-api-token"
AUTH="Authorization: Bearer $TOKEN"

# --- OpenAI 格式透传 ---
echo "=== 1. POST /v1/chat/completions (OpenAI) ==="
curl -sf "$API_BASE/v1/chat/completions" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5}' \
  | head -c 200
echo ""

# --- Claude 格式透传 ---
echo "=== 2. POST /v1/messages (Claude) ==="
curl -sf "$API_BASE/v1/messages" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-3-haiku-20240307","messages":[{"role":"user","content":"hi"}],"max_tokens":5}' \
  | head -c 200
echo ""

# --- Embedding ---
echo "=== 3. POST /v1/embeddings ==="
curl -sf "$API_BASE/v1/embeddings" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-3-small","input":"hello"}' \
  | head -c 200
echo ""

# --- 流式 (SSE) ---
echo "=== 4. POST /v1/chat/completions (stream) ==="
curl -sf "$API_BASE/v1/chat/completions" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":5,"stream":true}' \
  | head -c 300
echo ""

# --- Models 列表 ---
echo "=== 5. GET /v1/models ==="
curl -sf "$API_BASE/v1/models" -H "$AUTH" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'{len(d.get(\"data\",[]))} models')" 2>/dev/null || echo "check manually"

# --- 404 / Not Implemented ---
echo "=== 6. POST /v1/fine-tunes (Not Implemented) ==="
curl -s -o /dev/null -w "%{http_code}" "$API_BASE/v1/fine-tunes" -X POST -H "$AUTH"
echo " (expect 501)"
```

### Step 3: 压力验证 (可选)

```bash
# 简单并发验证 — 10 并发 x 10 请求
for i in $(seq 1 10); do
  curl -sf "$API_BASE/v1/chat/completions" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}],"max_tokens":1}' \
    -o /dev/null -w "req$i: %{http_code} %{time_total}s\n" &
done
wait
```

---

## 六、部署后验证矩阵

| # | 验证项 | 方法 | 预期 | 通过 |
|---|--------|------|------|------|
| 1 | OpenAI Chat Completions | POST /v1/chat/completions | 200 + 正常响应 | [ ] |
| 2 | OpenAI Stream | 同上 + stream:true | SSE data: 流 | [ ] |
| 3 | Claude Messages | POST /v1/messages | Claude 格式响应 | [ ] |
| 4 | Gemini | POST /v1beta/models/gemini-pro:generateContent | Gemini 格式响应 | [ ] |
| 5 | Embeddings | POST /v1/embeddings | 返回 embedding 向量 | [ ] |
| 6 | Models List | GET /v1/models | 返回可用模型列表 | [ ] |
| 7 | Token 鉴权拒绝 | 无 Auth 请求 | 401 | [ ] |
| 8 | 错误 Key 拒绝 | 错误 sk-xxx | 401 | [ ] |
| 9 | 不存在的模型 | model: "nonexist-model" | 错误提示 | [ ] |
| 10 | Not Implemented | POST /v1/fine-tunes | 501 | [ ] |
| 11 | 限流生效 | 超频请求 | 429 | [ ] |
| 12 | 渠道自动选择 | 同模型多渠道 | 请求分散 | [ ] |
| 13 | 日志记录 | 查看 logs | 请求已记录含模型/token/耗时 | [ ] |

---

## 七、回滚方案

路由设计是随代码版本发布的，回滚 = 回退到上一版本镜像：

```bash
cd /opt/new-api
docker compose down
# 编辑 docker-compose.yml 指定上一版本 image tag
docker compose up -d
```

如果仅特定路由有问题，可通过 Nginx 层临时屏蔽：

```nginx
# 紧急屏蔽某个有问题的路由
location /v1/responses/compact {
    return 503 '{"error":"temporarily unavailable"}';
}
```

---

## 八、运维注意事项

### 新增服务商渠道

在管理后台添加渠道时，需确认：
1. 渠道类型从 50+ 种 ChannelType 中选择正确的类型
2. Base URL 填写正确（部分服务商需要包含 path prefix）
3. 模型列表填写该渠道实际支持的模型
4. API Key 格式正确（各服务商格式不同）

### 路由冲突排查

如果出现路由 404 或错误分发：
```bash
# 检查注册的路由
docker compose exec new-api /new-api --help 2>&1 || true
# 查看日志中的路由匹配信息
docker compose logs --tail=100 new-api | grep -E "relay|distribute|404"
```

### 性能调优

| 参数 | 环境变量 | 说明 |
|------|----------|------|
| 流式超时 | `STREAMING_TIMEOUT=300` | SSE 流最大等待时间 |
| 全局超时 | `RELAY_TIMEOUT=60` | 非流式请求超时 |
| 请求体大小 | Nginx `client_max_body_size` | 图片/音频上传大小限制 |
| WebSocket | Nginx `proxy_read_timeout 3600` | 实时音频长连接 |

---

## 九、执行记录 (2026-04-10)

### 代码验证

| 维度 | 验证结果 |
|------|----------|
| 路由文件 (6 个) | ✅ 全部存在 |
| Relay 路由 (53 条) | ✅ 已注册 |
| Video 路由 (11 条) | ✅ 已注册 |
| RelayFormat (13 种) | ✅ 已定义 |
| 服务商适配器 (37 个) | ✅ 全部存在 |
| Adaptor 接口 (30 方法) | ✅ 已定义 |
| 中间件链 (10 个) | ✅ 正确挂载 |
| ChannelType 映射 (34 个) | ✅ 已映射 |
| SSE 流式支持 | ✅ 24 处引用 |
| WebSocket 实时音频 | ✅ 路由 + upgrader |

### 结论

T-004 原生 API 透传路由设计的代码结构完整、路由覆盖全面。部署无需额外的配置变更或数据库迁移——路由随代码版本生效。部署后按验证矩阵 (第六节) 逐项确认即可。

---

*清单编制: ops-prjlite999 | 日期: 2026-04-10*
