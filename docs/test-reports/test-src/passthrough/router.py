"""
PRJ-LITE999-T-013: 透传路由 — 根据请求路径识别厂商并重写 URL
"""

from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode


@dataclass
class ProviderRoute:
    """厂商路由配置"""
    name: str
    path_prefix: str          # 客户端路径前缀, e.g. "/qwen"
    base_url: str             # 厂商 API 基础 URL
    api_key: str = ""         # 服务端注入的 API Key
    default_timeout: float = 60.0


class RouteNotFoundError(Exception):
    """路由未找到"""
    def __init__(self, path: str):
        self.path = path
        super().__init__(f"No provider route matched for path: {path}")


class PassthroughRouter:
    """
    透传路由器

    根据请求路径前缀识别目标厂商，重写为厂商实际 URL。
    示例: /qwen/chat/completions → https://dashscope.aliyuncs.com/.../chat/completions
    """

    def __init__(self, routes: list[ProviderRoute] | None = None):
        self._routes: dict[str, ProviderRoute] = {}
        for r in (routes or []):
            self.register(r)

    def register(self, route: ProviderRoute) -> None:
        prefix = route.path_prefix.strip("/")
        self._routes[prefix] = route

    def unregister(self, name: str) -> None:
        to_remove = [k for k, v in self._routes.items() if v.name == name]
        for k in to_remove:
            del self._routes[k]

    def resolve(
        self, path: str, query_params: dict[str, str] | None = None
    ) -> tuple[ProviderRoute, str]:
        """
        解析请求路径 → (route, 厂商完整 URL)

        Args:
            path: 客户端请求路径, e.g. "/qwen/chat/completions"
            query_params: URL 查询参数
        Returns:
            (ProviderRoute, full_url)
        Raises:
            RouteNotFoundError
        """
        path = path.strip("/")
        if not path:
            raise RouteNotFoundError("/")

        # 尝试匹配最长前缀
        best_match: Optional[tuple[str, ProviderRoute]] = None
        for prefix, route in self._routes.items():
            if path == prefix or path.startswith(prefix + "/"):
                if best_match is None or len(prefix) > len(best_match[0]):
                    best_match = (prefix, route)

        if best_match is None:
            raise RouteNotFoundError(f"/{path}")

        prefix, route = best_match
        # 剩余路径
        remainder = path[len(prefix):].lstrip("/")
        # 构建完整 URL
        base = route.base_url.rstrip("/")
        full_url = f"{base}/{remainder}" if remainder else base

        if query_params:
            qs = urlencode(query_params)
            full_url = f"{full_url}?{qs}"

        return route, full_url

    def list_routes(self) -> list[ProviderRoute]:
        return list(self._routes.values())

    def get_route_by_name(self, name: str) -> ProviderRoute | None:
        for r in self._routes.values():
            if r.name == name:
                return r
        return None
