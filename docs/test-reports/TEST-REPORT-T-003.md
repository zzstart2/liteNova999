# 测试报告: PRJ-LITE999-T-003 核心数据模型与协议定义

## 基本信息

| 项目 | 内容 |
|------|------|
| **任务编号** | PRJ-LITE999-T-003 |
| **任务名称** | 核心数据模型与协议定义 |
| **功能描述** | 统一数据结构、异常体系、BaseAdapter 协议契约、AdapterRegistry 基础操作 |
| **测试日期** | 2026-04-11 |
| **测试环境** | Python 3.11.6 / pytest 9.0.3 / Linux x86_64 |
| **测试耗时** | 0.13s (T-003) / 0.95s (全量回归) |

## 测试结果概览

| 类别 | 总计 | 通过 | 失败 | 通过率 |
|------|------|------|------|--------|
| **数据结构 (UT-001~012)** | 12 | 12 | 0 | 100% |
| **异常体系 (UT-013~022)** | 10 | 10 | 0 | 100% |
| **BaseAdapter 协议 (UT-023~036)** | 14 | 14 | 0 | 100% |
| **AdapterRegistry (UT-037~040)** | 4 | 4 | 0 | 100% |
| **边界/异常 (ET-001~008)** | 8 | 8 | 0 | 100% |
| **合计** | **48** | **48** | **0** | **100%** |

## 🐛 发现并修复的缺陷

### BUG-001: `_parse_json_response(None)` 崩溃

| 项目 | 内容 |
|------|------|
| **发现用例** | ET-005 |
| **严重度** | Medium |
| **文件** | `src/adapters/base.py` 第 143 行 |
| **现象** | `_parse_json_response(None)` 触发 `TypeError: 'NoneType' object is not subscriptable` |
| **根因** | `raw_body=text[:500]` 在 `text=None` 时无法切片 |
| **修复** | `raw_body=(text or "")[:500]` — 空值安全处理 |
| **影响范围** | 当厂商 HTTP 响应体为 None (如连接异常后) 调用解析时会崩溃而非返回可处理的 ParseError |
| **回归** | 修复后全量 429 测试通过，无副作用 |

## 详细结果

### 数据结构 (UT-001 ~ UT-012)

| 用例 | 场景 | 结果 |
|------|------|------|
| UT-001 | AdapterConfig 默认值 (timeout=60, 空 dict) | ✅ PASS |
| UT-002 | AdapterConfig 自定义全字段 | ✅ PASS |
| UT-003 | ChatMessage 构造 | ✅ PASS |
| UT-004 | ChatResponse 完整字段 (含 usage/raw) | ✅ PASS |
| UT-005 | ChatResponse 默认值 (usage/raw 空 dict) | ✅ PASS |
| UT-006 | ChatChunk 默认值 (delta=""，finish=None) | ✅ PASS |
| UT-007 | ChatChunk 带 finish_reason | ✅ PASS |
| UT-008 | ModelInfo 完整字段 | ✅ PASS |
| UT-009 | ModelInfo 默认值 (context_length=0) | ✅ PASS |
| UT-010 | dataclass 相等性 — 同值 == True | ✅ PASS |
| UT-011 | dataclass 不等性 — 不同值 != True | ✅ PASS |
| UT-012 | AdapterConfig mutable default 隔离 | ✅ PASS |

### 异常体系 (UT-013 ~ UT-022)

| 用例 | 场景 | 结果 |
|------|------|------|
| UT-013 | APIError 属性 (status_code/message/provider) | ✅ PASS |
| UT-014 | APIError 字符串格式 "[provider] HTTP xxx: msg" | ✅ PASS |
| UT-015 | APIError 是 Exception 子类 | ✅ PASS |
| UT-016 | ParseError 属性 (message/raw_body/provider) | ✅ PASS |
| UT-017 | ParseError 字符串格式 "[provider] Parse error: msg" | ✅ PASS |
| UT-018 | RateLimitError 继承 APIError — isinstance 检查 | ✅ PASS |
| UT-019 | RateLimitError status_code 固定 429 | ✅ PASS |
| UT-020 | RateLimitError retry_after 可选字段 | ✅ PASS |
| UT-021 | 三种异常 str() 不崩溃 | ✅ PASS |
| UT-022 | catch APIError 捕获 RateLimitError；反向不捕获 | ✅ PASS |

