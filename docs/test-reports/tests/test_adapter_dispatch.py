"""
PRJ-LITE999-T-007 测试用例
统一接口调度与适配器生命周期管理

覆盖：Registry 高级操作 (UT)、工厂实例化 (UT)、统一调度 (UT)、
      配置校验 (UT)、错误传播 (UT)、集成 (IT)、边界/异常 (ET)
"""

import asyncio
import json
import copy
from unittest.mock import AsyncMock, MagicMock

import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.adapters.base import (
    BaseAdapter, AdapterConfig, AdapterRegistry,
    ChatMessage, ChatResponse, ChatChunk, ModelInfo,
    APIError, ParseError, RateLimitError,
)
from src.adapters.qwen import QwenAdapter
from src.adapters.doubao import DoubaoAdapter
from src.adapters.glm import GLMAdapter
from src.adapters.kimi import KimiAdapter
from src.adapters.minimax import MiniMaxAdapter
from src.health_checker import HealthChecker, HealthStatus, CheckResult
from src.fallback_router import (
    FallbackRouter, ProviderConfig,
    AllProvidersUnavailableError, CircuitState,
)


# ============================================================
# Constants & Helpers
# ============================================================

ALL_ADAPTERS = {
    "qwen": (QwenAdapter, "https://dashscope.aliyuncs.com/compatible-mode/v1"),
    "doubao": (DoubaoAdapter, "https://ark.cn-beijing.volces.com/api/v3"),
    "glm": (GLMAdapter, "https://open.bigmodel.cn/api/paas/v4"),
    "kimi": (KimiAdapter, "https://api.moonshot.cn/v1"),
    "minimax": (MiniMaxAdapter, "https://api.minimax.chat/v1"),
}

OPENAI_COMPAT_NAMES = ["qwen", "doubao", "glm", "kimi"]


def make_config(api_key="sk-test", base_url="", **kw):
    return AdapterConfig(api_key=api_key, base_url=base_url, **kw)


def sample_messages():
    return [
        ChatMessage(role="system", content="You are helpful."),
        ChatMessage(role="user", content="Hello"),
    ]


def mock_openai_response(content="Hi", model="test-model"):
    return json.dumps({
        "id": "chatcmpl-1", "model": model,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
    })


