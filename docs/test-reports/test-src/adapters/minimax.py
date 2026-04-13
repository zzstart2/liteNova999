"""MiniMax 适配器 — 自有协议（非 OpenAI 兼容，需字段映射）"""

import json
from typing import AsyncIterator

import aiohttp

from src.adapters.base import (
    BaseAdapter, AdapterConfig, AdapterRegistry,
    ChatMessage, ChatResponse, ChatChunk, ModelInfo,
    APIError, ParseError,
)


class MiniMaxAdapter(BaseAdapter):
    PROVIDER_NAME = "minimax"
    DEFAULT_BASE_URL = "https://api.minimax.chat/v1"

    # MiniMax 特有错误码映射
    ERROR_CODE_MAP = {
        1000: "Unknown error",
        1001: "Rate limited",
        1002: "Authentication failed",
        1003: "Insufficient balance",
        1004: "Invalid parameters",
    }

    def __init__(self, config: AdapterConfig):
        if not config.base_url:
            config.base_url = self.DEFAULT_BASE_URL
        super().__init__(config)

    def _build_headers(self) -> dict[str, str]:
        """MiniMax 使用 Authorization: Bearer 头"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
        }
        headers.update(self.config.extra_headers)
        return headers

    def _build_request_body(self, messages: list[ChatMessage], model: str, **kwargs) -> dict:
        """构建 MiniMax 特有格式请求体"""
        mm_messages = []
        for m in self._build_messages_payload(messages):
            mm_messages.append({
                "sender_type": self._map_role(m["role"]),
                "sender_name": m["role"],
                "text": m["content"],
            })

        body = {
            "model": model,
            "messages": mm_messages,
            "tokens_to_generate": kwargs.get("max_tokens", 2048),
            "temperature": kwargs.get("temperature", 0.7),
        }
        # 保留其他 kwargs
        for k, v in kwargs.items():
            if k not in ("max_tokens", "temperature"):
                body[k] = v
        return body

    @staticmethod
    def _map_role(role: str) -> str:
        """OpenAI role → MiniMax sender_type"""
        mapping = {"system": "SYSTEM", "user": "USER", "assistant": "BOT"}
        return mapping.get(role, "USER")

    def _handle_minimax_error(self, data: dict) -> None:
        """处理 MiniMax 业务级错误码"""
        base_resp = data.get("base_resp", {})
        status_code = base_resp.get("status_code", 0)
        if status_code != 0:
            msg = self.ERROR_CODE_MAP.get(
                status_code,
                base_resp.get("status_msg", "Unknown MiniMax error"),
            )
            if status_code == 1001:
                from src.adapters.base import RateLimitError
                raise RateLimitError(message=msg, provider=self.PROVIDER_NAME)
            raise APIError(
                status_code=status_code, message=msg, provider=self.PROVIDER_NAME
            )

    def _parse_minimax_response(self, data: dict, model: str) -> ChatResponse:
        """解析 MiniMax 响应为统一 ChatResponse"""
        self._handle_minimax_error(data)

        # MiniMax 返回格式: choices[0].messages[0].text
        choices = data.get("choices", [])
        if not choices:
            raise ParseError("No choices in response", str(data)[:500], self.PROVIDER_NAME)

        message = choices[0].get("messages", [{}])[0] if choices[0].get("messages") else {}
        content = message.get("text", "")
        finish_reason = choices[0].get("finish_reason", "stop")

        usage = data.get("usage", {})
        unified_usage = {
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
        }

        return ChatResponse(
            content=content,
            model=data.get("model", model),
            finish_reason=finish_reason,
            usage=unified_usage,
            raw=data,
        )

    async def chat_completion(self, messages, model, *, _session=None, **kwargs):
        body = self._build_request_body(messages, model, **kwargs)
        headers = self._build_headers()
        url = f"{self.config.base_url}/text/chatcompletion_v2"

        owns = _session is None
        session = _session or aiohttp.ClientSession()
        try:
            async with session.post(url, json=body, headers=headers,
                                     timeout=aiohttp.ClientTimeout(total=self.config.timeout)) as resp:
                text = await resp.text()
                self._handle_error_status(resp.status, text)
                data = self._parse_json_response(text)
                return self._parse_minimax_response(data, model)
        finally:
            if owns:
                await session.close()

    async def stream_chat_completion(self, messages, model, *, _session=None, **kwargs):
        body = self._build_request_body(messages, model, **kwargs)
        body["stream"] = True
        headers = self._build_headers()
        url = f"{self.config.base_url}/text/chatcompletion_v2"

        owns = _session is None
        session = _session or aiohttp.ClientSession()
        try:
            async with session.post(url, json=body, headers=headers,
                                     timeout=aiohttp.ClientTimeout(total=self.config.timeout)) as resp:
                self._handle_error_status(resp.status, "")
                async for line in resp.content:
                    line = line.decode("utf-8").strip()
                    if not line or not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload == "[DONE]":
                        return
                    data = json.loads(payload)
                    # MiniMax 流式: choices[0].messages[0].text (增量)
                    choices = data.get("choices", [])
                    if choices:
                        msgs = choices[0].get("messages", [{}])
                        text = msgs[0].get("text", "") if msgs else ""
                        yield ChatChunk(
                            delta_content=text,
                            finish_reason=choices[0].get("finish_reason"),
                        )
        finally:
            if owns:
                await session.close()

    async def list_models(self):
        return [
            ModelInfo(id="MiniMax-Text-01", name="MiniMax Text 01", context_length=245760, provider=self.PROVIDER_NAME),
            ModelInfo(id="abab6.5s-chat", name="ABAB 6.5s Chat", context_length=245760, provider=self.PROVIDER_NAME),
        ]


AdapterRegistry.register("minimax", MiniMaxAdapter)
