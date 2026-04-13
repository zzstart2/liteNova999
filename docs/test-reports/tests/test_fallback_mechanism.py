"""
PRJ-LITE999-T-015 测试用例
Fallback 机制测试：多服务商故障转移、健康检查、恢复机制测试

聚焦端到端场景 / HealthChecker 联动 / 恢复生命周期 / 性能 / 边界
"""

import asyncio
import time

import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.fallback_router import (
    CircuitBreaker,
    CircuitState,
    FallbackRouter,
    ProviderConfig,
    AllProvidersUnavailableError,
)
from src.health_checker import HealthChecker, HealthStatus, CheckResult


# ============================================================
# Helpers
# ============================================================

class FakeClock:
    def __init__(self, start: float = 1000.0):
        self._now = start
    def __call__(self) -> float:
        return self._now
    def advance(self, seconds: float):
        self._now += seconds


def make_router(
    providers: list[str],
    health_checker: HealthChecker | None = None,
    failure_threshold: int = 3,
    recovery_timeout: float = 10.0,
    clock: FakeClock | None = None,
) -> FallbackRouter:
    configs = [ProviderConfig(name=p, priority=i) for i, p in enumerate(providers)]
    return FallbackRouter(
        model="test-model",
        providers=configs,
        health_checker=health_checker,
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout,
        clock=clock,
    )


def make_health_checker(providers: list[str], window: int = 10) -> HealthChecker:
    hc = HealthChecker(
        providers={p: f"https://{p}.example.com/health" for p in providers},
        window_size=window,
    )
    return hc


def inject_health(hc: HealthChecker, name: str, successes: int, failures: int, rt: float = 0.1):
    """注入健康检查历史"""
    records = []
    for _ in range(successes):
        records.append(CheckResult(name, True, rt, status_code=200))
    for _ in range(failures):
        records.append(CheckResult(name, False, rt, error="fail"))
    hc._history[name] = records


class FailureController:
    """控制哪些服务商在哪些请求轮次失败"""
    def __init__(self):
        self._fail_set: set[str] = set()
        self._call_log: list[str] = []
        self._call_counts: dict[str, int] = {}

    def set_failing(self, *names: str):
        self._fail_set = set(names)

    def set_healthy(self, *names: str):
        self._fail_set -= set(names)

    async def action(self, provider: str):
        self._call_log.append(provider)
        self._call_counts[provider] = self._call_counts.get(provider, 0) + 1
        if provider in self._fail_set:
            raise ConnectionError(f"{provider} is down")
        return f"ok-{provider}"

    @property
    def log(self):
        return self._call_log

    @property
    def counts(self):
        return self._call_counts

    def reset_log(self):
        self._call_log.clear()


# ============================================================
# ST: 场景测试 — 故障转移序列
# ============================================================

