"""
PRJ-LITE999-T-009 测试用例
智能 Fallback 策略：同模型跨服务商智能切换、熔断、恢复策略

覆盖：单元测试 (UT)、集成测试 (IT)、边界/异常测试 (ET)
"""

import asyncio
import time
from unittest.mock import MagicMock, patch

import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.fallback_router import (
    CircuitBreaker,
    CircuitState,
    CircuitOpenError,
    FallbackRouter,
    ProviderConfig,
    AllProvidersUnavailableError,
)
from src.health_checker import HealthChecker, HealthStatus


# ============================================================
# Helpers
# ============================================================

class FakeClock:
    """可控时钟，用于测试时间相关逻辑"""
    def __init__(self, start: float = 1000.0):
        self._now = start

    def __call__(self) -> float:
        return self._now

    def advance(self, seconds: float):
        self._now += seconds


def make_router(
    providers: list[str] | None = None,
    health_checker: HealthChecker | None = None,
    failure_threshold: int = 3,
    recovery_timeout: float = 10.0,
    clock: FakeClock | None = None,
) -> FallbackRouter:
    """快速构建 FallbackRouter"""
    if providers is None:
        providers = ["provider_a", "provider_b", "provider_c"]
    configs = [ProviderConfig(name=p, priority=i) for i, p in enumerate(providers)]
    return FallbackRouter(
        model="gpt-4",
        providers=configs,
        health_checker=health_checker,
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout,
        clock=clock,
    )


# ============================================================
# UT-001 ~ UT-010: 熔断器 CircuitBreaker
# ============================================================

class TestCircuitBreaker:

    def test_ut001_initial_state(self):
        """UT-001: 初始状态 CLOSED，允许请求"""
        clock = FakeClock()
        cb = CircuitBreaker("test", failure_threshold=3, clock=clock)
        assert cb.state == CircuitState.CLOSED
        assert cb.allow_request() is True

    def test_ut002_failures_below_threshold(self):
        """UT-002: 连续失败未达阈值 → 保持 CLOSED"""
        clock = FakeClock()
        cb = CircuitBreaker("test", failure_threshold=5, clock=clock)
        for _ in range(4):
            cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        assert cb.allow_request() is True

    def test_ut003_failures_reach_threshold(self):
        """UT-003: 连续失败达阈值 → OPEN"""
        clock = FakeClock()
        cb = CircuitBreaker("test", failure_threshold=3, clock=clock)
        for _ in range(3):
            cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.allow_request() is False

    def test_ut004_open_rejects_request(self):
        """UT-004: OPEN 态拒绝请求"""
        clock = FakeClock()
        cb = CircuitBreaker("test", failure_threshold=1, clock=clock)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.allow_request() is False
        # retry_after 应 > 0
        assert cb.get_retry_after() > 0

    def test_ut005_open_to_half_open_after_timeout(self):
        """UT-005: OPEN 超时 → HALF_OPEN"""
        clock = FakeClock()
        cb = CircuitBreaker(
            "test", failure_threshold=1, recovery_timeout=10.0, clock=clock
        )
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        clock.advance(10.0)
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.allow_request() is True

    def test_ut006_half_open_success_closes(self):
        """UT-006: HALF_OPEN 探测成功 → CLOSED"""
        clock = FakeClock()
        cb = CircuitBreaker(
            "test", failure_threshold=1, recovery_timeout=5.0, clock=clock
        )
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        clock.advance(5.0)
        assert cb.state == CircuitState.HALF_OPEN

        cb.on_probe_start()
        cb.record_success()
        assert cb.state == CircuitState.CLOSED
        assert cb.allow_request() is True
        # 失败计数清零
        assert cb.get_stats().failure_count == 0

    def test_ut007_half_open_failure_reopens(self):
        """UT-007: HALF_OPEN 探测失败 → OPEN"""
        clock = FakeClock()
        cb = CircuitBreaker(
            "test", failure_threshold=1, recovery_timeout=5.0, clock=clock
        )
        cb.record_failure()
        clock.advance(5.0)
        assert cb.state == CircuitState.HALF_OPEN

        cb.on_probe_start()
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.allow_request() is False

    def test_ut008_success_resets_failure_count(self):
        """UT-008: 中间穿插成功 → 不触发熔断"""
        clock = FakeClock()
        cb = CircuitBreaker("test", failure_threshold=3, clock=clock)
        cb.record_failure()
        cb.record_failure()
        # 还差一次，但来了一次成功
        cb.record_success()
        assert cb.state == CircuitState.CLOSED
        assert cb.get_stats().failure_count == 0

        # 再来 2 次失败，仍不触发（因为被重置了）
        cb.record_failure()
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED

    def test_ut009_custom_threshold_and_timeout(self):
        """UT-009: 自定义阈值与超时参数生效"""
        clock = FakeClock()
        cb = CircuitBreaker(
            "test", failure_threshold=10, recovery_timeout=60.0, clock=clock
        )
        # 9 次失败不触发
        for _ in range(9):
            cb.record_failure()
        assert cb.state == CircuitState.CLOSED

        # 第 10 次触发
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

        # 59 秒后仍然 OPEN
        clock.advance(59.0)
        assert cb.state == CircuitState.OPEN

        # 60 秒后 → HALF_OPEN
        clock.advance(1.0)
        assert cb.state == CircuitState.HALF_OPEN

    def test_ut010_stats_query(self):
        """UT-010: 状态查询返回正确指标"""
        clock = FakeClock()
        cb = CircuitBreaker("test", failure_threshold=5, clock=clock)
        cb.record_success()
        cb.record_failure()
        cb.record_failure()

        stats = cb.get_stats()
        assert stats.state == CircuitState.CLOSED
        assert stats.failure_count == 2
        assert stats.success_count == 1
        assert stats.last_failure_time is not None
        assert stats.last_success_time is not None


