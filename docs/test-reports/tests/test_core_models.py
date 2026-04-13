"""
PRJ-LITE999-T-003 测试用例
核心数据模型与协议定义

覆盖：数据结构 (UT)、异常体系 (UT)、BaseAdapter 协议 (UT)、
      AdapterRegistry (UT)、边界/异常 (ET)
"""

import json
from dataclasses import FrozenInstanceError

import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.adapters.base import (
    AdapterConfig,
    ChatMessage,
    ChatResponse,
    ChatChunk,
    ModelInfo,
    APIError,
    ParseError,
    RateLimitError,
    BaseAdapter,
    AdapterRegistry,
)


# ============================================================
# Helpers: 最小具体子类用于测试 BaseAdapter 的非抽象方法
# ============================================================

class StubAdapter(BaseAdapter):
    """最小具体实现 — 仅用于测试 BaseAdapter 通用方法"""
    PROVIDER_NAME = "stub"

    async def chat_completion(self, messages, model, **kwargs):
        return ChatResponse(content="stub", model=model, finish_reason="stop")

    async def stream_chat_completion(self, messages, model, **kwargs):
        yield ChatChunk(delta_content="stub")

    async def list_models(self):
        return [ModelInfo(id="stub-1", name="Stub Model")]


@pytest.fixture(autouse=True)
def restore_registry():
    """每个测试后恢复 Registry 状态"""
    saved = dict(AdapterRegistry._adapters)
    yield
    AdapterRegistry._adapters = saved


# ============================================================
# UT-001 ~ UT-012: 数据结构
# ============================================================

