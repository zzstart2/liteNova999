"""
PRJ-LITE999-T-009: 智能 Fallback 策略实现
功能：同模型跨服务商智能切换、熔断、恢复策略
依赖：T-008 HealthChecker
"""

import time
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Awaitable, Optional

from src.health_checker import HealthChecker, HealthStatus


# ============================================================
# Exceptions
# ============================================================

class CircuitOpenError(Exception):
    """熔断器处于打开状态，拒绝请求"""
    def __init__(self, provider_name: str, retry_after: float = 0):
        self.provider_name = provider_name
        self.retry_after = retry_after
        super().__init__(
            f"Circuit breaker OPEN for '{provider_name}', retry after {retry_after:.1f}s"
        )


class AllProvidersUnavailableError(Exception):
    """所有服务商均不可用"""
    def __init__(self, model: str, tried: list[str] | None = None):
        self.model = model
        self.tried = tried or []
        super().__init__(
            f"All providers unavailable for model '{model}'. Tried: {self.tried}"
        )


# ============================================================
# CircuitBreaker — 熔断器
# ============================================================

class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitStats:
    """熔断器统计"""
    state: CircuitState
    failure_count: int
    success_count: int
    last_failure_time: Optional[float]
    last_success_time: Optional[float]


class CircuitBreaker:
    """
    服务商级别熔断器

    状态机:
        CLOSED  --[failures >= threshold]--> OPEN
        OPEN    --[recovery_timeout 过期]--> HALF_OPEN
        HALF_OPEN --[probe success]--------> CLOSED
        HALF_OPEN --[probe failure]--------> OPEN
    """

    def __init__(
        self,
        provider_name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_probes: int = 1,
        clock: Callable[[], float] | None = None,
    ):
        self.provider_name = provider_name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_probes = half_open_max_probes
        self._clock = clock or time.monotonic

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._half_open_probes = 0
        self._last_failure_time: Optional[float] = None
        self._last_success_time: Optional[float] = None
        self._opened_at: Optional[float] = None

    @property
    def state(self) -> CircuitState:
        """获取当前状态，含 OPEN→HALF_OPEN 自动转换"""
        if self._state == CircuitState.OPEN and self._opened_at is not None:
            elapsed = self._clock() - self._opened_at
            if elapsed >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._half_open_probes = 0
        return self._state

    def allow_request(self) -> bool:
        """当前是否允许请求通过"""
        s = self.state  # 触发自动转换
        if s == CircuitState.CLOSED:
            return True
        if s == CircuitState.HALF_OPEN:
            return self._half_open_probes < self.half_open_max_probes
        return False  # OPEN

    def record_success(self) -> None:
        """记录成功"""
        now = self._clock()
        self._last_success_time = now
        self._success_count += 1

        s = self.state
        if s == CircuitState.HALF_OPEN:
            # 探测成功 → 关闭熔断
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._half_open_probes = 0
            self._opened_at = None
        elif s == CircuitState.CLOSED:
            # 成功重置失败计数
            self._failure_count = 0

    def record_failure(self) -> None:
        """记录失败"""
        now = self._clock()
        self._last_failure_time = now
        self._failure_count += 1

        s = self.state
        if s == CircuitState.HALF_OPEN:
            # 探测失败 → 重新打开
            self._state = CircuitState.OPEN
            self._opened_at = now
            self._half_open_probes = 0
        elif s == CircuitState.CLOSED:
            if self._failure_count >= self.failure_threshold:
                self._state = CircuitState.OPEN
                self._opened_at = now

    def on_probe_start(self) -> None:
        """半开态探测计数"""
        if self.state == CircuitState.HALF_OPEN:
            self._half_open_probes += 1

    def get_stats(self) -> CircuitStats:
        return CircuitStats(
            state=self.state,
            failure_count=self._failure_count,
            success_count=self._success_count,
            last_failure_time=self._last_failure_time,
            last_success_time=self._last_success_time,
        )

    def get_retry_after(self) -> float:
        """OPEN 态下距离恢复的剩余秒数"""
        if self._state == CircuitState.OPEN and self._opened_at is not None:
            remaining = self.recovery_timeout - (self._clock() - self._opened_at)
            return max(0.0, remaining)
        return 0.0


