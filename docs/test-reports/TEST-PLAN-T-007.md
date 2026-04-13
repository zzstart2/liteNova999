# 测试方案: PRJ-LITE999-T-007 统一接口调度与适配器生命周期管理

## 1. 测试概述

| 项目 | 内容 |
|------|------|
| **任务编号** | PRJ-LITE999-T-007 |
| **任务名称** | 统一接口调度与适配器生命周期管理 |
| **功能描述** | AdapterRegistry 高级操作、工厂模式创建适配器、多适配器统一调度、配置校验管线、错误传播链、适配器与路由/健康检查联动 |
| **依赖** | T-005 厂商 API 适配器 |
| **测试类型** | 单元测试 + 集成测试 + 边界/异常测试 |
| **技术栈** | Python 3 + pytest + pytest-asyncio |
| **测试日期** | 2026-04-11 |

## 2. 被测功能模块

### 2.1 AdapterRegistry（适配器注册表）
- 注册 / 反注册 / 清空 / 查询
- 防重复注册 / 不存在时的异常
- 全量枚举

### 2.2 适配器工厂与实例化
- 通过 Registry 名称 + config 创建适配器实例
- 各厂商默认 base_url 自动填充
- 自定义 base_url 覆盖

### 2.3 统一调度层
- 同一 ChatMessage 列表分发到 5 家适配器
- 多态调用: chat_completion / stream_chat_completion / list_models
- 响应统一为 ChatResponse / ChatChunk / ModelInfo

### 2.4 配置校验管线
- validate_config 全厂商一致性
- 缺失 api_key / base_url 的行为
- extra_headers / extra_params 透传

### 2.5 错误传播链
- APIError / ParseError / RateLimitError 跨适配器一致性
- 错误 provider 字段正确标注
- HTTP 状态码映射一致性

### 2.6 适配器 ↔ FallbackRouter 联动
- Registry 查找 → 实例化 → 注入 Router
- Fallback 时适配器切换
- 全部熔断时 AllProvidersUnavailableError

### 2.7 适配器 ↔ HealthChecker 联动
- 适配器调用结果反馈给 HealthChecker
- 健康状态影响路由优先级

## 3. 测试用例设计

### 3.1 单元测试 — Registry 高级操作

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-001 | Registry 全量枚举 | 返回 5 家适配器 | P0 |
| UT-002 | Registry clear + 重新注册 | 清空后为空，注册后恢复 | P0 |
| UT-003 | Registry 获取不存在的适配器 | KeyError | P0 |
| UT-004 | Registry 覆盖注册同名 | 后者覆盖前者 | P1 |

### 3.2 单元测试 — 工厂实例化

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-005 | 通过 Registry.get + config 创建实例 | 类型正确 | P0 |
| UT-006 | 5 家适配器默认 base_url | 各自匹配 | P0 |
| UT-007 | 自定义 base_url 覆盖默认值 | 不被重置 | P0 |
| UT-008 | extra_headers 注入到请求头 | 合并后存在 | P1 |

### 3.3 单元测试 — 统一调度

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-009 | 同一 messages → 5 家 chat_completion | 全部返回 ChatResponse | P0 |
| UT-010 | 同一 messages → 4 家 stream (OpenAI 兼容) | 全部 yield ChatChunk | P0 |
| UT-011 | MiniMax stream (自有格式) | yield ChatChunk | P0 |
| UT-012 | 5 家 list_models | 全部返回 ModelInfo[] | P0 |
| UT-013 | 返回值字段完整性 (content/model/finish_reason/usage) | 全字段非空 | P0 |

### 3.4 单元测试 — 配置校验

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-014 | 有效 config → validate_config True | 5 家一致 | P0 |
| UT-015 | 空 api_key → validate_config False | 5 家一致 | P0 |
| UT-016 | 空 base_url → 默认填充后 True | P1 |
| UT-017 | extra_params 透传到请求体 | kwargs 保留 | P1 |

### 3.5 单元测试 — 错误传播

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-018 | HTTP 500 → APIError (4 家 OpenAI 兼容) | provider 字段正确 | P0 |
| UT-019 | HTTP 429 → RateLimitError (全厂商) | P0 |
| UT-020 | 非 JSON 响应 → ParseError | provider 字段正确 | P0 |
| UT-021 | MiniMax 业务错误码 → APIError | status_code 为业务码 | P0 |
| UT-022 | 空消息列表 → ValueError | 不到网络层 | P1 |

### 3.6 集成测试 — 适配器 ↔ FallbackRouter

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| IT-001 | Registry 查找 → 实例化 → Router 执行 | 首选成功 | P0 |
| IT-002 | 首选厂商异常 → Fallback 到次选 | 自动切换 | P0 |
| IT-003 | 全部失败 → AllProvidersUnavailableError | tried 列表完整 | P0 |
| IT-004 | 3 家链式 Fallback | 第 3 家成功 | P1 |

### 3.7 集成测试 — 适配器 ↔ HealthChecker

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| IT-005 | 适配器成功 → HealthChecker 记录 healthy | status = HEALTHY | P0 |
| IT-006 | 适配器失败 → HealthChecker 记录失败 → 状态降级 | status = UNHEALTHY | P0 |
| IT-007 | HealthChecker 状态影响 FallbackRouter 排序 | 健康优先 | P1 |

### 3.8 边界/异常测试

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| ET-001 | Registry 清空后调度 | KeyError | P1 |
| ET-002 | 超长 content (100K chars) | 请求体正确构建 | P1 |
| ET-003 | 并发 5 家同时调用 | 全部成功无串扰 | P1 |
| ET-004 | 同一适配器连续 100 次调用 | 无状态泄漏 | P2 |

## 4. 测试环境

- Python 3.x + pytest + pytest-asyncio
- Mock 模拟厂商 HTTP 响应
- 不做真实网络调用

## 5. 通过标准

- 所有 P0 用例通过
- P1 用例通过率 ≥ 90%
- 错误 provider 字段 100% 正确