class TestFailoverScenarios:

    @pytest.mark.asyncio
    async def test_st001_primary_to_backup(self):
        """ST-001: A 宕机，B 接管"""
        clock = FakeClock()
        router = make_router(["A", "B", "C"], clock=clock)
        ctrl = FailureController()
        ctrl.set_failing("A")

        result = await router.execute(ctrl.action)
        assert result == "ok-B"
        assert ctrl.log == ["A", "B"]

    @pytest.mark.asyncio
    async def test_st002_cascading_failure(self):
        """ST-002: A→B→C 失败，D 兜底"""
        clock = FakeClock()
        router = make_router(["A", "B", "C", "D"], clock=clock)
        ctrl = FailureController()
        ctrl.set_failing("A", "B", "C")

        result = await router.execute(ctrl.action)
        assert result == "ok-D"
        assert ctrl.log == ["A", "B", "C", "D"]

    @pytest.mark.asyncio
    async def test_st003_flash_failure_no_breaker(self):
        """ST-003: A 短暂失败 2 次后恢复，不触发熔断(threshold=3)"""
        clock = FakeClock()
        router = make_router(["A", "B"], failure_threshold=3, clock=clock)
        ctrl = FailureController()

        # 第 1 次: A 失败
        ctrl.set_failing("A")
        r1 = await router.execute(ctrl.action)
        assert r1 == "ok-B"

        # 第 2 次: A 仍失败
        ctrl.reset_log()
        r2 = await router.execute(ctrl.action)
        assert r2 == "ok-B"

        # 第 3 次: A 恢复
        ctrl.set_healthy("A")
        ctrl.reset_log()
        r3 = await router.execute(ctrl.action)
        # A 未熔断(只失败了 2 次 < 3)，应该尝试 A 并成功
        assert r3 == "ok-A"
        assert "A" in ctrl.log

    @pytest.mark.asyncio
    async def test_st004_gradual_degradation(self):
        """ST-004: A 错误率上升 → 健康检查标记 degraded → 降级排序"""
        providers = ["A", "B"]
        hc = make_health_checker(providers)

        # A: 3/10 失败 → degraded (error_rate=0.3)
        inject_health(hc, "A", successes=7, failures=3)
        # B: 全部成功 → healthy
        inject_health(hc, "B", successes=10, failures=0)

        assert hc.get_status("A") == HealthStatus.DEGRADED
        assert hc.get_status("B") == HealthStatus.HEALTHY

        clock = FakeClock()
        router = make_router(providers, health_checker=hc, clock=clock)

        ctrl = FailureController()
        result = await router.execute(ctrl.action)
        # B (healthy) 应该排在 A (degraded) 前面
        assert result == "ok-B"
        assert ctrl.log[0] == "B"

    @pytest.mark.asyncio
    async def test_st005_total_failure(self):
        """ST-005: 所有服务商同时宕机"""
        clock = FakeClock()
        router = make_router(["A", "B", "C"], clock=clock)
        ctrl = FailureController()
        ctrl.set_failing("A", "B", "C")

        with pytest.raises(AllProvidersUnavailableError) as exc:
            await router.execute(ctrl.action)
        assert set(exc.value.tried) == {"A", "B", "C"}

    @pytest.mark.asyncio
    async def test_st006_total_failure_then_gradual_recovery(self):
        """ST-006: 全部故障后逐个恢复 — 最先恢复的接管"""
        clock = FakeClock()
        router = make_router(
            ["A", "B", "C"], failure_threshold=1, recovery_timeout=10.0, clock=clock
        )
        ctrl = FailureController()

        # 全部熔断
        ctrl.set_failing("A", "B", "C")
        with pytest.raises(AllProvidersUnavailableError):
            await router.execute(ctrl.action)

        # B 先恢复
        ctrl.set_healthy("B")
        clock.advance(10.0)  # 所有熔断器进入 HALF_OPEN
        ctrl.reset_log()

        result = await router.execute(ctrl.action)
        # A 在 HALF_OPEN 尝试但失败，B 在 HALF_OPEN 尝试成功
        assert result == "ok-B"

    @pytest.mark.asyncio
    async def test_st007_alternating_failures(self):
        """ST-007: A/B 交替宕机，始终有可用路由"""
        clock = FakeClock()
        router = make_router(
            ["A", "B", "C"], failure_threshold=5, clock=clock
        )
        ctrl = FailureController()

        for i in range(10):
            ctrl.reset_log()
            if i % 2 == 0:
                ctrl.set_failing("A")
                ctrl.set_healthy("B")
            else:
                ctrl.set_healthy("A")
                ctrl.set_failing("B")

            result = await router.execute(ctrl.action)
            assert result.startswith("ok-")  # 始终成功


# ============================================================
# HF: HealthChecker + FallbackRouter 联动
# ============================================================