### BaseAdapter 协议 (UT-023 ~ UT-036)

| 用例 | 场景 | 结果 |
|------|------|------|
| UT-023 | 抽象类不可直接实例化 → TypeError | ✅ PASS |
| UT-024 | 具体子类实现全部方法可实例化 | ✅ PASS |
| UT-025 | validate_config — 有效 → True | ✅ PASS |
| UT-026 | validate_config — 无 api_key → False | ✅ PASS |
| UT-027 | validate_config — 无 base_url → False | ✅ PASS |
| UT-028 | validate_config — 两者皆空 → False | ✅ PASS |
| UT-029 | _build_headers — Authorization + Content-Type | ✅ PASS |
| UT-030 | _build_headers — extra_headers 合并 | ✅ PASS |
| UT-031 | _build_headers — extra 覆盖默认 Content-Type | ✅ PASS |
| UT-032 | _build_messages_payload — 3 条消息正确转换 | ✅ PASS |
| UT-033 | _build_messages_payload — 空列表 → ValueError | ✅ PASS |
| UT-034 | _parse_json_response — 合法 JSON | ✅ PASS |
| UT-035 | _parse_json_response — 非 JSON → ParseError | ✅ PASS |
| UT-036 | _handle_error_status — 429→RateLimitError, 500→APIError, 200→无 | ✅ PASS |

### AdapterRegistry (UT-037 ~ UT-040)

| 用例 | 场景 | 结果 |
|------|------|------|
| UT-037 | register + get 正确取回 | ✅ PASS |
| UT-038 | get 不存在 → KeyError | ✅ PASS |
| UT-039 | list_all 返回全部 | ✅ PASS |
| UT-040 | clear 清空后为空 | ✅ PASS |

### 边界/异常 (ET-001 ~ ET-008)

| 用例 | 场景 | 结果 |
|------|------|------|
| ET-001 | 超长 api_key (10000 字符) 不截断 | ✅ PASS |
| ET-002 | emoji/unicode content 正确存储 | ✅ PASS |
| ET-003 | ChatResponse raw 4 层嵌套 dict | ✅ PASS |
| ET-004 | _parse_json_response 空字符串 → ParseError | ✅ PASS |
| ET-005 | _parse_json_response None → ParseError | ✅ PASS (修复后) |
| ET-006 | _handle_error_status 全状态码边界 (399/400/428/429/430/500) | ✅ PASS |
| ET-007 | APIError message 10000 字符不截断 | ✅ PASS |
| ET-008 | 多 role 消息 (system/user/assistant/user) 正确构建 | ✅ PASS |

## 验收结论

| 标准 | 要求 | 实际 | 状态 |
|------|------|------|------|
| P0 用例全部通过 | 100% | 100% | ✅ |
| P1 用例通过率 ≥ 90% | ≥ 90% | 100% | ✅ |
| 异常继承链 100% 正确 | 100% | 100% | ✅ |
| 数据结构默认值 100% 正确 | 100% | 100% | ✅ |
| 全量回归 | 全通过 | 429/429 | ✅ |

### ✅ 结论: T-003 测试通过（含 1 个缺陷修复），可进入下一阶段。

## 测试执行日志 (摘要)

```
# 首次执行: 发现 BUG-001
$ python -m pytest tests/test_core_models.py -v
47 passed, 1 failed (ET-005)

# 修复 src/adapters/base.py 后
$ python -m pytest tests/test_core_models.py -v
48 passed in 0.13s

# 全量回归
$ python -m pytest tests/
429 passed in 0.95s
```

## 文件清单

| 文件 | 说明 |
|------|------|
| `docs/TEST-PLAN-T-003.md` | 测试方案 |
| `docs/TEST-REPORT-T-003.md` | 本报告 |
| `src/adapters/base.py` | 核心数据模型与协议 **(含 BUG-001 修复)** |
| `tests/test_core_models.py` | 测试用例 (48 条) |