# ============================================================
# UT-011 ~ UT-017: Fallback 路由
# ============================================================

class TestFallbackRouting:

    @pytest.mark.asyncio
    async def test_ut011_primary_success(self):
        """UT-011: 首选正常 → 直接使用，无 Fallback"""
        router = make_router()
        call_log = []

        async def action(provider: str):
            call_log.append(provider)
            return f"ok-{provider}"

        result = await router.execute(action)
        assert result == "ok-provider_a"
        assert call_log == ["provider_a"]

    @pytest.mark.asyncio
    async def test_ut012_fallback_to_secondary(self):
        """UT-012: 首选失败 → 自动切换到次选"""
        router = make_router()
        call_log = []

        async def action(provider: str):
            call_log.append(provider)
            if provider == "provider_a":
                raise ConnectionError("provider_a down")
            return f"ok-{provider}"

        result = await router.execute(action)
        assert result == "ok-provider_b"
        assert "provider_a" in call_log
        assert "provider_b" in call_log

    @pytest.mark.asyncio
    async def test_ut013_cascading_fallback(self):
        """UT-013: A 失败 → B 失败 → C 成功"""
        router = make_router()
        call_log = []

        async def action(provider: str):
            call_log.append(provider)
            if provider in ("provider_a", "provider_b"):
                raise ConnectionError(f"{provider} down")
            return f"ok-{provider}"

        result = await router.execute(action)
        assert result == "ok-provider_c"
        assert call_log == ["provider_a", "provider_b", "provider_c"]

    @pytest.mark.asyncio
    async def test_ut014_skip_circuit_open(self):
        """UT-014: 已熔断的服务商被跳过"""
        clock = FakeClock()
        router = make_router(failure_threshold=1, clock=clock)

        # 手动熔断 provider_a
        breaker_a = router.get_breaker("provider_a")
        breaker_a.record_failure()
        assert breaker_a.state == CircuitState.OPEN

        call_log = []

        async def action(provider: str):
            call_log.append(provider)
            return f"ok-{provider}"

        result = await router.execute(action)
        assert "provider_a" not in call_log
        assert result.startswith("ok-")

    @pytest.mark.asyncio
    async def test_ut015_all_fail(self):
        """UT-015: 所有服务商均失败 → AllProvidersUnavailableError"""
        router = make_router()

        async def action(provider: str):
            raise ConnectionError(f"{provider} down")

        with pytest.raises(AllProvidersUnavailableError) as exc_info:
            await router.execute(action)

        assert exc_info.value.model == "gpt-4"
        assert len(exc_info.value.tried) == 3

    @pytest.mark.asyncio
    async def test_ut016_health_priority_sorting(self):
        """UT-016: 健康优先排序 healthy > degraded > unhealthy"""
        # 构建 HealthChecker 并注入不同状态
        from src.health_checker import CheckResult
        hc = HealthChecker(
            providers={
                "provider_a": "https://a.com",
                "provider_b": "https://b.com",
                "provider_c": "https://c.com",
            },
            window_size=10,
        )
        # A: unhealthy (全失败)
        hc._history["provider_a"] = [
            CheckResult("provider_a", False, 0.1, error="fail") for _ in range(10)
        ]
        # B: healthy (全成功)
        hc._history["provider_b"] = [
            CheckResult("provider_b", True, 0.1, status_code=200) for _ in range(10)
        ]
        # C: degraded (3/10 失败)
        hc._history["provider_c"] = (
            [CheckResult("provider_c", True, 0.1, status_code=200) for _ in range(7)]
            + [CheckResult("provider_c", False, 0.1, error="fail") for _ in range(3)]
        )

        router = make_router(health_checker=hc)
        sorted_names = [p.name for p in router.get_sorted_providers()]

        # B (healthy) 应在 C (degraded) 之前，C 在 A (unhealthy) 之前
        assert sorted_names.index("provider_b") < sorted_names.index("provider_c")
        assert sorted_names.index("provider_c") < sorted_names.index("provider_a")

    @pytest.mark.asyncio
    async def test_ut017_response_time_weight(self):
        """UT-017: 同健康状态下，响应时间快的优先"""
        from src.health_checker import CheckResult
        hc = HealthChecker(
            providers={
                "fast": "https://fast.com",
                "slow": "https://slow.com",
            },
            window_size=10,
        )
        # 都 healthy，但 fast 响应更快
        hc._history["fast"] = [
            CheckResult("fast", True, 0.05, status_code=200) for _ in range(10)
        ]
        hc._history["slow"] = [
            CheckResult("slow", True, 0.5, status_code=200) for _ in range(10)
        ]

        configs = [
            ProviderConfig(name="slow", priority=0),
            ProviderConfig(name="fast", priority=0),
        ]
        router = FallbackRouter(
            model="gpt-4", providers=configs, health_checker=hc
        )
        sorted_names = [p.name for p in router.get_sorted_providers()]
        assert sorted_names[0] == "fast"