class TestHealthFallbackIntegration:

    @pytest.mark.asyncio
    async def test_hf001_health_drives_routing(self):
        """HF-001: 健康检查结果驱动路由排序"""
        providers = ["A", "B", "C"]
        hc = make_health_checker(providers)

        inject_health(hc, "A", successes=0, failures=10)   # unhealthy
        inject_health(hc, "B", successes=10, failures=0)    # healthy
        inject_health(hc, "C", successes=7, failures=3)     # degraded

        router = make_router(providers, health_checker=hc)
        sorted_names = [p.name for p in router.get_sorted_providers()]

        assert sorted_names.index("B") < sorted_names.index("C")
        assert sorted_names.index("C") < sorted_names.index("A")

    @pytest.mark.asyncio
    async def test_hf002_health_change_triggers_reroute(self):
        """HF-002: A 从 healthy→unhealthy, 流量转到 B"""
        providers = ["A", "B"]
        hc = make_health_checker(providers)

        # 初始: A healthy
        inject_health(hc, "A", successes=10, failures=0)
        inject_health(hc, "B", successes=10, failures=0)

        router = make_router(providers, health_checker=hc)
        ctrl = FailureController()

        r1 = await router.execute(ctrl.action)
        assert r1 == "ok-A"  # A 优先级更高

        # A 变为 unhealthy
        inject_health(hc, "A", successes=2, failures=8)
        ctrl.reset_log()

        r2 = await router.execute(ctrl.action)
        assert r2 == "ok-B"  # B 现在排前面

    @pytest.mark.asyncio
    async def test_hf003_health_recovery_reroute_back(self):
        """HF-003: A 恢复后流量回切"""
        providers = ["A", "B"]
        hc = make_health_checker(providers)

        # A 先 unhealthy
        inject_health(hc, "A", successes=2, failures=8)
        inject_health(hc, "B", successes=10, failures=0)

        router = make_router(providers, health_checker=hc)
        ctrl = FailureController()

        r1 = await router.execute(ctrl.action)
        assert r1 == "ok-B"

        # A 恢复
        inject_health(hc, "A", successes=10, failures=0)
        ctrl.reset_log()

        r2 = await router.execute(ctrl.action)
        assert r2 == "ok-A"  # 回到 A

    @pytest.mark.asyncio
    async def test_hf004_response_time_tiebreak(self):
        """HF-004: 同为 healthy 时响应快者优先"""
        providers = ["slow", "fast"]
        hc = make_health_checker(providers)

        inject_health(hc, "slow", successes=10, failures=0, rt=0.5)
        inject_health(hc, "fast", successes=10, failures=0, rt=0.05)

        # 给相同优先级
        configs = [
            ProviderConfig(name="slow", priority=0),
            ProviderConfig(name="fast", priority=0),
        ]
        router = FallbackRouter(
            model="test", providers=configs, health_checker=hc,
        )

        ctrl = FailureController()
        result = await router.execute(ctrl.action)
        assert result == "ok-fast"

    @pytest.mark.asyncio
    async def test_hf005_health_and_breaker_coexist(self):
        """HF-005: 健康检查 + 熔断器双重保护"""
        providers = ["A", "B", "C"]
        hc = make_health_checker(providers)
        clock = FakeClock()

        # A: unhealthy by health check
        inject_health(hc, "A", successes=2, failures=8)
        inject_health(hc, "B", successes=10, failures=0)
        inject_health(hc, "C", successes=10, failures=0)

        router = make_router(
            providers, health_checker=hc, failure_threshold=1, clock=clock
        )

        # 同时熔断 B
        router.get_breaker("B").record_failure()
        assert router.get_breaker("B").state == CircuitState.OPEN

        ctrl = FailureController()
        result = await router.execute(ctrl.action)
        # A 排最后(unhealthy), B 被熔断跳过 → C 接管
        assert result == "ok-C"


# ============================================================
# RC: 恢复机制测试
# ============================================================

