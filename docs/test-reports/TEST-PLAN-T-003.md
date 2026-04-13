# 测试方案: PRJ-LITE999-T-003 核心数据模型与协议定义

## 1. 测试概述

| 项目 | 内容 |
|------|------|
| **任务编号** | PRJ-LITE999-T-003 |
| **任务名称** | 核心数据模型与协议定义 |
| **功能描述** | 统一数据结构 (ChatMessage/ChatResponse/ChatChunk/ModelInfo/AdapterConfig)、异常体系 (APIError/ParseError/RateLimitError)、基类协议契约 (BaseAdapter 抽象接口与通用方法) |
| **被依赖** | T-005 厂商适配器、T-007 统一调度、T-008 健康检查、T-009 Fallback、T-013 透传 |
| **测试类型** | 单元测试 + 边界/异常测试 |
| **技术栈** | Python 3 + pytest |
| **测试日期** | 2026-04-11 |

## 2. 与其他任务的关系

T-003 测试所有上层模块共享的基础层，确保协议层的稳固性。T-005 以上任务通过具体厂商测试间接覆盖，本任务做**独立、系统性的基础层验证**。

## 3. 被测功能模块

### 3.1 数据结构
- `AdapterConfig`: api_key / base_url / timeout / extra_headers / extra_params
- `ChatMessage`: role / content
- `ChatResponse`: content / model / finish_reason / usage / raw
- `ChatChunk`: delta_content / finish_reason
- `ModelInfo`: id / name / context_length / provider

### 3.2 异常体系
- `APIError`: status_code / message / provider / 字符串格式
- `ParseError`: message / raw_body / provider / 字符串格式
- `RateLimitError(APIError)`: 继承关系 / retry_after / status_code 固定 429

### 3.3 BaseAdapter 协议契约
- 抽象基类不可直接实例化
- `validate_config()` 逻辑
- `_build_headers()`: Authorization / Content-Type / extra_headers 合并
- `_build_messages_payload()`: ChatMessage → dict 列表 / 空列表校验
- `_parse_json_response()`: JSON 解析 / 非 JSON 异常
- `_handle_error_status()`: 状态码分发 (429→RateLimitError, 4xx/5xx→APIError, 2xx→无异常)

### 3.4 AdapterRegistry 基础操作
- register / get / list_all / clear

## 4. 测试用例设计

### 4.1 数据结构 (UT-001 ~ UT-012)

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-001 | AdapterConfig 默认值 | timeout=60, 空 dict 字段 | P0 |
| UT-002 | AdapterConfig 自定义全字段 | 所有字段正确存取 | P0 |
| UT-003 | ChatMessage 构造 | role + content 正确 | P0 |
| UT-004 | ChatResponse 完整字段 | 含 usage / raw | P0 |
| UT-005 | ChatResponse 默认值 | usage/raw 为空 dict | P0 |
| UT-006 | ChatChunk 默认值 | delta_content="" / finish_reason=None | P0 |
| UT-007 | ChatChunk 带 finish_reason | 值正确 | P0 |
| UT-008 | ModelInfo 完整字段 | id/name/context_length/provider | P0 |
| UT-009 | ModelInfo 默认值 | context_length=0, provider="" | P1 |
| UT-010 | dataclass 相等性 | 同值对象 == True | P1 |
| UT-011 | dataclass 不等性 | 不同值 == False | P1 |
| UT-012 | AdapterConfig extra_headers 独立性 | 不同实例不共享 mutable default | P0 |

### 4.2 异常体系 (UT-013 ~ UT-022)

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-013 | APIError 属性 | status_code / message / provider | P0 |
| UT-014 | APIError 字符串格式 | "[provider] HTTP xxx: msg" | P0 |
| UT-015 | APIError 可 catch 为 Exception | 继承链正确 | P0 |
| UT-016 | ParseError 属性 | message / raw_body / provider | P0 |
| UT-017 | ParseError 字符串格式 | "[provider] Parse error: msg" | P0 |
| UT-018 | RateLimitError 继承 APIError | isinstance 检查 | P0 |
| UT-019 | RateLimitError status_code 固定 429 | 不可覆盖 | P0 |
| UT-020 | RateLimitError retry_after | 可选字段 | P1 |
| UT-021 | 异常可序列化 str() | 不崩溃 | P1 |
| UT-022 | 异常 try/except 层级 | catch APIError 捕获 RateLimitError | P0 |

### 4.3 BaseAdapter 协议 (UT-023 ~ UT-036)

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-023 | 不可直接实例化 | TypeError | P0 |
| UT-024 | 子类实现所有方法可实例化 | 成功 | P0 |
| UT-025 | validate_config — 有效 | True | P0 |
| UT-026 | validate_config — 无 api_key | False | P0 |
| UT-027 | validate_config — 无 base_url | False | P0 |
| UT-028 | validate_config — 两者皆空 | False | P0 |
| UT-029 | _build_headers 基础 | Authorization + Content-Type | P0 |
| UT-030 | _build_headers + extra | 合并自定义头 | P0 |
| UT-031 | _build_headers extra 覆盖 | 自定义头覆盖默认头 | P1 |
| UT-032 | _build_messages_payload 正常 | dict 列表 | P0 |
| UT-033 | _build_messages_payload 空列表 | ValueError | P0 |
| UT-034 | _parse_json_response 正常 | dict | P0 |
| UT-035 | _parse_json_response 非 JSON | ParseError | P0 |
| UT-036 | _handle_error_status 分发 | 429→RateLimitError, 500→APIError, 200→无 | P0 |

### 4.4 AdapterRegistry (UT-037 ~ UT-040)

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| UT-037 | register + get | 正确取回 | P0 |
| UT-038 | get 不存在 | KeyError | P0 |
| UT-039 | list_all | 返回全部 | P0 |
| UT-040 | clear | 清空后为空 | P0 |

### 4.5 边界/异常 (ET-001 ~ ET-008)

| 用例编号 | 测试场景 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| ET-001 | 超长 api_key (10000 字符) | 不截断 | P1 |
| ET-002 | 特殊字符 content (emoji/unicode) | 正确存储 | P1 |
| ET-003 | ChatResponse raw 嵌套深层 dict | 正确存取 | P1 |
| ET-004 | _parse_json_response 空字符串 | ParseError | P1 |
| ET-005 | _parse_json_response None | ParseError | P1 |
| ET-006 | _handle_error_status 全状态码扫描 | 边界 399/400/428/429/430/500 | P1 |
| ET-007 | APIError message 超长 (10000) | 不截断 | P2 |
| ET-008 | 多个 ChatMessage 不同 role | 正确构建 payload | P1 |

## 5. 通过标准

- 所有 P0 用例通过
- P1 用例通过率 ≥ 90%
- 异常继承链 100% 正确
- 数据结构默认值 100% 正确