# ============================================================
# IT-001 ~ IT-005: 集成测试 — 熔断 + Fallback 联动
# ============================================================

class TestIntegration:

    @pytest.mark.asyncio
    async def test_it001_breaker_triggers_fallback(self):
        """IT-001: A 熔断 → 自动切换到 B"""
        clock = FakeClock()
        router = make_router(failure_threshold=2, clock=clock)

        # 让 A 连续失败 2 次触发熔断
        async def fail_a(provider: str):
            if provider == "provider_a":
                raise ConnectionError("A down")
            return f"ok-{provider}"

        await router.execute(fail_a)  # A 失败 → fallback B
        await router.execute(fail_a)  # A 熔断，跳过 → 直接 B

        call_log = []

        async def log_action(provider: str):
            call_log.append(provider)
            return f"ok-{provider}"

        result = await router.execute(log_action)
        # A 已熔断，应该直接用 B
        assert "provider_a" not in call_log
        assert result == "ok-provider_b"

    @pytest.mark.asyncio
    async def test_it002_recovery_reactivates(self):
        """IT-002: A 熔断恢复后重新可用"""
        clock = FakeClock()
        router = make_router(
            failure_threshold=1, recovery_timeout=10.0, clock=clock
        )

        # 熔断 A
        breaker_a = router.get_breaker("provider_a")
        breaker_a.record_failure()
        assert breaker_a.state == CircuitState.OPEN

        # 时间推进让 A 恢复到 HALF_OPEN
        clock.advance(10.0)
        assert breaker_a.state == CircuitState.HALF_OPEN

        call_log = []

        async def action(provider: str):
            call_log.append(provider)
            return f"ok-{provider}"

        result = await router.execute(action)
        # A 在 HALF_OPEN 可接受探测请求
        assert "provider_a" in call_log
        assert result == "ok-provider_a"
        # 探测成功后恢复 CLOSED
        assert breaker_a.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_it003_full_breaker_lifecycle(self):
        """IT-003: 完整链路：正常→累积失败→熔断→Fallback"""
        clock = FakeClock()
        router = make_router(failure_threshold=3, clock=clock)

        request_count = 0
        a_fail_after = 2  # A 前 2 次成功，之后失败

        async def action(provider: str):
            nonlocal request_count
            request_count += 1
            if provider == "provider_a" and request_count > a_fail_after:
                raise ConnectionError("A degraded")
            return f"ok-{provider}"

        # 前 2 次：A 正常
        r1 = await router.execute(action)
        assert r1 == "ok-provider_a"
        r2 = await router.execute(action)
        assert r2 == "ok-provider_a"

        # 第 3~5 次：A 失败，Fallback 到 B，同时 A 的失败累积
        for _ in range(3):
            result = await router.execute(action)
            assert "ok-provider_b" == result or "ok-provider_c" == result

        # 此时 A 应该已经熔断（3 次失败）
        assert router.get_breaker("provider_a").state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_it004_all_breakers_open_then_recover(self):
        """IT-004: 全部熔断 → 等待恢复 → 半开探测 → 恢复"""
        clock = FakeClock()
        router = make_router(
            providers=["a", "b"],
            failure_threshold=1,
            recovery_timeout=5.0,
            clock=clock,
        )

        # 熔断全部
        for name in ["a", "b"]:
            router.get_breaker(name).record_failure()

        # 全部 OPEN，应该抛异常
        async def action(provider: str):
            return f"ok-{provider}"

        with pytest.raises(AllProvidersUnavailableError):
            await router.execute(action)

        # 时间推进 → HALF_OPEN
        clock.advance(5.0)
        assert router.get_breaker("a").state == CircuitState.HALF_OPEN

        # 现在可以通过探测
        result = await router.execute(action)
        assert result.startswith("ok-")

        # 探测成功 → CLOSED
        # 至少一个恢复了
        any_closed = any(
            router.get_breaker(n).state == CircuitState.CLOSED
            for n in ["a", "b"]
        )
        assert any_closed

    @pytest.mark.asyncio
    async def test_it005_concurrent_fallback(self):
        """IT-005: 并发请求正确路由"""
        clock = FakeClock()
        router = make_router(failure_threshold=100, clock=clock)  # 高阈值不触发熔断

        call_counts: dict[str, int] = {}

        async def action(provider: str):
            call_counts[provider] = call_counts.get(provider, 0) + 1
            await asyncio.sleep(0)  # 模拟异步
            return f"ok-{provider}"

        # 并发 10 个请求
        tasks = [router.execute(action) for _ in range(10)]
        results = await asyncio.gather(*tasks)

        assert len(results) == 10
        assert all(r.startswith("ok-") for r in results)


