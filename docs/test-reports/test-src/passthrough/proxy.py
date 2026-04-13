"""
PRJ-LITE999-T-013: 透传代理 — 原样转发请求/响应，不做格式转换
"""

import json
import time
import asyncio
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Optional

import aiohttp

from src.passthrough.router import PassthroughRouter, ProviderRoute, RouteNotFoundError


# ============================================================
# 数据结构
# ============================================================

@dataclass
class PassthroughRequest:
    """透传请求"""
    path: str
    body: bytes | str | dict  # 原始请求体
    headers: dict[str, str] = field(default_factory=dict)
    query_params: dict[str, str] = field(default_factory=dict)
    method: str = "POST"


@dataclass
class PassthroughResponse:
    """透传响应"""
    status_code: int
    body: bytes
    headers: dict[str, str] = field(default_factory=dict)
    elapsed_ms: float = 0.0
    provider: str = ""

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")

    @property
    def json(self) -> dict:
        return json.loads(self.body)

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 400


@dataclass
class PassthroughChunk:
    """透传流式片段"""
    data: bytes
    is_done: bool = False


# ============================================================
# 错误响应工厂
# ============================================================

def _error_response(
    status_code: int, message: str, provider: str = "", elapsed_ms: float = 0
) -> PassthroughResponse:
    body = json.dumps({"error": {"message": message, "type": "proxy_error"}}).encode()
    return PassthroughResponse(
        status_code=status_code,
        body=body,
        headers={"Content-Type": "application/json"},
        elapsed_ms=elapsed_ms,
        provider=provider,
    )


# ============================================================
# 透传代理
# ============================================================

# Headers 黑名单 — 不透传给厂商
_STRIP_REQUEST_HEADERS = {
    "host", "authorization", "content-length", "transfer-encoding", "connection",
}

# 从厂商响应中保留的 headers
_PASSTHROUGH_RESPONSE_HEADERS = {
    "content-type", "x-request-id", "x-ratelimit-limit",
    "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after",
    "openai-processing-ms",
}