def mock_minimax_response(content="Hi", model="MiniMax-Text-01"):
    return json.dumps({
        "model": model,
        "choices": [{"messages": [{"sender_type": "BOT", "sender_name": "assistant", "text": content}], "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
        "base_resp": {"status_code": 0, "status_msg": "success"},
    })


class AsyncIterLines:
    def __init__(self, lines):
        self._lines = list(lines)
        self._i = 0
    def __aiter__(self):
        return self
    async def __anext__(self):
        if self._i >= len(self._lines):
            raise StopAsyncIteration
        v = self._lines[self._i]
        self._i += 1
        return v


def make_mock_response(status=200, text="", lines=None):
    resp = AsyncMock()
    resp.status = status
    resp.text = AsyncMock(return_value=text)
    if lines is not None:
        resp.content = AsyncIterLines(lines)
    resp.__aenter__ = AsyncMock(return_value=resp)
    resp.__aexit__ = AsyncMock(return_value=False)
    return resp


def make_mock_session(response):
    session = AsyncMock()
    session.post = MagicMock(return_value=response)
    return session


def mock_stream_lines(chunks, done=True):
    lines = [f"data: {json.dumps(c)}\n\n".encode() for c in chunks]
    if done:
        lines.append(b"data: [DONE]\n\n")
    return lines


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture(autouse=True)
def restore_registry():
    """确保每个测试不污染全局 Registry"""
    # 保存当前状态
    saved = dict(AdapterRegistry._adapters)
    yield
    # 恢复
    AdapterRegistry._adapters = saved


# ============================================================
# UT-001 ~ UT-004: Registry 高级操作
# ============================================================

class TestRegistryAdvanced:

    def test_ut001_full_enumeration(self):
        """UT-001: Registry 全量枚举 — 5 家全部注册"""
        all_adapters = AdapterRegistry.list_all()
        assert len(all_adapters) >= 5
        for name in ["qwen", "doubao", "glm", "kimi", "minimax"]:
            assert name in all_adapters

    def test_ut002_clear_and_reregister(self):
        """UT-002: Registry clear + 重新注册"""
        AdapterRegistry.clear()
        assert len(AdapterRegistry.list_all()) == 0

        AdapterRegistry.register("qwen", QwenAdapter)
        assert len(AdapterRegistry.list_all()) == 1
        assert AdapterRegistry.get("qwen") is QwenAdapter

    def test_ut003_get_nonexistent(self):
        """UT-003: 获取不存在的适配器 → KeyError"""
        with pytest.raises(KeyError, match="not_a_provider"):
            AdapterRegistry.get("not_a_provider")

    def test_ut004_overwrite_registration(self):
        """UT-004: 覆盖注册同名适配器"""
        # 用 DoubaoAdapter 覆盖 qwen
        AdapterRegistry.register("qwen", DoubaoAdapter)
        assert AdapterRegistry.get("qwen") is DoubaoAdapter


# ============================================================
# UT-005 ~ UT-008: 工厂实例化
# ============================================================

class TestFactoryInstantiation:

    def test_ut005_registry_get_and_instantiate(self):
        """UT-005: 通过 Registry.get + config 创建实例"""
        for name in ALL_ADAPTERS:
            cls = AdapterRegistry.get(name)
            adapter = cls(make_config())
            assert isinstance(adapter, BaseAdapter)
            assert adapter.PROVIDER_NAME == name

    def test_ut006_default_base_urls(self):
        """UT-006: 5 家适配器默认 base_url 正确"""
        for name, (cls, expected_url) in ALL_ADAPTERS.items():
            adapter = cls(make_config())
            assert adapter.config.base_url == expected_url, f"{name}: expected {expected_url}, got {adapter.config.base_url}"

    def test_ut007_custom_base_url_preserved(self):
        """UT-007: 自定义 base_url 不被默认值覆盖"""
        custom = "https://my-proxy.example.com/api"
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config(base_url=custom))
            assert adapter.config.base_url == custom, f"{name}: custom URL was overwritten"

    def test_ut008_extra_headers_injected(self):
        """UT-008: extra_headers 注入到请求头"""
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config(
                api_key="sk-test",
                extra_headers={"X-Trace-Id": "trace-007", "X-Org-Id": "org-1"},
            ))
            headers = adapter._build_headers()
            assert headers.get("X-Trace-Id") == "trace-007"
            assert headers.get("X-Org-Id") == "org-1"


# ============================================================
# UT-009 ~ UT-013: 统一调度
# ============================================================