# ============================================================
# ProviderConfig
# ============================================================

@dataclass
class ProviderConfig:
    """单个服务商配置"""
    name: str
    priority: int = 0  # 数字越小优先级越高
    weight: float = 1.0  # 响应时间权重（暂保留）


# ============================================================
# FallbackRouter — 智能路由
# ============================================================

class FallbackRouter:
    """
    同模型跨服务商智能 Fallback 路由器

    功能：
    - 按优先级 + 健康状态选择最优服务商
    - 请求失败自动 Fallback 到下一个
    - 集成熔断器保护
    - 全部不可用时抛出 AllProvidersUnavailableError
    """

    def __init__(
        self,
        model: str,
        providers: list[ProviderConfig],
        health_checker: HealthChecker | None = None,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        clock: Callable[[], float] | None = None,
    ):
        self.model = model
        self.providers = providers
        self.health_checker = health_checker
        self._clock = clock or time.monotonic

        # 每个服务商一个熔断器
        self._breakers: dict[str, CircuitBreaker] = {}
        for p in providers:
            self._breakers[p.name] = CircuitBreaker(
                provider_name=p.name,
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout,
                clock=self._clock,
            )

    def _health_sort_key(self, provider: ProviderConfig) -> tuple:
        """排序键: (健康权重, 优先级, 响应时间)"""
        health_order = {
            HealthStatus.HEALTHY: 0,
            HealthStatus.UNKNOWN: 1,
            HealthStatus.DEGRADED: 2,
            HealthStatus.UNHEALTHY: 3,
        }

        if self.health_checker:
            status = self.health_checker.get_status(provider.name)
            avg_rt = self.health_checker.get_avg_response_time(provider.name) or 0.0
        else:
            status = HealthStatus.UNKNOWN
            avg_rt = 0.0

        return (health_order.get(status, 99), provider.priority, avg_rt)

    def get_sorted_providers(self) -> list[ProviderConfig]:
        """按健康状态 + 优先级排序的服务商列表"""
        return sorted(self.providers, key=self._health_sort_key)

    def get_available_providers(self) -> list[ProviderConfig]:
        """获取当前可用（未熔断）的服务商列表，已排序"""
        result = []
        for p in self.get_sorted_providers():
            breaker = self._breakers[p.name]
            if breaker.allow_request():
                result.append(p)
        return result

    async def execute(
        self,
        action: Callable[[str], Awaitable[Any]],
    ) -> Any:
        """
        执行请求，自动 Fallback

        Args:
            action: async callable，接收 provider_name，返回结果或抛异常
        Returns:
            首个成功的结果
        Raises:
            AllProvidersUnavailableError: 所有服务商都失败/熔断
        """
        if not self.providers:
            raise AllProvidersUnavailableError(self.model, [])

        sorted_providers = self.get_sorted_providers()
        tried: list[str] = []
        last_error: Exception | None = None

        for provider in sorted_providers:
            breaker = self._breakers[provider.name]

            if not breaker.allow_request():
                continue

            tried.append(provider.name)

            if breaker.state == CircuitState.HALF_OPEN:
                breaker.on_probe_start()

            try:
                result = await action(provider.name)
                breaker.record_success()
                return result
            except Exception as e:
                last_error = e
                breaker.record_failure()
                continue

        raise AllProvidersUnavailableError(self.model, tried)

    def get_breaker(self, provider_name: str) -> CircuitBreaker:
        """获取指定服务商的熔断器"""
        return self._breakers[provider_name]

    def get_all_breaker_stats(self) -> dict[str, CircuitStats]:
        """获取所有熔断器状态"""
        return {name: b.get_stats() for name, b in self._breakers.items()}
