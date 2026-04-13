# 测试方案: PRJ-LITE999-T-005 厂商 API 适配器开发

## 1. 测试概述

| 项目 | 内容 |
|------|------|
| **任务编号** | PRJ-LITE999-T-005 |
| **任务名称** | 厂商 API 适配器开发 |
| **功能描述** | 千问/豆包/GLM/Kimi/MiniMax 原生 API 适配器 |
| **测试类型** | 单元测试 + 集成测试 + 边界/异常测试 |
| **技术栈** | Python 3 + pytest + pytest-asyncio |
| **测试日期** | 2025-07-16 |

## 2. 架构设计

### 2.1 统一接口 (BaseAdapter)
所有厂商适配器实现统一的抽象接口：
- `chat_completion(messages, model, **kwargs) → ChatResponse`
- `stream_chat_completion(messages, model, **kwargs) → AsyncIterator[ChatChunk]`
- `list_models() → list[ModelInfo]`
- `validate_config() → bool`

### 2.2 适配器清单
| 适配器 | 厂商 | API 风格 | 基础 URL |
|--------|------|----------|----------|
| `QwenAdapter` | 千问 (通义) | OpenAI 兼容 | dashscope.aliyuncs.com |
| `DoubaoAdapter` | 豆包 (字节) | OpenAI 兼容 | ark.cn-beijing.volces.com |
| `GLMAdapter` | 智谱 GLM | OpenAI 兼容 | open.bigmodel.cn |
| `KimiAdapter` | Moonshot Kimi | OpenAI 兼容 | api.moonshot.cn |
| `MiniMaxAdapter` | MiniMax | 自有协议 | api.minimax.chat |

### 2.3 核心数据结构
- `ChatMessage` — role + content
- `ChatResponse` — 完整响应（content, usage, model, finish_reason）
- `ChatChunk` — 流式片段（delta_content, finish_reason）
- `ModelInfo` — 模型元数据（id, name, context_length）
- `AdapterConfig` — 统一配置（api_key, base_url, timeout, extra_headers）

## 3. 测试用例设计

### 3.1 单元测试 — 基础接口与注册

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-001 | BaseAdapter 不可直接实例化 | 抛出 TypeError | P0 |
| UT-002 | 适配器注册表 — 5 家厂商全部注册 | registry 包含 5 个 | P0 |
| UT-003 | 按名称获取适配器类 | 返回正确的类 | P0 |
| UT-004 | 获取不存在的适配器 | 抛出 KeyError | P1 |

### 3.2 单元测试 — 各厂商适配器 (每家 × 7 = 35 条)

每个适配器验证以下场景：

| 用例后缀 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| -001 | 配置初始化 | base_url / headers 正确 | P0 |
| -002 | chat_completion 正常响应 | 解析为 ChatResponse | P0 |
| -003 | chat_completion HTTP 错误 | 抛出 APIError | P0 |
| -004 | stream_chat_completion 正常 | 逐块 yield ChatChunk | P0 |
| -005 | 请求体构建 | 正确映射到厂商格式 | P0 |
| -006 | 响应体解析 — 非标字段映射 | 统一到 ChatResponse | P1 |
| -007 | validate_config — 有效/无效 | 返回 True/False | P1 |

### 3.3 集成测试 — 适配器协作

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| IT-001 | 所有适配器实例化 + validate | 全部正常 | P0 |
| IT-002 | 适配器 + FallbackRouter 联动 | 首选失败自动切换 | P0 |
| IT-003 | 统一接口多态调用 | 不同适配器同一接口 | P0 |

### 3.4 边界/异常测试

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| ET-001 | 空 API Key | validate_config = False | P0 |
| ET-002 | 空消息列表 | 抛出 ValueError | P1 |
| ET-003 | 超长 content | 正常构建请求（不截断） | P1 |
| ET-004 | 非 JSON 响应体 | 抛出 ParseError | P1 |
| ET-005 | 超时响应 | 抛出 TimeoutError | P1 |
| ET-006 | 429 限流响应 | 抛出 RateLimitError | P1 |
| ET-007 | MiniMax 特殊错误码映射 | 正确映射为标准异常 | P1 |

## 4. 测试环境

- Python 3.x + pytest + pytest-asyncio
- Mock 模拟所有 HTTP 请求，不调用真实 API
- 不依赖任何真实 API Key

## 5. 通过标准

- 所有 P0 用例通过
- P1 用例通过率 ≥ 90%
- 5 个适配器全部覆盖
- 无未处理异常