class TestUnifiedDispatch:

    @pytest.mark.asyncio
    async def test_ut009_chat_completion_all_5(self):
        """UT-009: 同一 messages → 5 家 chat_completion 全部返回 ChatResponse"""
        msgs = sample_messages()
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config())
            if name == "minimax":
                resp_text = mock_minimax_response(content=f"from-{name}")
            else:
                resp_text = mock_openai_response(content=f"from-{name}")
            mock_resp = make_mock_response(status=200, text=resp_text)
            session = make_mock_session(mock_resp)

            result = await adapter.chat_completion(msgs, "test-model", _session=session)
            assert isinstance(result, ChatResponse), f"{name}: not ChatResponse"
            assert result.content == f"from-{name}"

    @pytest.mark.asyncio
    async def test_ut010_stream_openai_compat_4(self):
        """UT-010: 4 家 OpenAI 兼容 stream — 全部 yield ChatChunk"""
        chunks_data = [
            {"choices": [{"delta": {"content": "A"}, "finish_reason": None}]},
            {"choices": [{"delta": {"content": "B"}, "finish_reason": "stop"}]},
        ]
        lines = mock_stream_lines(chunks_data)

        for name in OPENAI_COMPAT_NAMES:
            cls = ALL_ADAPTERS[name][0]
            adapter = cls(make_config())
            mock_resp = make_mock_response(status=200, lines=list(lines))  # copy lines
            session = make_mock_session(mock_resp)

            collected = []
            async for chunk in adapter.stream_chat_completion(
                sample_messages(), "test-model", _session=session
            ):
                assert isinstance(chunk, ChatChunk), f"{name}: not ChatChunk"
                collected.append(chunk)
            assert len(collected) == 2, f"{name}: expected 2 chunks, got {len(collected)}"
            assert collected[0].delta_content == "A"

    @pytest.mark.asyncio
    async def test_ut011_minimax_stream(self):
        """UT-011: MiniMax 自有格式 stream"""
        chunks_data = [
            {"choices": [{"messages": [{"text": "M"}], "finish_reason": None}]},
            {"choices": [{"messages": [{"text": "X"}], "finish_reason": "stop"}]},
        ]
        lines = mock_stream_lines(chunks_data)
        adapter = MiniMaxAdapter(make_config())
        mock_resp = make_mock_response(status=200, lines=lines)
        session = make_mock_session(mock_resp)

        collected = []
        async for chunk in adapter.stream_chat_completion(
            sample_messages(), "test", _session=session
        ):
            assert isinstance(chunk, ChatChunk)
            collected.append(chunk)
        assert len(collected) == 2
        assert collected[0].delta_content == "M"
        assert collected[1].delta_content == "X"

    @pytest.mark.asyncio
    async def test_ut012_list_models_all_5(self):
        """UT-012: 5 家 list_models 全部返回 ModelInfo[]"""
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config())
            models = await adapter.list_models()
            assert len(models) >= 1, f"{name}: no models"
            for m in models:
                assert isinstance(m, ModelInfo)
                assert m.provider == name
                assert m.id
                assert m.name

    @pytest.mark.asyncio
    async def test_ut013_response_field_completeness(self):
        """UT-013: ChatResponse 字段完整性 (content/model/finish_reason/usage)"""
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config())
            if name == "minimax":
                resp_text = mock_minimax_response(content="test", model="mm-v1")
            else:
                resp_text = mock_openai_response(content="test", model="model-v1")
            mock_resp = make_mock_response(status=200, text=resp_text)
            session = make_mock_session(mock_resp)

            result = await adapter.chat_completion(
                sample_messages(), "model-v1", _session=session
            )
            assert result.content, f"{name}: empty content"
            assert result.model, f"{name}: empty model"
            assert result.finish_reason, f"{name}: empty finish_reason"
            assert isinstance(result.usage, dict), f"{name}: usage not dict"
            assert result.usage.get("total_tokens", 0) > 0, f"{name}: no total_tokens"


# ============================================================
# UT-014 ~ UT-017: 配置校验
# ============================================================

class TestConfigValidation:

    def test_ut014_valid_config_all_5(self):
        """UT-014: 有效 config → validate_config True (5 家一致)"""
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config(api_key="sk-valid"))
            assert adapter.validate_config() is True, f"{name}: should be valid"

    def test_ut015_empty_api_key_all_5(self):
        """UT-015: 空 api_key → validate_config False (5 家一致)"""
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config(api_key=""))
            assert adapter.validate_config() is False, f"{name}: should be invalid"

    def test_ut016_empty_base_url_defaults_filled(self):
        """UT-016: 空 base_url → 默认填充后 validate True"""
        for name, (cls, expected_url) in ALL_ADAPTERS.items():
            adapter = cls(make_config(api_key="sk-test", base_url=""))
            # 默认 URL 应该被填充
            assert adapter.config.base_url == expected_url
            assert adapter.validate_config() is True

    @pytest.mark.asyncio
    async def test_ut017_extra_params_passthrough(self):
        """UT-017: extra_params / kwargs 透传到请求体"""
        for name in OPENAI_COMPAT_NAMES:
            cls = ALL_ADAPTERS[name][0]
            adapter = cls(make_config())
            body = adapter._build_request_body(
                sample_messages(), "model-1",
                temperature=0.3, top_p=0.9, max_tokens=512
            )
            assert body["temperature"] == 0.3
            assert body["top_p"] == 0.9
            assert body["max_tokens"] == 512

        # MiniMax 特殊: max_tokens → tokens_to_generate
        mm = MiniMaxAdapter(make_config())
        body = mm._build_request_body(
            sample_messages(), "mm-model", max_tokens=1024
        )
        assert body["tokens_to_generate"] == 1024


