# PRJ-LITE999-T-005: 厂商 API 适配器
from src.adapters.base import (
    BaseAdapter,
    AdapterConfig,
    ChatMessage,
    ChatResponse,
    ChatChunk,
    ModelInfo,
    APIError,
    ParseError,
    RateLimitError,
    AdapterRegistry,
)
from src.adapters.qwen import QwenAdapter
from src.adapters.doubao import DoubaoAdapter
from src.adapters.glm import GLMAdapter
from src.adapters.kimi import KimiAdapter
from src.adapters.minimax import MiniMaxAdapter

__all__ = [
    "BaseAdapter", "AdapterConfig", "ChatMessage", "ChatResponse",
    "ChatChunk", "ModelInfo", "APIError", "ParseError", "RateLimitError",
    "AdapterRegistry",
    "QwenAdapter", "DoubaoAdapter", "GLMAdapter", "KimiAdapter", "MiniMaxAdapter",
]