class TestRecoveryMechanism:

    @pytest.mark.asyncio
    async def test_rc001_full_recovery_cycle(self):
        """RC-001: 熔断→等待→半开探测成功→完全恢复"""
        clock = FakeClock()
        router = make_router(
            ["A", "B"], failure_threshold=2, recovery_timeout=15.0, clock=clock
        )
        ctrl = FailureController()

        # Phase 1: A 连续失败→熔断
        ctrl.set_failing("A")
        await router.execute(ctrl.action)  # A fail, B ok
        await router.execute(ctrl.action)  # A fail(breaker), B ok
        assert router.get_breaker("A").state == CircuitState.OPEN

        # Phase 2: 等待恢复
        clock.advance(15.0)
        assert router.get_breaker("A").state == CircuitState.HALF_OPEN

        # Phase 3: A 恢复, 半开探测成功
        ctrl.set_healthy("A")
        ctrl.reset_log()
        result = await router.execute(ctrl.action)
        assert result == "ok-A"
        assert router.get_breaker("A").state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_rc002_double_recovery(self):
        """RC-002: 半开探测失败→重新熔断→再恢复"""
        clock = FakeClock()
        router = make_router(
            ["A", "B"], failure_threshold=1, recovery_timeout=5.0, clock=clock
        )
        ctrl = FailureController()

        # 第一次熔断
        ctrl.set_failing("A")
        await router.execute(ctrl.action)
        assert router.get_breaker("A").state == CircuitState.OPEN

        # 第一次半开探测 — A 仍然失败
        clock.advance(5.0)
        assert router.get_breaker("A").state == CircuitState.HALF_OPEN
        ctrl.reset_log()
        result = await router.execute(ctrl.action)
        # A 半开探测失败→重新 OPEN, 最终 B 成功
        assert result == "ok-B"
        assert router.get_breaker("A").state == CircuitState.OPEN

        # 第二次半开 — A 恢复
        clock.advance(5.0)
        ctrl.set_healthy("A")
        ctrl.reset_log()
        result = await router.execute(ctrl.action)
        assert result == "ok-A"
        assert router.get_breaker("A").state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_rc003_independent_recovery(self):
        """RC-003: 多服务商各自独立恢复"""
        clock = FakeClock()
        router = make_router(
            ["A", "B", "C"], failure_threshold=1, recovery_timeout=10.0, clock=clock
        )

        # 熔断 A 和 B
        router.get_breaker("A").record_failure()
        router.get_breaker("B").record_failure()

        assert router.get_breaker("A").state == CircuitState.OPEN
        assert router.get_breaker("B").state == CircuitState.OPEN
        assert router.get_breaker("C").state == CircuitState.CLOSED

        # C 仍可用
        ctrl = FailureController()
        result = await router.execute(ctrl.action)
        assert result == "ok-C"

        # 时间推进 → A, B 都进入 HALF_OPEN
        clock.advance(10.0)
        assert router.get_breaker("A").state == CircuitState.HALF_OPEN
        assert router.get_breaker("B").state == CircuitState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_rc004_recovered_provider_priority(self):
        """RC-004: 恢复后按原优先级参与"""
        clock = FakeClock()
        router = make_router(
            ["A", "B"], failure_threshold=1, recovery_timeout=5.0, clock=clock
        )

        # A(priority=0) 先熔断
        router.get_breaker("A").record_failure()
        ctrl = FailureController()
        r1 = await router.execute(ctrl.action)
        assert r1 == "ok-B"

        # A 恢复
        clock.advance(5.0)
        ctrl.reset_log()
        # A 在 HALF_OPEN, 探测成功
        r2 = await router.execute(ctrl.action)
        assert r2 == "ok-A"  # A 优先级更高，恢复后重新排在前面

    @pytest.mark.asyncio
    async def test_rc005_long_recovery_timeout(self):
        """RC-005: 超长 recovery_timeout"""
        clock = FakeClock()
        router = make_router(
            ["A", "B"], failure_threshold=1, recovery_timeout=3600.0, clock=clock
        )
        router.get_breaker("A").record_failure()

        # 30 分钟后仍 OPEN
        clock.advance(1800.0)
        assert router.get_breaker("A").state == CircuitState.OPEN

        # 1 小时后恢复
        clock.advance(1800.0)
        assert router.get_breaker("A").state == CircuitState.HALF_OPEN


# ============================================================
# PT: 性能测试
# ============================================================

class TestPerformance:

    @pytest.mark.asyncio
    async def test_pt001_baseline_latency(self):
        """PT-001: 无故障基线 — 路由开销 < 1ms"""
        router = make_router(["A", "B", "C"])

        async def instant_action(provider: str):
            return f"ok-{provider}"

        # 预热
        await router.execute(instant_action)

        # 测量
        latencies = []
        for _ in range(1000):
            start = time.perf_counter()
            await router.execute(instant_action)
            elapsed = (time.perf_counter() - start) * 1000  # ms
            latencies.append(elapsed)

        latencies.sort()
        p95 = latencies[int(len(latencies) * 0.95)]
        avg = sum(latencies) / len(latencies)

        assert p95 < 1.0, f"P95 latency {p95:.3f}ms exceeds 1ms"
        assert avg < 0.5, f"Avg latency {avg:.3f}ms exceeds 0.5ms"

    @pytest.mark.asyncio
    async def test_pt002_single_fallback_latency(self):
        """PT-002: 单次 Fallback — 额外开销 < 2ms"""
        router = make_router(["A", "B", "C"])

        async def fail_a(provider: str):
            if provider == "A":
                raise ConnectionError("down")
            return f"ok-{provider}"

        # 预热
        await router.execute(fail_a)

        latencies = []
        for _ in range(500):
            start = time.perf_counter()
            await router.execute(fail_a)
            elapsed = (time.perf_counter() - start) * 1000
            latencies.append(elapsed)

        latencies.sort()
        p95 = latencies[int(len(latencies) * 0.95)]
        assert p95 < 2.0, f"P95 fallback latency {p95:.3f}ms exceeds 2ms"

    @pytest.mark.asyncio
    async def test_pt003_concurrent_200(self):
        """PT-003: 200 并发请求全部正确路由"""
        router = make_router(["A", "B", "C"], failure_threshold=999)
        results = []

        fail_a = True

        async def action(provider: str):
            if provider == "A" and fail_a:
                raise ConnectionError("down")
            return f"ok-{provider}"

        tasks = [router.execute(action) for _ in range(200)]
        results = await asyncio.gather(*tasks)

        assert len(results) == 200
        assert all(r.startswith("ok-") for r in results)
        assert all("A" not in r for r in results)

    @pytest.mark.asyncio
    async def test_pt004_stress_5_providers_1000_requests(self):
        """PT-004: 5 服务商 × 1000 请求"""
        providers = ["P1", "P2", "P3", "P4", "P5"]
        router = make_router(providers, failure_threshold=999)

        call_count = 0

        async def action(provider: str):
            nonlocal call_count
            call_count += 1
            return f"ok-{provider}"

        for _ in range(1000):
            result = await router.execute(action)
            assert result.startswith("ok-")

        assert call_count == 1000  # 每次只调一个(首选成功)