# ============================================================
# UT-018 ~ UT-022: 错误传播
# ============================================================

class TestErrorPropagation:

    @pytest.mark.asyncio
    @pytest.mark.parametrize("name", OPENAI_COMPAT_NAMES)
    async def test_ut018_http_500_api_error(self, name):
        """UT-018: HTTP 500 → APIError, provider 字段正确"""
        cls = ALL_ADAPTERS[name][0]
        adapter = cls(make_config())
        mock_resp = make_mock_response(status=500, text="Internal Server Error")
        session = make_mock_session(mock_resp)

        with pytest.raises(APIError) as exc:
            await adapter.chat_completion(sample_messages(), "m", _session=session)
        assert exc.value.status_code == 500
        assert exc.value.provider == name

    @pytest.mark.asyncio
    async def test_ut019_http_429_rate_limit_all(self):
        """UT-019: HTTP 429 → RateLimitError (全厂商)"""
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config())
            mock_resp = make_mock_response(status=429, text="Rate limited")
            session = make_mock_session(mock_resp)

            with pytest.raises(RateLimitError) as exc:
                await adapter.chat_completion(sample_messages(), "m", _session=session)
            assert exc.value.status_code == 429
            assert exc.value.provider == name

    @pytest.mark.asyncio
    @pytest.mark.parametrize("name", OPENAI_COMPAT_NAMES)
    async def test_ut020_non_json_parse_error(self, name):
        """UT-020: 非 JSON 响应 → ParseError, provider 正确"""
        cls = ALL_ADAPTERS[name][0]
        adapter = cls(make_config())
        mock_resp = make_mock_response(status=200, text="<html>oops</html>")
        session = make_mock_session(mock_resp)

        with pytest.raises(ParseError) as exc:
            await adapter.chat_completion(sample_messages(), "m", _session=session)
        assert exc.value.provider == name

    @pytest.mark.asyncio
    async def test_ut021_minimax_business_error(self):
        """UT-021: MiniMax 业务错误码 → APIError"""
        adapter = MiniMaxAdapter(make_config())
        resp_data = json.dumps({
            "model": "mm", "choices": [],
            "base_resp": {"status_code": 1004, "status_msg": "Invalid parameters"},
        })
        mock_resp = make_mock_response(status=200, text=resp_data)
        session = make_mock_session(mock_resp)

        with pytest.raises(APIError) as exc:
            await adapter.chat_completion(sample_messages(), "mm", _session=session)
        assert exc.value.status_code == 1004
        assert exc.value.provider == "minimax"

    def test_ut022_empty_messages_value_error(self):
        """UT-022: 空消息列表 → ValueError (不到网络层)"""
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config())
            with pytest.raises(ValueError, match="empty"):
                adapter._build_messages_payload([])


# ============================================================
# IT-001 ~ IT-004: 适配器 ↔ FallbackRouter
# ============================================================

