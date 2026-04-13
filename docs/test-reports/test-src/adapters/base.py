"""
PRJ-LITE999-T-005: 厂商 API 适配器 — 基础抽象与数据结构
"""

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Optional


# ============================================================
# 数据结构
# ============================================================

@dataclass
class AdapterConfig:
    """适配器统一配置"""
    api_key: str = ""
    base_url: str = ""
    timeout: float = 60.0
    extra_headers: dict[str, str] = field(default_factory=dict)
    extra_params: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChatMessage:
    """聊天消息"""
    role: str  # system / user / assistant
    content: str


@dataclass
class ChatResponse:
    """完整聊天响应"""
    content: str
    model: str
    finish_reason: str
    usage: dict[str, int] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChatChunk:
    """流式聊天片段"""
    delta_content: str = ""
    finish_reason: Optional[str] = None


@dataclass
class ModelInfo:
    """模型元数据"""
    id: str
    name: str
    context_length: int = 0
    provider: str = ""


# ============================================================
# 异常
# ============================================================

class APIError(Exception):
    """API 调用错误"""
    def __init__(self, status_code: int, message: str, provider: str = ""):
        self.status_code = status_code
        self.message = message
        self.provider = provider
        super().__init__(f"[{provider}] HTTP {status_code}: {message}")


class ParseError(Exception):
    """响应解析错误"""
    def __init__(self, message: str, raw_body: str = "", provider: str = ""):
        self.message = message
        self.raw_body = raw_body
        self.provider = provider
        super().__init__(f"[{provider}] Parse error: {message}")


class RateLimitError(APIError):
    """限流错误 (HTTP 429)"""
    def __init__(self, message: str = "Rate limited", provider: str = "",
                 retry_after: Optional[float] = None):
        self.retry_after = retry_after
        super().__init__(status_code=429, message=message, provider=provider)


# ============================================================
# 抽象基类
# ============================================================

class BaseAdapter(ABC):
    """厂商 API 适配器抽象基类"""

    PROVIDER_NAME: str = ""

    def __init__(self, config: AdapterConfig):
        self.config = config

    @abstractmethod
    async def chat_completion(
        self, messages: list[ChatMessage], model: str, **kwargs
    ) -> ChatResponse:
        """发送聊天请求，返回完整响应"""
        ...

    @abstractmethod
    async def stream_chat_completion(
        self, messages: list[ChatMessage], model: str, **kwargs
    ) -> AsyncIterator[ChatChunk]:
        """发送流式聊天请求"""
        ...

    @abstractmethod
    async def list_models(self) -> list[ModelInfo]:
        """列出可用模型"""
        ...

    def validate_config(self) -> bool:
        """验证配置有效性"""
        return bool(self.config.api_key and self.config.base_url)

    def _build_headers(self) -> dict[str, str]:
        """构建请求头"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
        }
        headers.update(self.config.extra_headers)
        return headers

    def _build_messages_payload(self, messages: list[ChatMessage]) -> list[dict]:
        """将 ChatMessage 列表转为请求 payload"""
        if not messages:
            raise ValueError("Messages list cannot be empty")
        return [{"role": m.role, "content": m.content} for m in messages]

    def _parse_json_response(self, text: str) -> dict:
        """解析 JSON 响应体"""
        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError) as e:
            raise ParseError(
                message=str(e), raw_body=(text or "")[:500], provider=self.PROVIDER_NAME
            )

    def _handle_error_status(self, status_code: int, body: str) -> None:
        """处理 HTTP 错误状态码"""
        if status_code == 429:
            raise RateLimitError(
                message=body[:200], provider=self.PROVIDER_NAME
            )
        if status_code >= 400:
            raise APIError(
                status_code=status_code,
                message=body[:200],
                provider=self.PROVIDER_NAME,
            )


# ============================================================
# 适配器注册表
# ============================================================

class AdapterRegistry:
    """适配器注册表"""

    _adapters: dict[str, type[BaseAdapter]] = {}

    @classmethod
    def register(cls, name: str, adapter_cls: type[BaseAdapter]) -> None:
        cls._adapters[name] = adapter_cls

    @classmethod
    def get(cls, name: str) -> type[BaseAdapter]:
        if name not in cls._adapters:
            raise KeyError(f"Adapter '{name}' not registered")
        return cls._adapters[name]

    @classmethod
    def list_all(cls) -> dict[str, type[BaseAdapter]]:
        return dict(cls._adapters)

    @classmethod
    def clear(cls) -> None:
        cls._adapters.clear()