class TestDataStructures:

    def test_ut001_adapter_config_defaults(self):
        """UT-001: AdapterConfig 默认值"""
        cfg = AdapterConfig()
        assert cfg.api_key == ""
        assert cfg.base_url == ""
        assert cfg.timeout == 60.0
        assert cfg.extra_headers == {}
        assert cfg.extra_params == {}

    def test_ut002_adapter_config_custom(self):
        """UT-002: AdapterConfig 自定义全字段"""
        cfg = AdapterConfig(
            api_key="sk-abc",
            base_url="https://api.example.com",
            timeout=30.0,
            extra_headers={"X-Custom": "val"},
            extra_params={"param1": "val1"},
        )
        assert cfg.api_key == "sk-abc"
        assert cfg.base_url == "https://api.example.com"
        assert cfg.timeout == 30.0
        assert cfg.extra_headers == {"X-Custom": "val"}
        assert cfg.extra_params == {"param1": "val1"}

    def test_ut003_chat_message(self):
        """UT-003: ChatMessage 构造"""
        msg = ChatMessage(role="user", content="Hello")
        assert msg.role == "user"
        assert msg.content == "Hello"

    def test_ut004_chat_response_full(self):
        """UT-004: ChatResponse 完整字段"""
        resp = ChatResponse(
            content="Hi",
            model="gpt-4",
            finish_reason="stop",
            usage={"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
            raw={"id": "chatcmpl-123", "object": "chat.completion"},
        )
        assert resp.content == "Hi"
        assert resp.model == "gpt-4"
        assert resp.finish_reason == "stop"
        assert resp.usage["total_tokens"] == 8
        assert resp.raw["id"] == "chatcmpl-123"

    def test_ut005_chat_response_defaults(self):
        """UT-005: ChatResponse 默认值"""
        resp = ChatResponse(content="x", model="m", finish_reason="stop")
        assert resp.usage == {}
        assert resp.raw == {}

    def test_ut006_chat_chunk_defaults(self):
        """UT-006: ChatChunk 默认值"""
        chunk = ChatChunk()
        assert chunk.delta_content == ""
        assert chunk.finish_reason is None

    def test_ut007_chat_chunk_with_finish(self):
        """UT-007: ChatChunk 带 finish_reason"""
        chunk = ChatChunk(delta_content="end", finish_reason="stop")
        assert chunk.delta_content == "end"
        assert chunk.finish_reason == "stop"

    def test_ut008_model_info_full(self):
        """UT-008: ModelInfo 完整字段"""
        mi = ModelInfo(id="gpt-4", name="GPT-4", context_length=128000, provider="openai")
        assert mi.id == "gpt-4"
        assert mi.name == "GPT-4"
        assert mi.context_length == 128000
        assert mi.provider == "openai"

    def test_ut009_model_info_defaults(self):
        """UT-009: ModelInfo 默认值"""
        mi = ModelInfo(id="m1", name="Model 1")
        assert mi.context_length == 0
        assert mi.provider == ""

    def test_ut010_dataclass_equality(self):
        """UT-010: 同值 dataclass 相等"""
        m1 = ChatMessage(role="user", content="hi")
        m2 = ChatMessage(role="user", content="hi")
        assert m1 == m2

        c1 = AdapterConfig(api_key="k", base_url="u")
        c2 = AdapterConfig(api_key="k", base_url="u")
        assert c1 == c2

    def test_ut011_dataclass_inequality(self):
        """UT-011: 不同值 dataclass 不相等"""
        m1 = ChatMessage(role="user", content="hello")
        m2 = ChatMessage(role="user", content="world")
        assert m1 != m2

        r1 = ChatResponse(content="a", model="m", finish_reason="stop")
        r2 = ChatResponse(content="b", model="m", finish_reason="stop")
        assert r1 != r2

    def test_ut012_adapter_config_mutable_default_isolation(self):
        """UT-012: AdapterConfig extra_headers 不同实例不共享"""
        c1 = AdapterConfig()
        c2 = AdapterConfig()
        c1.extra_headers["X-A"] = "1"
        assert "X-A" not in c2.extra_headers

        c1.extra_params["p"] = "v"
        assert "p" not in c2.extra_params


# ============================================================
# UT-013 ~ UT-022: 异常体系
# ============================================================

class TestExceptionHierarchy:

    def test_ut013_api_error_attributes(self):
        """UT-013: APIError 属性"""
        err = APIError(status_code=500, message="Internal Server Error", provider="qwen")
        assert err.status_code == 500
        assert err.message == "Internal Server Error"
        assert err.provider == "qwen"

    def test_ut014_api_error_string_format(self):
        """UT-014: APIError 字符串格式"""
        err = APIError(status_code=403, message="Forbidden", provider="glm")
        s = str(err)
        assert "[glm]" in s
        assert "403" in s
        assert "Forbidden" in s

    def test_ut015_api_error_is_exception(self):
        """UT-015: APIError 可 catch 为 Exception"""
        err = APIError(500, "err", "p")
        assert isinstance(err, Exception)
        with pytest.raises(Exception):
            raise err

    def test_ut016_parse_error_attributes(self):
        """UT-016: ParseError 属性"""
        err = ParseError(message="unexpected token", raw_body="<html>", provider="kimi")
        assert err.message == "unexpected token"
        assert err.raw_body == "<html>"
        assert err.provider == "kimi"

    def test_ut017_parse_error_string_format(self):
        """UT-017: ParseError 字符串格式"""
        err = ParseError(message="bad json", provider="doubao")
        s = str(err)
        assert "[doubao]" in s
        assert "Parse error" in s
        assert "bad json" in s

    def test_ut018_rate_limit_inherits_api_error(self):
        """UT-018: RateLimitError 继承 APIError"""
        err = RateLimitError(message="too fast", provider="minimax")
        assert isinstance(err, APIError)
        assert isinstance(err, Exception)

    def test_ut019_rate_limit_status_code_429(self):
        """UT-019: RateLimitError status_code 固定 429"""
        err = RateLimitError(message="rate limited", provider="qwen")
        assert err.status_code == 429

    def test_ut020_rate_limit_retry_after(self):
        """UT-020: RateLimitError retry_after"""
        err = RateLimitError(retry_after=30.0)
        assert err.retry_after == 30.0

        err2 = RateLimitError()
        assert err2.retry_after is None

    def test_ut021_exceptions_serializable(self):
        """UT-021: 异常可 str() — 不崩溃"""
        assert str(APIError(500, "err", "p"))
        assert str(ParseError("msg", "<>", "p"))
        assert str(RateLimitError("rate", "p", 10.0))

    def test_ut022_catch_hierarchy(self):
        """UT-022: catch APIError 捕获 RateLimitError"""
        with pytest.raises(APIError):
            raise RateLimitError(message="limited", provider="test")

        # 反向: catch RateLimitError 不捕获普通 APIError
        with pytest.raises(APIError):
            raise APIError(500, "err", "p")
        try:
            raise APIError(500, "err", "p")
        except RateLimitError:
            pytest.fail("APIError should not be caught by RateLimitError")
        except APIError:
            pass  # correct


# ============================================================
# UT-023 ~ UT-036: BaseAdapter 协议契约
# ============================================================

class TestBaseAdapterProtocol:

    def test_ut023_cannot_instantiate_directly(self):
        """UT-023: BaseAdapter 抽象类不可直接实例化"""
        with pytest.raises(TypeError):
            BaseAdapter(AdapterConfig())

    def test_ut024_concrete_subclass_ok(self):
        """UT-024: 具体子类实现所有方法可实例化"""
        adapter = StubAdapter(AdapterConfig(api_key="k", base_url="u"))
        assert adapter.PROVIDER_NAME == "stub"
        assert adapter.config.api_key == "k"

    def test_ut025_validate_config_valid(self):
        """UT-025: validate_config — 有效配置"""
        adapter = StubAdapter(AdapterConfig(api_key="sk-test", base_url="https://api.example.com"))
        assert adapter.validate_config() is True

    def test_ut026_validate_config_no_api_key(self):
        """UT-026: validate_config — 无 api_key"""
        adapter = StubAdapter(AdapterConfig(api_key="", base_url="https://api.example.com"))
        assert adapter.validate_config() is False

    def test_ut027_validate_config_no_base_url(self):
        """UT-027: validate_config — 无 base_url"""
        adapter = StubAdapter(AdapterConfig(api_key="sk-test", base_url=""))
        assert adapter.validate_config() is False

    def test_ut028_validate_config_both_empty(self):
        """UT-028: validate_config — 两者皆空"""
        adapter = StubAdapter(AdapterConfig())
        assert adapter.validate_config() is False

    def test_ut029_build_headers_basic(self):
        """UT-029: _build_headers 基础 — Authorization + Content-Type"""
        adapter = StubAdapter(AdapterConfig(api_key="sk-abc", base_url="u"))
        headers = adapter._build_headers()
        assert headers["Authorization"] == "Bearer sk-abc"
        assert headers["Content-Type"] == "application/json"

    def test_ut030_build_headers_extra(self):
        """UT-030: _build_headers + extra_headers 合并"""
        adapter = StubAdapter(AdapterConfig(
            api_key="sk", base_url="u",
            extra_headers={"X-Trace": "t1", "X-Org": "o1"},
        ))
        headers = adapter._build_headers()
        assert headers["X-Trace"] == "t1"
        assert headers["X-Org"] == "o1"
        assert headers["Authorization"] == "Bearer sk"

    def test_ut031_build_headers_extra_overrides_default(self):
        """UT-031: extra_headers 可覆盖默认头"""
        adapter = StubAdapter(AdapterConfig(
            api_key="sk", base_url="u",
            extra_headers={"Content-Type": "text/plain"},
        ))
        headers = adapter._build_headers()
        assert headers["Content-Type"] == "text/plain"

    def test_ut032_build_messages_payload_normal(self):
        """UT-032: _build_messages_payload 正常转换"""
        adapter = StubAdapter(AdapterConfig())
        msgs = [
            ChatMessage(role="system", content="You are helpful."),
            ChatMessage(role="user", content="Hi"),
            ChatMessage(role="assistant", content="Hello!"),
        ]
        payload = adapter._build_messages_payload(msgs)
        assert len(payload) == 3
        assert payload[0] == {"role": "system", "content": "You are helpful."}
        assert payload[1] == {"role": "user", "content": "Hi"}
        assert payload[2] == {"role": "assistant", "content": "Hello!"}

    def test_ut033_build_messages_payload_empty(self):
        """UT-033: _build_messages_payload 空列表 → ValueError"""
        adapter = StubAdapter(AdapterConfig())
        with pytest.raises(ValueError, match="empty"):
            adapter._build_messages_payload([])

    def test_ut034_parse_json_response_valid(self):
        """UT-034: _parse_json_response 合法 JSON"""
        adapter = StubAdapter(AdapterConfig())
        adapter.PROVIDER_NAME = "test"
        data = adapter._parse_json_response('{"key": "value", "num": 42}')
        assert data == {"key": "value", "num": 42}

    def test_ut035_parse_json_response_invalid(self):
        """UT-035: _parse_json_response 非 JSON → ParseError"""
        adapter = StubAdapter(AdapterConfig())
        adapter.PROVIDER_NAME = "test_provider"
        with pytest.raises(ParseError) as exc:
            adapter._parse_json_response("<html>not json</html>")
        assert exc.value.provider == "test_provider"

    def test_ut036_handle_error_status_dispatch(self):
        """UT-036: _handle_error_status 状态码分发"""
        adapter = StubAdapter(AdapterConfig())
        adapter.PROVIDER_NAME = "dispatch_test"

        # 200 — 无异常
        adapter._handle_error_status(200, "OK")

        # 429 → RateLimitError
        with pytest.raises(RateLimitError) as exc:
            adapter._handle_error_status(429, "Rate limited")
        assert exc.value.status_code == 429
        assert exc.value.provider == "dispatch_test"

        # 500 → APIError
        with pytest.raises(APIError) as exc:
            adapter._handle_error_status(500, "Server error")
        assert exc.value.status_code == 500

        # 400 → APIError
        with pytest.raises(APIError) as exc:
            adapter._handle_error_status(400, "Bad request")
        assert exc.value.status_code == 400


# ============================================================
# UT-037 ~ UT-040: AdapterRegistry 基础操作
# ============================================================

class TestAdapterRegistryBasic:

    def test_ut037_register_and_get(self):
        """UT-037: register + get"""
        AdapterRegistry.clear()
        AdapterRegistry.register("stub", StubAdapter)
        assert AdapterRegistry.get("stub") is StubAdapter

    def test_ut038_get_nonexistent(self):
        """UT-038: get 不存在 → KeyError"""
        AdapterRegistry.clear()
        with pytest.raises(KeyError, match="nonexistent"):
            AdapterRegistry.get("nonexistent")

    def test_ut039_list_all(self):
        """UT-039: list_all"""
        AdapterRegistry.clear()
        AdapterRegistry.register("a", StubAdapter)
        AdapterRegistry.register("b", StubAdapter)
        all_adapters = AdapterRegistry.list_all()
        assert len(all_adapters) == 2
        assert "a" in all_adapters
        assert "b" in all_adapters

    def test_ut040_clear(self):
        """UT-040: clear 清空后为空"""
        AdapterRegistry.register("temp", StubAdapter)
        AdapterRegistry.clear()
        assert len(AdapterRegistry.list_all()) == 0


# ============================================================
# ET-001 ~ ET-008: 边界/异常
# ============================================================

class TestEdgeCases:

    def test_et001_long_api_key(self):
        """ET-001: 超长 api_key (10000 字符)"""
        long_key = "sk-" + "x" * 10000
        cfg = AdapterConfig(api_key=long_key, base_url="https://api.example.com")
        adapter = StubAdapter(cfg)
        headers = adapter._build_headers()
        assert long_key in headers["Authorization"]
        assert adapter.validate_config() is True

    def test_et002_special_chars_content(self):
        """ET-002: 特殊字符 content (emoji/unicode)"""
        msgs = [
            ChatMessage(role="user", content="你好世界 🌍🚀 γεια σου κόσμε"),
        ]
        adapter = StubAdapter(AdapterConfig())
        payload = adapter._build_messages_payload(msgs)
        assert payload[0]["content"] == "你好世界 🌍🚀 γεια σου κόσμε"

    def test_et003_deep_nested_raw(self):
        """ET-003: ChatResponse raw 深层嵌套 dict"""
        deep = {"level1": {"level2": {"level3": {"level4": [1, 2, 3]}}}}
        resp = ChatResponse(content="x", model="m", finish_reason="stop", raw=deep)
        assert resp.raw["level1"]["level2"]["level3"]["level4"] == [1, 2, 3]

    def test_et004_parse_empty_string(self):
        """ET-004: _parse_json_response 空字符串 → ParseError"""
        adapter = StubAdapter(AdapterConfig())
        with pytest.raises(ParseError):
            adapter._parse_json_response("")

    def test_et005_parse_none(self):
        """ET-005: _parse_json_response None → ParseError"""
        adapter = StubAdapter(AdapterConfig())
        with pytest.raises(ParseError):
            adapter._parse_json_response(None)

    def test_et006_handle_error_status_boundary_scan(self):
        """ET-006: _handle_error_status 全状态码边界扫描"""
        adapter = StubAdapter(AdapterConfig())
        adapter.PROVIDER_NAME = "scan"

        # 2xx/3xx → 无异常
        for code in [200, 201, 204, 301, 302, 399]:
            adapter._handle_error_status(code, "ok")  # 不抛异常

        # 400+ → APIError
        for code in [400, 401, 403, 404, 500, 502, 503]:
            with pytest.raises(APIError):
                adapter._handle_error_status(code, f"error-{code}")

        # 429 → RateLimitError (是 APIError 子类)
        with pytest.raises(RateLimitError):
            adapter._handle_error_status(429, "rate limited")

        # 428 → APIError (不是 RateLimitError)
        try:
            adapter._handle_error_status(428, "precondition")
        except RateLimitError:
            pytest.fail("428 should not raise RateLimitError")
        except APIError:
            pass  # correct

        # 430 → APIError (不是 RateLimitError)
        try:
            adapter._handle_error_status(430, "whatever")
        except RateLimitError:
            pytest.fail("430 should not raise RateLimitError")
        except APIError:
            pass

    def test_et007_api_error_long_message(self):
        """ET-007: APIError message 超长"""
        long_msg = "E" * 10000
        err = APIError(500, long_msg, "provider")
        assert len(err.message) == 10000
        assert str(err)  # 不崩溃

    def test_et008_multi_role_messages(self):
        """ET-008: 多个 ChatMessage 不同 role 正确构建"""
        msgs = [
            ChatMessage(role="system", content="You are a bot."),
            ChatMessage(role="user", content="Q1"),
            ChatMessage(role="assistant", content="A1"),
            ChatMessage(role="user", content="Q2"),
        ]
        adapter = StubAdapter(AdapterConfig())
        payload = adapter._build_messages_payload(msgs)
        assert len(payload) == 4
        roles = [p["role"] for p in payload]
        assert roles == ["system", "user", "assistant", "user"]
