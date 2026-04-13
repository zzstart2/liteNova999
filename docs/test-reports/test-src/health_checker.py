"""
PRJ-LITE999-T-008: 多服务商健康检查机制
功能：服务商健康监控 —— 响应时间、错误率、可用性检测
"""

import time
import statistics
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from urllib.parse import urlparse

import aiohttp


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class CheckResult:
    """单次健康检查结果"""
    provider_name: str
    success: bool
    response_time: float  # seconds
    status_code: Optional[int] = None
    error: Optional[str] = None
    timestamp: float = field(default_factory=time.time)


@dataclass
class ProviderHealth:
    """服务商健康状态摘要"""
    provider_name: str
    status: HealthStatus
    error_rate: float
    avg_response_time: float
    p95_response_time: float
    total_checks: int
    recent_failures: int


class HealthChecker:
    """多服务商健康检查器"""

    # 可用性阈值
    HEALTHY_THRESHOLD = 0.1       # error_rate < 10% → healthy
    DEGRADED_THRESHOLD = 0.5      # error_rate < 50% → degraded, ≥50% → unhealthy

    def __init__(
        self,
        providers: dict[str, str] | None = None,
        window_size: int = 10,
        timeout: float = 10.0,
    ):
        """
        Args:
            providers: {name: url} 服务商映射
            window_size: 滑动窗口大小（最近 N 次检查）
            timeout: 单次检查超时时间（秒）
        """
        self.providers: dict[str, str] = providers or {}
        self.window_size = window_size
        self.timeout = timeout
        self._history: dict[str, list[CheckResult]] = {
            name: [] for name in self.providers
        }

    def _validate_url(self, url: str) -> bool:
        """验证 URL 格式"""
        try:
            result = urlparse(url)
            return all([result.scheme in ("http", "https"), result.netloc])
        except Exception:
            return False

    async def check_provider(
        self, name: str, url: str, session: aiohttp.ClientSession | None = None
    ) -> CheckResult:
        """对单个服务商执行健康检查"""
        # URL 格式校验
        if not self._validate_url(url):
            result = CheckResult(
                provider_name=name,
                success=False,
                response_time=0.0,
                error=f"Invalid URL: {url}",
            )
            self._record(name, result)
            return result

        owns_session = session is None
        if owns_session:
            session = aiohttp.ClientSession()

        try:
            start = time.monotonic()
            try:
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=self.timeout)
                ) as resp:
                    elapsed = time.monotonic() - start
                    success = 200 <= resp.status < 400
                    result = CheckResult(
                        provider_name=name,
                        success=success,
                        response_time=elapsed,
                        status_code=resp.status,
                        error=None if success else f"HTTP {resp.status}",
                    )
            except asyncio.TimeoutError:
                elapsed = self.timeout
                result = CheckResult(
                    provider_name=name,
                    success=False,
                    response_time=elapsed,
                    error="Timeout",
                )
            except aiohttp.ClientError as e:
                elapsed = time.monotonic() - start
                result = CheckResult(
                    provider_name=name,
                    success=False,
                    response_time=elapsed,
                    error=str(e),
                )
        finally:
            if owns_session:
                await session.close()

        self._record(name, result)
        return result

    def _record(self, name: str, result: CheckResult) -> None:
        """记录检查结果到滑动窗口"""
        if name not in self._history:
            self._history[name] = []
        self._history[name].append(result)
        # 保持窗口大小
        if len(self._history[name]) > self.window_size:
            self._history[name] = self._history[name][-self.window_size:]

    def get_error_rate(self, name: str) -> float | None:
        """计算服务商的错误率"""
        history = self._history.get(name, [])
        if not history:
            return None
        window = history[-self.window_size:]
        failures = sum(1 for r in window if not r.success)
        return failures / len(window)

    def get_avg_response_time(self, name: str) -> float | None:
        """计算平均响应时间"""
        history = self._history.get(name, [])
        if not history:
            return None
        window = history[-self.window_size:]
        return statistics.mean(r.response_time for r in window)

    def get_p95_response_time(self, name: str) -> float | None:
        """计算 P95 响应时间"""
        history = self._history.get(name, [])
        if not history:
            return None
        window = history[-self.window_size:]
        times = sorted(r.response_time for r in window)
        idx = int(len(times) * 0.95)
        idx = min(idx, len(times) - 1)
        return times[idx]

    def get_status(self, name: str) -> HealthStatus:
        """根据错误率判定服务商可用性"""
        error_rate = self.get_error_rate(name)
        if error_rate is None:
            return HealthStatus.UNKNOWN
        if error_rate < self.HEALTHY_THRESHOLD:
            return HealthStatus.HEALTHY
        if error_rate < self.DEGRADED_THRESHOLD:
            return HealthStatus.DEGRADED
        return HealthStatus.UNHEALTHY

    def get_provider_health(self, name: str) -> ProviderHealth:
        """获取单个服务商健康摘要"""
        history = self._history.get(name, [])
        window = history[-self.window_size:]
        error_rate = self.get_error_rate(name)
        return ProviderHealth(
            provider_name=name,
            status=self.get_status(name),
            error_rate=error_rate if error_rate is not None else 0.0,
            avg_response_time=self.get_avg_response_time(name) or 0.0,
            p95_response_time=self.get_p95_response_time(name) or 0.0,
            total_checks=len(window),
            recent_failures=sum(1 for r in window if not r.success),
        )

    async def check_all(self) -> list[CheckResult]:
        """并发检查所有服务商"""
        if not self.providers:
            return []

        async with aiohttp.ClientSession() as session:
            tasks = [
                self.check_provider(name, url, session)
                for name, url in self.providers.items()
            ]
            results = await asyncio.gather(*tasks, return_exceptions=False)
        return list(results)

    def get_health_report(self) -> dict[str, ProviderHealth]:
        """获取全局健康报告"""
        return {name: self.get_provider_health(name) for name in self.providers}