# ============================================================
# ET-001 ~ ET-005: 边界/异常测试
# ============================================================

class TestEdgeCases:

    @pytest.mark.asyncio
    async def test_et001_single_provider_circuit_open(self):
        """ET-001: 仅一个服务商且熔断 → AllProvidersUnavailableError"""
        clock = FakeClock()
        router = make_router(
            providers=["only_one"],
            failure_threshold=1,
            clock=clock,
        )
        router.get_breaker("only_one").record_failure()

        async def action(provider: str):
            return "ok"

        with pytest.raises(AllProvidersUnavailableError) as exc_info:
            await router.execute(action)
        assert exc_info.value.tried == []

    @pytest.mark.asyncio
    async def test_et002_zero_providers(self):
        """ET-002: 零服务商 → 立即抛异常"""
        router = make_router(providers=[])

        async def action(provider: str):
            return "ok"

        with pytest.raises(AllProvidersUnavailableError):
            await router.execute(action)

    @pytest.mark.asyncio
    async def test_et003_threshold_one(self):
        """ET-003: 熔断阈值=1 → 一次失败即熔断"""
        clock = FakeClock()
        cb = CircuitBreaker("test", failure_threshold=1, clock=clock)
        cb.record_failure()
        assert cb.state == CircuitState.OPEN

    def test_et004_recovery_timeout_zero(self):
        """ET-004: 恢复超时=0 → 熔断后立即进入半开"""
        clock = FakeClock()
        cb = CircuitBreaker(
            "test", failure_threshold=1, recovery_timeout=0.0, clock=clock
        )
        cb.record_failure()
        # 不需要时间推进，立即应该是 HALF_OPEN
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.allow_request() is True

    @pytest.mark.asyncio
    async def test_et005_diverse_exception_types(self):
        """ET-005: 多种异常类型均触发 Fallback"""
        router = make_router()
        call_idx = 0

        async def action(provider: str):
            nonlocal call_idx
            call_idx += 1
            if call_idx == 1:
                raise TimeoutError("timeout")
            if call_idx == 2:
                raise ConnectionRefusedError("refused")
            return f"ok-{provider}"

        result = await router.execute(action)
        assert result.startswith("ok-")
        assert call_idx == 3  # 前两个失败，第三个成功


# ============================================================
# 额外: 构造与查询
# ============================================================

class TestConstruction:

    def test_router_breaker_per_provider(self):
        """每个服务商有独立熔断器"""
        router = make_router(providers=["x", "y", "z"])
        assert set(router.get_all_breaker_stats().keys()) == {"x", "y", "z"}

    def test_circuit_open_error_fields(self):
        """CircuitOpenError 包含正确字段"""
        err = CircuitOpenError("test_provider", retry_after=5.0)
        assert err.provider_name == "test_provider"
        assert err.retry_after == 5.0
        assert "test_provider" in str(err)

    def test_all_providers_unavailable_error_fields(self):
        """AllProvidersUnavailableError 包含正确字段"""
        err = AllProvidersUnavailableError("gpt-4", ["a", "b"])
        assert err.model == "gpt-4"
        assert err.tried == ["a", "b"]
        assert "gpt-4" in str(err)