class PassthroughProxy:
    """
    透传代理

    核心原则：请求/响应 body 不做任何格式转换，原样透传。
    仅做以下处理：
    1. 路由解析（路径→厂商 URL）
    2. 凭证注入（服务端 API Key 替换客户端 Key）
    3. 错误包装（网络层错误→标准 HTTP 错误码）
    """

    def __init__(self, router: PassthroughRouter, default_timeout: float = 60.0):
        self.router = router
        self.default_timeout = default_timeout

    def _prepare_headers(
        self, client_headers: dict[str, str], route: ProviderRoute
    ) -> dict[str, str]:
        """
        处理 headers:
        1. 移除黑名单 headers
        2. 注入服务端 API Key
        3. 透传其余自定义 headers
        """
        out = {}
        for k, v in client_headers.items():
            if k.lower() not in _STRIP_REQUEST_HEADERS:
                out[k] = v
        # 注入服务端凭证
        out["Authorization"] = f"Bearer {route.api_key}"
        # 确保 Content-Type
        if "Content-Type" not in out and "content-type" not in out:
            out["Content-Type"] = "application/json"
        return out

    def _prepare_body(self, body: bytes | str | dict) -> bytes:
        """将请求体标准化为 bytes（不修改内容）"""
        if isinstance(body, dict):
            return json.dumps(body, ensure_ascii=False).encode("utf-8")
        if isinstance(body, str):
            return body.encode("utf-8")
        return body

    def _extract_response_headers(self, resp_headers: dict) -> dict[str, str]:
        """从厂商响应中提取需要透传的 headers"""
        out = {}
        for k, v in resp_headers.items():
            if k.lower() in _PASSTHROUGH_RESPONSE_HEADERS:
                out[k] = v
        return out

    async def forward(
        self, request: PassthroughRequest, session: aiohttp.ClientSession | None = None
    ) -> PassthroughResponse:
        """
        透传转发请求 → 返回透传响应

        错误映射:
        - RouteNotFoundError → 404
        - 请求体非法 → 400
        - 连接失败 / DNS → 502
        - 超时 → 504
        - 厂商 HTTP 错误 → 原样返回
        """
        start = time.perf_counter()

        # 路由解析
        try:
            route, target_url = self.router.resolve(
                request.path, request.query_params
            )
        except RouteNotFoundError as e:
            elapsed = (time.perf_counter() - start) * 1000
            return _error_response(404, str(e), elapsed_ms=elapsed)

        # 请求体准备
        try:
            body_bytes = self._prepare_body(request.body)
        except (TypeError, ValueError) as e:
            elapsed = (time.perf_counter() - start) * 1000
            return _error_response(400, f"Invalid request body: {e}",
                                   provider=route.name, elapsed_ms=elapsed)

        # 验证请求体是合法 JSON（POST 场景）
        if request.method.upper() == "POST" and body_bytes:
            try:
                json.loads(body_bytes)
            except (json.JSONDecodeError, UnicodeDecodeError):
                elapsed = (time.perf_counter() - start) * 1000
                return _error_response(400, "Request body is not valid JSON",
                                       provider=route.name, elapsed_ms=elapsed)

        # headers
        headers = self._prepare_headers(request.headers, route)

        timeout = aiohttp.ClientTimeout(
            total=route.default_timeout or self.default_timeout
        )

        owns_session = session is None
        if owns_session:
            session = aiohttp.ClientSession()

        try:
            try:
                async with session.request(
                    method=request.method,
                    url=target_url,
                    data=body_bytes,
                    headers=headers,
                    timeout=timeout,
                ) as resp:
                    resp_body = await resp.read()
                    elapsed = (time.perf_counter() - start) * 1000
                    resp_headers = self._extract_response_headers(resp.headers)
                    return PassthroughResponse(
                        status_code=resp.status,
                        body=resp_body,
                        headers=resp_headers,
                        elapsed_ms=elapsed,
                        provider=route.name,
                    )
            except asyncio.TimeoutError:
                elapsed = (time.perf_counter() - start) * 1000
                return _error_response(504, "Gateway Timeout",
                                       provider=route.name, elapsed_ms=elapsed)
            except aiohttp.ClientConnectorError as e:
                elapsed = (time.perf_counter() - start) * 1000
                return _error_response(502, f"Bad Gateway: {e}",
                                       provider=route.name, elapsed_ms=elapsed)
            except aiohttp.ClientError as e:
                elapsed = (time.perf_counter() - start) * 1000
                return _error_response(502, f"Bad Gateway: {e}",
                                       provider=route.name, elapsed_ms=elapsed)
        finally:
            if owns_session:
                await session.close()

    async def forward_stream(
        self, request: PassthroughRequest, session: aiohttp.ClientSession | None = None
    ) -> AsyncIterator[PassthroughChunk]:
        """
        流式透传 — 逐块 yield 厂商 SSE 响应
        """
        # 路由解析
        try:
            route, target_url = self.router.resolve(
                request.path, request.query_params
            )
        except RouteNotFoundError:
            yield PassthroughChunk(data=b"", is_done=True)
            return

        body_bytes = self._prepare_body(request.body)
        headers = self._prepare_headers(request.headers, route)
        timeout = aiohttp.ClientTimeout(
            total=route.default_timeout or self.default_timeout
        )

        owns_session = session is None
        if owns_session:
            session = aiohttp.ClientSession()

        try:
            async with session.request(
                method=request.method,
                url=target_url,
                data=body_bytes,
                headers=headers,
                timeout=timeout,
            ) as resp:
                async for line in resp.content:
                    if line == b"\n" or line == b"\r\n":
                        continue
                    stripped = line.strip()
                    if stripped == b"data: [DONE]":
                        yield PassthroughChunk(data=stripped, is_done=True)
                        return
                    yield PassthroughChunk(data=stripped, is_done=False)
        except (asyncio.TimeoutError, aiohttp.ClientError):
            yield PassthroughChunk(data=b"", is_done=True)
        finally:
            if owns_session:
                await session.close()