class TestAdapterFallbackIntegration:

    @pytest.mark.asyncio
    async def test_it001_registry_to_router_success(self):
        """IT-001: Registry 查找 → 实例化 → Router 首选成功"""
        providers = [
            ProviderConfig(name="qwen", priority=0),
            ProviderConfig(name="glm", priority=1),
        ]
        router = FallbackRouter(model="gpt-4", providers=providers, failure_threshold=3)

        # 通过 Registry 创建适配器
        adapters = {}
        for p in providers:
            cls = AdapterRegistry.get(p.name)
            adapters[p.name] = cls(make_config())

        call_log = []

        async def action(provider_name):
            call_log.append(provider_name)
            return ChatResponse(
                content=f"ok-from-{provider_name}",
                model="test", finish_reason="stop", usage={"total_tokens": 5},
            )

        result = await router.execute(action)
        assert result.content == "ok-from-qwen"
        assert call_log == ["qwen"]  # 首选成功，不 fallback

    @pytest.mark.asyncio
    async def test_it002_fallback_on_first_failure(self):
        """IT-002: 首选厂商异常 → Fallback 到次选"""
        providers = [
            ProviderConfig(name="qwen", priority=0),
            ProviderConfig(name="doubao", priority=1),
        ]
        router = FallbackRouter(model="test", providers=providers, failure_threshold=3)

        call_log = []

        async def action(provider_name):
            call_log.append(provider_name)
            if provider_name == "qwen":
                raise ConnectionError("qwen down")
            return ChatResponse(
                content="doubao-ok", model="test", finish_reason="stop",
                usage={"total_tokens": 5},
            )

        result = await router.execute(action)
        assert result.content == "doubao-ok"
        assert call_log == ["qwen", "doubao"]

    @pytest.mark.asyncio
    async def test_it003_all_fail(self):
        """IT-003: 全部失败 → AllProvidersUnavailableError"""
        providers = [
            ProviderConfig(name="qwen", priority=0),
            ProviderConfig(name="glm", priority=1),
        ]
        router = FallbackRouter(model="test", providers=providers, failure_threshold=3)

        async def action(provider_name):
            raise ConnectionError(f"{provider_name} down")

        with pytest.raises(AllProvidersUnavailableError) as exc:
            await router.execute(action)
        assert "qwen" in exc.value.tried
        assert "glm" in exc.value.tried

    @pytest.mark.asyncio
    async def test_it004_three_way_fallback(self):
        """IT-004: 3 家链式 Fallback — 第 3 家成功"""
        providers = [
            ProviderConfig(name="qwen", priority=0),
            ProviderConfig(name="doubao", priority=1),
            ProviderConfig(name="kimi", priority=2),
        ]
        router = FallbackRouter(model="test", providers=providers, failure_threshold=5)

        call_log = []

        async def action(provider_name):
            call_log.append(provider_name)
            if provider_name in ("qwen", "doubao"):
                raise ConnectionError(f"{provider_name} down")
            return ChatResponse(
                content="kimi-rescue", model="test", finish_reason="stop",
                usage={"total_tokens": 5},
            )

        result = await router.execute(action)
        assert result.content == "kimi-rescue"
        assert call_log == ["qwen", "doubao", "kimi"]


# ============================================================
# IT-005 ~ IT-007: 适配器 ↔ HealthChecker
# ============================================================

