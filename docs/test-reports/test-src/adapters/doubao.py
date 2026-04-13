"""豆包 (字节跳动 / 火山方舟) 适配器 — OpenAI 兼容"""

import json
from typing import AsyncIterator

import aiohttp

from src.adapters.base import (
    BaseAdapter, AdapterConfig, AdapterRegistry,
    ChatMessage, ChatResponse, ChatChunk, ModelInfo,
)


class DoubaoAdapter(BaseAdapter):
    PROVIDER_NAME = "doubao"
    DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"

    def __init__(self, config: AdapterConfig):
        if not config.base_url:
            config.base_url = self.DEFAULT_BASE_URL
        super().__init__(config)

    def _build_request_body(self, messages: list[ChatMessage], model: str, **kwargs) -> dict:
        body = {
            "model": model,
            "messages": self._build_messages_payload(messages),
        }
        body.update(kwargs)
        return body

    async def chat_completion(self, messages, model, *, _session=None, **kwargs):
        body = self._build_request_body(messages, model, **kwargs)
        headers = self._build_headers()
        url = f"{self.config.base_url}/chat/completions"

        owns = _session is None
        session = _session or aiohttp.ClientSession()
        try:
            async with session.post(url, json=body, headers=headers,
                                     timeout=aiohttp.ClientTimeout(total=self.config.timeout)) as resp:
                text = await resp.text()
                self._handle_error_status(resp.status, text)
                data = self._parse_json_response(text)
                choice = data["choices"][0]
                return ChatResponse(
                    content=choice["message"]["content"],
                    model=data.get("model", model),
                    finish_reason=choice.get("finish_reason", "stop"),
                    usage=data.get("usage", {}),
                    raw=data,
                )
        finally:
            if owns:
                await session.close()

    async def stream_chat_completion(self, messages, model, *, _session=None, **kwargs):
        body = self._build_request_body(messages, model, stream=True, **kwargs)
        headers = self._build_headers()
        url = f"{self.config.base_url}/chat/completions"

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
                    delta = data["choices"][0].get("delta", {})
                    yield ChatChunk(
                        delta_content=delta.get("content", ""),
                        finish_reason=data["choices"][0].get("finish_reason"),
                    )
        finally:
            if owns:
                await session.close()

    async def list_models(self):
        return [
            ModelInfo(id="doubao-pro-32k", name="Doubao Pro 32K", context_length=32768, provider=self.PROVIDER_NAME),
            ModelInfo(id="doubao-lite-32k", name="Doubao Lite 32K", context_length=32768, provider=self.PROVIDER_NAME),
        ]


AdapterRegistry.register("doubao", DoubaoAdapter)
