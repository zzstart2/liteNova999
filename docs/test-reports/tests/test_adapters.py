"""
PRJ-LITE999-T-005 测试用例
厂商 API 适配器：千问/豆包/GLM/Kimi/MiniMax 原生 API 适配器

覆盖：基础接口 (UT)、各厂商适配器 (UT)、集成测试 (IT)、边界/异常 (ET)
"""

import asyncio
import json
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

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


# ============================================================
# Helpers
# ============================================================

def make_config(api_key="sk-test-key", base_url="", **kw):
    return AdapterConfig(api_key=api_key, base_url=base_url, **kw)


def sample_messages():
    return [
        ChatMessage(role="system", content="You are helpful."),
        ChatMessage(role="user", content="Hello"),
    ]


def mock_openai_response(content="Hi there", model="test-model", finish_reason="stop"):
    """标准 OpenAI 兼容响应"""
    return json.dumps({
        "id": "chatcmpl-123",
        "object": "chat.completion",
        "model": model,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": content},
            "finish_reason": finish_reason,
        }],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
    })


def mock_minimax_response(content="Hi there", model="MiniMax-Text-01"):
    """MiniMax 自有协议响应"""
    return json.dumps({
        "model": model,
        "choices": [{
            "messages": [{"sender_type": "BOT", "sender_name": "assistant", "text": content}],
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        "base_resp": {"status_code": 0, "status_msg": "success"},
    })


def mock_stream_lines(chunks: list[dict], done=True):
    """构建 SSE 流式行"""
    lines = []
    for c in chunks:
        lines.append(f"data: {json.dumps(c)}\n\n".encode())
    if done:
        lines.append(b"data: [DONE]\n\n")
    return lines


def make_mock_response(status=200, text="", lines=None):
    """构建 mock aiohttp 响应"""
    resp = AsyncMock()
    resp.status = status
    resp.text = AsyncMock(return_value=text)

    if lines is not None:
        resp.content = AsyncIterLines(lines)

    resp.__aenter__ = AsyncMock(return_value=resp)
    resp.__aexit__ = AsyncMock(return_value=False)
    return resp


class AsyncIterLines:
    """模拟 aiohttp response.content 的异步迭代"""
    def __init__(self, lines):
        self._lines = lines
        self._idx = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._idx >= len(self._lines):
            raise StopAsyncIteration
        line = self._lines[self._idx]
        self._idx += 1
        return line


def make_mock_session(response):
    """构建 mock session"""
    session = AsyncMock()
    session.post = MagicMock(return_value=response)
    return session


# ============================================================
# UT-001 ~ UT-004: 基础接口与注册
# ============================================================

class TestBaseAndRegistry:

    def test_ut001_base_adapter_abstract(self):
        """UT-001: BaseAdapter 不可直接实例化"""
        with pytest.raises(TypeError):
            BaseAdapter(make_config())

    def test_ut002_all_providers_registered(self):
        """UT-002: 5 家厂商全部注册"""
        registry = AdapterRegistry.list_all()
        expected = {"qwen", "doubao", "glm", "kimi", "minimax"}
        assert expected.issubset(set(registry.keys()))

    def test_ut003_get_adapter_by_name(self):
        """UT-003: 按名称获取适配器类"""
        assert AdapterRegistry.get("qwen") is QwenAdapter
        assert AdapterRegistry.get("doubao") is DoubaoAdapter
        assert AdapterRegistry.get("glm") is GLMAdapter
        assert AdapterRegistry.get("kimi") is KimiAdapter
        assert AdapterRegistry.get("minimax") is MiniMaxAdapter

    def test_ut004_get_nonexistent_adapter(self):
        """UT-004: 获取不存在的适配器 → KeyError"""
        with pytest.raises(KeyError):
            AdapterRegistry.get("nonexistent_provider")


# ============================================================
# 各厂商适配器测试 — 参数化
# ============================================================

OPENAI_COMPATIBLE = [
    ("qwen", QwenAdapter, "https://dashscope.aliyuncs.com/compatible-mode/v1"),
    ("doubao", DoubaoAdapter, "https://ark.cn-beijing.volces.com/api/v3"),
    ("glm", GLMAdapter, "https://open.bigmodel.cn/api/paas/v4"),
    ("kimi", KimiAdapter, "https://api.moonshot.cn/v1"),
]


class TestOpenAICompatibleAdapters:
    """UT: 千问/豆包/GLM/Kimi — OpenAI 兼容适配器统一测试"""

    @pytest.mark.parametrize("name,cls,default_url", OPENAI_COMPATIBLE)
    def test_config_init(self, name, cls, default_url):
        """各适配器 -001: 默认 base_url 正确"""
        adapter = cls(make_config())
        assert adapter.config.base_url == default_url
        assert adapter.PROVIDER_NAME == name

    @pytest.mark.parametrize("name,cls,default_url", OPENAI_COMPATIBLE)
    def test_custom_base_url(self, name, cls, default_url):
        """自定义 base_url 不被覆盖"""
        adapter = cls(make_config(base_url="https://custom.api.com/v1"))
        assert adapter.config.base_url == "https://custom.api.com/v1"

    @pytest.mark.parametrize("name,cls,default_url", OPENAI_COMPATIBLE)
    @pytest.mark.asyncio
    async def test_chat_completion_success(self, name, cls, default_url):
        """各适配器 -002: chat_completion 正常响应"""
        adapter = cls(make_config())
        resp_text = mock_openai_response(content="Hello from " + name)
        mock_resp = make_mock_response(status=200, text=resp_text)
        mock_session = make_mock_session(mock_resp)

        result = await adapter.chat_completion(
            sample_messages(), "test-model", _session=mock_session
        )

        assert isinstance(result, ChatResponse)
        assert result.content == "Hello from " + name
        assert result.finish_reason == "stop"
        assert result.usage["total_tokens"] == 15

    @pytest.mark.parametrize("name,cls,default_url", OPENAI_COMPATIBLE)
    @pytest.mark.asyncio
    async def test_chat_completion_http_error(self, name, cls, default_url):
        """各适配器 -003: HTTP 500 → APIError"""
        adapter = cls(make_config())
        mock_resp = make_mock_response(status=500, text="Internal Server Error")
        mock_session = make_mock_session(mock_resp)

        with pytest.raises(APIError) as exc_info:
            await adapter.chat_completion(
                sample_messages(), "test-model", _session=mock_session
            )
        assert exc_info.value.status_code == 500
        assert exc_info.value.provider == name

    @pytest.mark.parametrize("name,cls,default_url", OPENAI_COMPATIBLE)
    @pytest.mark.asyncio
    async def test_stream_chat_completion(self, name, cls, default_url):
        """各适配器 -004: 流式响应逐块 yield"""
        adapter = cls(make_config())
        chunks_data = [
            {"choices": [{"delta": {"content": "Hello"}, "finish_reason": None}]},
            {"choices": [{"delta": {"content": " world"}, "finish_reason": None}]},
            {"choices": [{"delta": {}, "finish_reason": "stop"}]},
        ]
        lines = mock_stream_lines(chunks_data)
        mock_resp = make_mock_response(status=200, lines=lines)
        mock_session = make_mock_session(mock_resp)

        collected = []
        async for chunk in adapter.stream_chat_completion(
            sample_messages(), "test-model", _session=mock_session
        ):
            assert isinstance(chunk, ChatChunk)
            collected.append(chunk)

        assert len(collected) == 3
        assert collected[0].delta_content == "Hello"
        assert collected[1].delta_content == " world"
        assert collected[2].finish_reason == "stop"

    @pytest.mark.parametrize("name,cls,default_url", OPENAI_COMPATIBLE)
    @pytest.mark.asyncio
    async def test_request_body_format(self, name, cls, default_url):
        """各适配器 -005: 请求体正确构建"""
        adapter = cls(make_config())
        body = adapter._build_request_body(
            sample_messages(), "test-model", temperature=0.5
        )
        assert body["model"] == "test-model"
        assert len(body["messages"]) == 2
        assert body["messages"][0]["role"] == "system"
        assert body["messages"][1]["role"] == "user"
        assert body["temperature"] == 0.5

    @pytest.mark.parametrize("name,cls,default_url", OPENAI_COMPATIBLE)
    @pytest.mark.asyncio
    async def test_response_field_mapping(self, name, cls, default_url):
        """各适配器 -006: 响应体字段正确映射"""
        adapter = cls(make_config())
        resp_text = mock_openai_response(
            content="Mapped response", model="custom-model-v2", finish_reason="length"
        )
        mock_resp = make_mock_response(status=200, text=resp_text)
        mock_session = make_mock_session(mock_resp)

        result = await adapter.chat_completion(
            sample_messages(), "custom-model-v2", _session=mock_session
        )
        assert result.model == "custom-model-v2"
        assert result.finish_reason == "length"
        assert "prompt_tokens" in result.usage

    @pytest.mark.parametrize("name,cls,default_url", OPENAI_COMPATIBLE)
    def test_validate_config(self, name, cls, default_url):
        """各适配器 -007: validate_config"""
        # 有效配置
        adapter = cls(make_config(api_key="sk-test"))
        assert adapter.validate_config() is True

        # 无效: 空 api_key
        adapter_bad = cls(make_config(api_key=""))
        assert adapter_bad.validate_config() is False

    @pytest.mark.parametrize("name,cls,default_url", OPENAI_COMPATIBLE)
    @pytest.mark.asyncio
    async def test_list_models(self, name, cls, default_url):
        """各适配器: list_models 返回 ModelInfo 列表"""
        adapter = cls(make_config())
        models = await adapter.list_models()
        assert len(models) >= 1
        for m in models:
            assert isinstance(m, ModelInfo)
            assert m.provider == name
            assert m.context_length > 0


# ============================================================
# MiniMax 专项测试（非 OpenAI 兼容）
# ============================================================

class TestMiniMaxAdapter:

    def test_minimax_config_init(self):
        """MiniMax -001: 默认配置"""
        adapter = MiniMaxAdapter(make_config())
        assert adapter.config.base_url == "https://api.minimax.chat/v1"
        assert adapter.PROVIDER_NAME == "minimax"

    @pytest.mark.asyncio
    async def test_minimax_chat_completion(self):
        """MiniMax -002: chat_completion 解析自有协议"""
        adapter = MiniMaxAdapter(make_config())
        resp_text = mock_minimax_response(content="MiniMax says hi")
        mock_resp = make_mock_response(status=200, text=resp_text)
        mock_session = make_mock_session(mock_resp)

        result = await adapter.chat_completion(
            sample_messages(), "MiniMax-Text-01", _session=mock_session
        )
        assert isinstance(result, ChatResponse)
        assert result.content == "MiniMax says hi"
        assert result.finish_reason == "stop"

    @pytest.mark.asyncio
    async def test_minimax_http_error(self):
        """MiniMax -003: HTTP 错误"""
        adapter = MiniMaxAdapter(make_config())
        mock_resp = make_mock_response(status=500, text="Server Error")
        mock_session = make_mock_session(mock_resp)

        with pytest.raises(APIError) as exc_info:
            await adapter.chat_completion(
                sample_messages(), "test", _session=mock_session
            )
        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_minimax_stream(self):
        """MiniMax -004: 流式响应"""
        adapter = MiniMaxAdapter(make_config())
        chunks_data = [
            {"choices": [{"messages": [{"text": "Hi"}], "finish_reason": None}]},
            {"choices": [{"messages": [{"text": " Max"}], "finish_reason": "stop"}]},
        ]
        lines = mock_stream_lines(chunks_data)
        mock_resp = make_mock_response(status=200, lines=lines)
        mock_session = make_mock_session(mock_resp)

        collected = []
        async for chunk in adapter.stream_chat_completion(
            sample_messages(), "test", _session=mock_session
        ):
            collected.append(chunk)

        assert len(collected) == 2
        assert collected[0].delta_content == "Hi"
        assert collected[1].delta_content == " Max"

    def test_minimax_request_body_format(self):
        """MiniMax -005: 请求体使用自有格式"""
        adapter = MiniMaxAdapter(make_config())
        body = adapter._build_request_body(
            sample_messages(), "MiniMax-Text-01", max_tokens=1024
        )
        assert body["model"] == "MiniMax-Text-01"
        assert body["tokens_to_generate"] == 1024
        # MiniMax 使用 sender_type / sender_name / text
        msg = body["messages"][0]
        assert "sender_type" in msg
        assert "text" in msg
        assert msg["sender_type"] == "SYSTEM"

    @pytest.mark.asyncio
    async def test_minimax_response_mapping(self):
        """MiniMax -006: 自有响应映射为统一 ChatResponse"""
        adapter = MiniMaxAdapter(make_config())
        resp_text = mock_minimax_response(content="Unified", model="abab6.5s-chat")
        mock_resp = make_mock_response(status=200, text=resp_text)
        mock_session = make_mock_session(mock_resp)

        result = await adapter.chat_completion(
            sample_messages(), "abab6.5s-chat", _session=mock_session
        )
        assert result.model == "abab6.5s-chat"
        assert result.usage["total_tokens"] == 15

    def test_minimax_validate_config(self):
        """MiniMax -007: validate_config"""
        adapter = MiniMaxAdapter(make_config(api_key="sk-mm"))
        assert adapter.validate_config() is True
        adapter_bad = MiniMaxAdapter(make_config(api_key=""))
        assert adapter_bad.validate_config() is False

    def test_minimax_role_mapping(self):
        """MiniMax: role → sender_type 映射"""
        assert MiniMaxAdapter._map_role("system") == "SYSTEM"
        assert MiniMaxAdapter._map_role("user") == "USER"
        assert MiniMaxAdapter._map_role("assistant") == "BOT"
        assert MiniMaxAdapter._map_role("unknown") == "USER"  # fallback

    @pytest.mark.asyncio
    async def test_minimax_error_code_rate_limit(self):
        """ET-007: MiniMax 错误码 1001 → RateLimitError"""
        adapter = MiniMaxAdapter(make_config())
        resp_data = json.dumps({
            "model": "test",
            "choices": [],
            "base_resp": {"status_code": 1001, "status_msg": "rate limited"},
        })
        mock_resp = make_mock_response(status=200, text=resp_data)
        mock_session = make_mock_session(mock_resp)

        with pytest.raises(RateLimitError):
            await adapter.chat_completion(
                sample_messages(), "test", _session=mock_session
            )

    @pytest.mark.asyncio
    async def test_minimax_error_code_generic(self):
        """MiniMax 错误码 1002 → APIError"""
        adapter = MiniMaxAdapter(make_config())
        resp_data = json.dumps({
            "model": "test",
            "choices": [],
            "base_resp": {"status_code": 1002, "status_msg": "auth failed"},
        })
        mock_resp = make_mock_response(status=200, text=resp_data)
        mock_session = make_mock_session(mock_resp)

        with pytest.raises(APIError) as exc_info:
            await adapter.chat_completion(
                sample_messages(), "test", _session=mock_session
            )
        assert exc_info.value.status_code == 1002

    @pytest.mark.asyncio
    async def test_minimax_list_models(self):
        """MiniMax: list_models"""
        adapter = MiniMaxAdapter(make_config())
        models = await adapter.list_models()
        assert len(models) >= 1
        assert all(m.provider == "minimax" for m in models)


# ============================================================
# IT: 集成测试
# ============================================================

class TestIntegration:

    @pytest.mark.asyncio
    async def test_it001_all_adapters_validate(self):
        """IT-001: 所有适配器实例化 + validate"""
        adapter_classes = [QwenAdapter, DoubaoAdapter, GLMAdapter, KimiAdapter, MiniMaxAdapter]
        for cls in adapter_classes:
            adapter = cls(make_config(api_key="sk-test"))
            assert adapter.validate_config() is True
            models = await adapter.list_models()
            assert len(models) >= 1

    @pytest.mark.asyncio
    async def test_it002_adapter_with_fallback_router(self):
        """IT-002: 适配器 + FallbackRouter 联动"""
        from src.fallback_router import FallbackRouter, ProviderConfig

        adapters = {
            "qwen": QwenAdapter(make_config()),
            "glm": GLMAdapter(make_config()),
        }

        router = FallbackRouter(
            model="gpt-4",
            providers=[
                ProviderConfig(name="qwen", priority=0),
                ProviderConfig(name="glm", priority=1),
            ],
            failure_threshold=1,
        )

        call_log = []

        async def action(provider_name: str):
            call_log.append(provider_name)
            if provider_name == "qwen":
                raise ConnectionError("qwen down")
            # GLM 成功
            return ChatResponse(
                content="GLM fallback",
                model="glm-4",
                finish_reason="stop",
                usage={"total_tokens": 10},
            )

        result = await router.execute(action)
        assert result.content == "GLM fallback"
        assert "qwen" in call_log
        assert "glm" in call_log

    @pytest.mark.asyncio
    async def test_it003_polymorphic_call(self):
        """IT-003: 统一接口多态调用"""
        adapter_classes = [QwenAdapter, DoubaoAdapter, GLMAdapter, KimiAdapter]

        for cls in adapter_classes:
            adapter = cls(make_config())
            resp_text = mock_openai_response(content=f"from {adapter.PROVIDER_NAME}")
            mock_resp = make_mock_response(status=200, text=resp_text)
            mock_session = make_mock_session(mock_resp)

            result = await adapter.chat_completion(
                sample_messages(), "test-model", _session=mock_session
            )
            assert isinstance(result, ChatResponse)
            assert adapter.PROVIDER_NAME in result.content


# ============================================================
# ET: 边界/异常测试
# ============================================================

class TestEdgeCases:

    def test_et001_empty_api_key(self):
        """ET-001: 空 API Key → validate_config False"""
        for cls in [QwenAdapter, DoubaoAdapter, GLMAdapter, KimiAdapter, MiniMaxAdapter]:
            adapter = cls(make_config(api_key=""))
            assert adapter.validate_config() is False

    def test_et002_empty_messages(self):
        """ET-002: 空消息列表 → ValueError"""
        adapter = QwenAdapter(make_config())
        with pytest.raises(ValueError, match="empty"):
            adapter._build_messages_payload([])

    @pytest.mark.asyncio
    async def test_et003_long_content(self):
        """ET-003: 超长 content → 正常构建请求"""
        adapter = QwenAdapter(make_config())
        long_msg = ChatMessage(role="user", content="x" * 100_000)
        body = adapter._build_request_body([long_msg], "test-model")
        assert len(body["messages"][0]["content"]) == 100_000

    @pytest.mark.asyncio
    async def test_et004_non_json_response(self):
        """ET-004: 非 JSON 响应 → ParseError"""
        adapter = QwenAdapter(make_config())
        mock_resp = make_mock_response(status=200, text="<html>not json</html>")
        mock_session = make_mock_session(mock_resp)

        with pytest.raises(ParseError) as exc_info:
            await adapter.chat_completion(
                sample_messages(), "test", _session=mock_session
            )
        assert exc_info.value.provider == "qwen"

    @pytest.mark.asyncio
    async def test_et005_timeout(self):
        """ET-005: 超时 → asyncio.TimeoutError 传播"""
        adapter = QwenAdapter(make_config(timeout=0.001))
        mock_session = AsyncMock()
        mock_session.post = MagicMock(side_effect=asyncio.TimeoutError())

        with pytest.raises(asyncio.TimeoutError):
            await adapter.chat_completion(
                sample_messages(), "test", _session=mock_session
            )

    @pytest.mark.asyncio
    async def test_et006_rate_limit_429(self):
        """ET-006: HTTP 429 → RateLimitError"""
        adapter = GLMAdapter(make_config())
        mock_resp = make_mock_response(status=429, text="Too Many Requests")
        mock_session = make_mock_session(mock_resp)

        with pytest.raises(RateLimitError) as exc_info:
            await adapter.chat_completion(
                sample_messages(), "test", _session=mock_session
            )
        assert exc_info.value.status_code == 429
        assert exc_info.value.provider == "glm"

    def test_et007_minimax_error_codes(self):
        """ET-007: MiniMax 特殊错误码映射"""
        adapter = MiniMaxAdapter(make_config())
        # 已在 MiniMax 专项测试中覆盖 1001, 1002
        assert 1001 in adapter.ERROR_CODE_MAP
        assert 1002 in adapter.ERROR_CODE_MAP
        assert 1003 in adapter.ERROR_CODE_MAP


# ============================================================
# 额外: 请求头构建
# ============================================================

class TestHeaders:

    def test_standard_headers(self):
        adapter = QwenAdapter(make_config(api_key="sk-abc"))
        headers = adapter._build_headers()
        assert headers["Authorization"] == "Bearer sk-abc"
        assert headers["Content-Type"] == "application/json"

    def test_extra_headers(self):
        adapter = QwenAdapter(make_config(
            api_key="sk-abc",
            extra_headers={"X-Custom": "value"},
        ))
        headers = adapter._build_headers()
        assert headers["X-Custom"] == "value"

    def test_minimax_auth_header(self):
        adapter = MiniMaxAdapter(make_config(api_key="sk-mm"))
        headers = adapter._build_headers()
        assert headers["Authorization"] == "Bearer sk-mm"