class TestAdapterHealthIntegration:

    def _make_checker(self, providers):
        """创建 HealthChecker stub（不做真实网络调用）"""
        return HealthChecker(
            providers={name: f"https://{name}.example.com/health" for name in providers},
            window_size=10,
        )

    def test_it005_success_records_healthy(self):
        """IT-005: 适配器成功 → HealthChecker 记录 healthy"""
        checker = self._make_checker(["qwen"])

        # 模拟 5 次成功
        for _ in range(5):
            result = CheckResult(
                provider_name="qwen", success=True,
                response_time=0.05, status_code=200,
            )
            checker._record("qwen", result)

        assert checker.get_status("qwen") == HealthStatus.HEALTHY
        assert checker.get_error_rate("qwen") == 0.0

    def test_it006_failure_records_unhealthy(self):
        """IT-006: 适配器失败 → HealthChecker 状态降级为 UNHEALTHY"""
        checker = self._make_checker(["glm"])

        # 模拟 10 次全部失败
        for _ in range(10):
            result = CheckResult(
                provider_name="glm", success=False,
                response_time=10.0, error="Connection refused",
            )
            checker._record("glm", result)

        assert checker.get_status("glm") == HealthStatus.UNHEALTHY
        assert checker.get_error_rate("glm") == 1.0

    @pytest.mark.asyncio
    async def test_it007_health_affects_router_order(self):
        """IT-007: HealthChecker 状态影响 FallbackRouter 排序"""
        checker = self._make_checker(["qwen", "glm"])

        # qwen: 全部失败 → UNHEALTHY
        for _ in range(10):
            checker._record("qwen", CheckResult(
                provider_name="qwen", success=False,
                response_time=10.0, error="fail",
            ))

        # glm: 全部成功 → HEALTHY
        for _ in range(10):
            checker._record("glm", CheckResult(
                provider_name="glm", success=True,
                response_time=0.05, status_code=200,
            ))

        providers = [
            ProviderConfig(name="qwen", priority=0),  # 更高优先级
            ProviderConfig(name="glm", priority=1),    # 更低优先级
        ]
        router = FallbackRouter(
            model="test", providers=providers,
            health_checker=checker, failure_threshold=5,
        )

        sorted_p = router.get_sorted_providers()
        # 尽管 qwen 优先级更高，但因为 UNHEALTHY，glm 应排前面
        assert sorted_p[0].name == "glm"
        assert sorted_p[1].name == "qwen"


# ============================================================
# ET-001 ~ ET-004: 边界/异常测试
# ============================================================

class TestEdgeCases:

    def test_et001_cleared_registry_dispatch(self):
        """ET-001: Registry 清空后调度 → KeyError"""
        AdapterRegistry.clear()
        with pytest.raises(KeyError):
            AdapterRegistry.get("qwen")

    @pytest.mark.asyncio
    async def test_et002_long_content_100k(self):
        """ET-002: 超长 content (100K chars) → 请求体正确构建"""
        long_msg = ChatMessage(role="user", content="x" * 100_000)
        for name, (cls, _) in ALL_ADAPTERS.items():
            adapter = cls(make_config())
            if name == "minimax":
                body = adapter._build_request_body([long_msg], "model")
                assert body["messages"][0]["text"] == "x" * 100_000
            else:
                body = adapter._build_request_body([long_msg], "model")
                assert body["messages"][0]["content"] == "x" * 100_000

    @pytest.mark.asyncio
    async def test_et003_concurrent_5_adapters(self):
        """ET-003: 并发 5 家同时调用 — 全部成功无串扰"""
        async def call_adapter(name):
            cls = ALL_ADAPTERS[name][0]
            adapter = cls(make_config())
            if name == "minimax":
                resp_text = mock_minimax_response(content=f"concurrent-{name}")
            else:
                resp_text = mock_openai_response(content=f"concurrent-{name}")
            mock_resp = make_mock_response(status=200, text=resp_text)
            session = make_mock_session(mock_resp)
            result = await adapter.chat_completion(
                sample_messages(), "model", _session=session
            )
            return name, result.content

        tasks = [call_adapter(n) for n in ALL_ADAPTERS]
        results = await asyncio.gather(*tasks)

        result_map = dict(results)
        for name in ALL_ADAPTERS:
            assert result_map[name] == f"concurrent-{name}", f"{name}: wrong content"

    @pytest.mark.asyncio
    async def test_et004_repeated_calls_no_state_leak(self):
        """ET-004: 同一适配器连续 100 次调用 — 无状态泄漏"""
        adapter = QwenAdapter(make_config())

        for i in range(100):
            resp_text = mock_openai_response(content=f"call-{i}", model=f"m-{i}")
            mock_resp = make_mock_response(status=200, text=resp_text)
            session = make_mock_session(mock_resp)
            result = await adapter.chat_completion(
                sample_messages(), f"m-{i}", _session=session
            )
            assert result.content == f"call-{i}"
            assert result.model == f"m-{i}"