# ============================================================
# ET: 边界/异常测试
# ============================================================

class TestEdgeCases:

    @pytest.mark.asyncio
    async def test_et001_all_breakers_simultaneous_recovery(self):
        """ET-001: 所有熔断器同时到达恢复时间"""
        clock = FakeClock()
        router = make_router(
            ["A", "B", "C"], failure_threshold=1, recovery_timeout=10.0, clock=clock
        )

        # 同时熔断所有
        for name in ["A", "B", "C"]:
            router.get_breaker(name).record_failure()

        # 同时恢复到 HALF_OPEN
        clock.advance(10.0)
        for name in ["A", "B", "C"]:
            assert router.get_breaker(name).state == CircuitState.HALF_OPEN

        # 执行请求 — 第一个成功即可
        ctrl = FailureController()
        result = await router.execute(ctrl.action)
        assert result.startswith("ok-")

    @pytest.mark.asyncio
    async def test_et002_dynamic_provider_list(self):
        """ET-002: 运行时服务商列表不影响已构建的 router"""
        providers_list = ["A", "B"]
        router = make_router(providers_list)

        ctrl = FailureController()
        r1 = await router.execute(ctrl.action)
        assert r1 == "ok-A"

        # 修改原列表不影响 router（router 复制了列表）
        providers_list.append("C")
        ctrl.reset_log()
        r2 = await router.execute(ctrl.action)
        assert r2 == "ok-A"
        assert "C" not in ctrl.log

    @pytest.mark.asyncio
    async def test_et003_non_standard_exception(self):
        """ET-003: action 抛出各种异常类型"""
        router = make_router(["A", "B", "C"])
        call_idx = 0

        async def diverse_errors(provider: str):
            nonlocal call_idx
            call_idx += 1
            if call_idx == 1:
                raise ValueError("bad value")
            if call_idx == 2:
                raise RuntimeError("runtime issue")
            return f"ok-{provider}"

        result = await router.execute(diverse_errors)
        assert result == "ok-C"

    @pytest.mark.asyncio
    async def test_et004_extreme_config(self):
        """ET-004: threshold=1, timeout=0"""
        clock = FakeClock()
        router = make_router(
            ["A"], failure_threshold=1, recovery_timeout=0.0, clock=clock
        )

        # 一次失败即熔断
        router.get_breaker("A").record_failure()
        # timeout=0 → 立即 HALF_OPEN
        assert router.get_breaker("A").state == CircuitState.HALF_OPEN

        ctrl = FailureController()
        result = await router.execute(ctrl.action)
        assert result == "ok-A"

    @pytest.mark.asyncio
    async def test_et005_slow_success_no_breaker(self):
        """ET-005: 成功但极慢 → 不触发熔断，但健康检查可标记"""
        providers = ["slow"]
        hc = make_health_checker(providers)

        # 全部成功但响应很慢
        inject_health(hc, "slow", successes=10, failures=0, rt=5.0)
        assert hc.get_status("slow") == HealthStatus.HEALTHY  # 成功就是 healthy
        assert hc.get_avg_response_time("slow") == 5.0  # 但响应时间很高

        router = make_router(providers, health_checker=hc)
        assert router.get_breaker("slow").state == CircuitState.CLOSED  # 未熔断

    @pytest.mark.asyncio
    async def test_consecutive_recoveries(self):
        """多次连续熔断-恢复循环"""
        clock = FakeClock()
        router = make_router(
            ["A", "B"], failure_threshold=1, recovery_timeout=5.0, clock=clock
        )
        ctrl = FailureController()

        for cycle in range(5):
            # 熔断 A
            ctrl.set_failing("A")
            await router.execute(ctrl.action)  # A fail → B ok
            assert router.get_breaker("A").state == CircuitState.OPEN

            # 恢复 A
            clock.advance(5.0)
            ctrl.set_healthy("A")
            ctrl.reset_log()
            result = await router.execute(ctrl.action)
            assert result == "ok-A"
            assert router.get_breaker("A").state == CircuitState.CLOSED
