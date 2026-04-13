"""
PRJ-LITE999-T-008 测试用例
多服务商健康检查机制：响应时间、错误率、可用性检测

覆盖：单元测试 (UT)、集成测试 (IT)、边界/异常测试 (ET)
"""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import aiohttp

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.health_checker import (
    HealthChecker,
    HealthStatus,
    CheckResult,
    ProviderHealth,
)


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def checker():
    """标准健康检查器，3 个服务商，窗口=10"""
    return HealthChecker(
        providers={
            "provider_a": "https://api-a.example.com/health",
            "provider_b": "https://api-b.example.com/health",
            "provider_c": "https://api-c.example.com/health",
        },
        window_size=10,
        timeout=5.0,
    )


@pytest.fixture
def empty_checker():
    """无服务商的健康检查器"""
    return HealthChecker(providers={}, window_size=10, timeout=5.0)


@pytest.fixture
def single_checker():
    """单服务商健康检查器"""
    return HealthChecker(
        providers={"solo": "https://solo.example.com/health"},
        window_size=5,
        timeout=5.0,
    )


def make_result(name: str, success: bool, response_time: float = 0.1,
                status_code: int = 200, error: str = None) -> CheckResult:
    """辅助: 快速创建 CheckResult"""
    return CheckResult(
        provider_name=name,
        success=success,
        response_time=response_time,
        status_code=status_code,
        error=error,
    )


def inject_history(checker: HealthChecker, name: str, results: list[CheckResult]):
    """辅助: 直接注入历史记录"""
    checker._history[name] = results


# ============================================================
# UT: 单元测试 — 单个服务商健康检查
# ============================================================

class TestSingleProviderCheck:
    """UT-001 ~ UT-005: 单个服务商健康检查"""

    @pytest.mark.asyncio
    async def test_ut001_normal_response(self, single_checker):
        """UT-001: 正常响应 → healthy，记录响应时间"""
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock(spec=aiohttp.ClientSession)
        mock_session.get = MagicMock(return_value=mock_resp)

        result = await single_checker.check_provider(
            "solo", "https://solo.example.com/health", session=mock_session
        )

        assert result.success is True
        assert result.response_time >= 0
        assert result.status_code == 200
        assert result.error is None
        assert single_checker.get_status("solo") == HealthStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_ut002_timeout(self, single_checker):
        """UT-002: 超时 → 失败，响应时间 = 超时阈值"""
        mock_session = AsyncMock(spec=aiohttp.ClientSession)
        mock_session.get = MagicMock(side_effect=asyncio.TimeoutError())

        result = await single_checker.check_provider(
            "solo", "https://solo.example.com/health", session=mock_session
        )

        assert result.success is False
        assert result.response_time == single_checker.timeout
        assert result.error == "Timeout"

    @pytest.mark.asyncio
    async def test_ut003_connection_refused(self, single_checker):
        """UT-003: 连接拒绝 → 失败，错误信息正确"""
        mock_session = AsyncMock(spec=aiohttp.ClientSession)
        mock_session.get = MagicMock(
            side_effect=aiohttp.ClientConnectorError(
                connection_key=MagicMock(), os_error=OSError("Connection refused")
            )
        )

        result = await single_checker.check_provider(
            "solo", "https://solo.example.com/health", session=mock_session
        )

        assert result.success is False
        assert result.error is not None
        assert "Connection refused" in result.error or "Cannot connect" in result.error

    @pytest.mark.asyncio
    async def test_ut004_http_5xx(self, single_checker):
        """UT-004: HTTP 500 → 失败"""
        mock_resp = AsyncMock()
        mock_resp.status = 500
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock(spec=aiohttp.ClientSession)
        mock_session.get = MagicMock(return_value=mock_resp)

        result = await single_checker.check_provider(
            "solo", "https://solo.example.com/health", session=mock_session
        )

        assert result.success is False
        assert result.status_code == 500
        assert "500" in result.error

    @pytest.mark.asyncio
    async def test_ut005_http_4xx(self, single_checker):
        """UT-005: HTTP 403 → 失败"""
        mock_resp = AsyncMock()
        mock_resp.status = 403
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock(spec=aiohttp.ClientSession)
        mock_session.get = MagicMock(return_value=mock_resp)

        result = await single_checker.check_provider(
            "solo", "https://solo.example.com/health", session=mock_session
        )

        assert result.success is False
        assert result.status_code == 403


# ============================================================
# UT: 错误率计算
# ============================================================

class TestErrorRate:
    """UT-006 ~ UT-009: 错误率计算"""

    def test_ut006_all_success(self, checker):
        """UT-006: 全部成功 → error_rate = 0.0"""
        results = [make_result("provider_a", True) for _ in range(10)]
        inject_history(checker, "provider_a", results)
        assert checker.get_error_rate("provider_a") == 0.0

    def test_ut007_all_failure(self, checker):
        """UT-007: 全部失败 → error_rate = 1.0"""
        results = [make_result("provider_a", False, error="fail") for _ in range(10)]
        inject_history(checker, "provider_a", results)
        assert checker.get_error_rate("provider_a") == 1.0

    def test_ut008_partial_failure(self, checker):
        """UT-008: 3/10 失败 → error_rate = 0.3"""
        results = [make_result("provider_a", True) for _ in range(7)]
        results += [make_result("provider_a", False, error="fail") for _ in range(3)]
        inject_history(checker, "provider_a", results)
        rate = checker.get_error_rate("provider_a")
        assert rate == pytest.approx(0.3)

    def test_ut009_sliding_window(self, single_checker):
        """UT-009: 滑动窗口=5，插入 8 条，只统计最后 5 条"""
        # 前 3 条全失败
        old = [make_result("solo", False, error="fail") for _ in range(3)]
        # 后 5 条全成功
        new = [make_result("solo", True) for _ in range(5)]
        for r in old + new:
            single_checker._record("solo", r)

        # 窗口=5，只看最后 5 条（全成功）
        assert single_checker.get_error_rate("solo") == 0.0


# ============================================================
# UT: 可用性判定
# ============================================================

class TestAvailability:
    """UT-010 ~ UT-012, UT-015: 可用性判定"""

    def test_ut010_healthy(self, checker):
        """UT-010: error_rate < 0.1 → healthy"""
        # 10 条全成功 → error_rate = 0
        results = [make_result("provider_a", True) for _ in range(10)]
        inject_history(checker, "provider_a", results)
        assert checker.get_status("provider_a") == HealthStatus.HEALTHY

    def test_ut011_degraded(self, checker):
        """UT-011: 0.1 ≤ error_rate < 0.5 → degraded"""
        # 7 成功 + 3 失败 → error_rate = 0.3
        results = [make_result("provider_a", True) for _ in range(7)]
        results += [make_result("provider_a", False, error="fail") for _ in range(3)]
        inject_history(checker, "provider_a", results)
        assert checker.get_status("provider_a") == HealthStatus.DEGRADED

    def test_ut012_unhealthy(self, checker):
        """UT-012: error_rate ≥ 0.5 → unhealthy"""
        # 5 成功 + 5 失败 → error_rate = 0.5
        results = [make_result("provider_a", True) for _ in range(5)]
        results += [make_result("provider_a", False, error="fail") for _ in range(5)]
        inject_history(checker, "provider_a", results)
        assert checker.get_status("provider_a") == HealthStatus.UNHEALTHY

    def test_ut015_no_history(self, checker):
        """UT-015: 无历史数据 → unknown"""
        assert checker.get_status("provider_a") == HealthStatus.UNKNOWN


# ============================================================
# UT: 响应时间统计
# ============================================================

class TestResponseTimeStats:
    """UT-013, UT-014: 响应时间统计"""

    def test_ut013_avg_response_time(self, checker):
        """UT-013: 平均响应时间"""
        times = [0.1, 0.2, 0.15, 0.3, 0.25]
        results = [make_result("provider_a", True, rt) for rt in times]
        inject_history(checker, "provider_a", results)
        avg = checker.get_avg_response_time("provider_a")
        assert avg == pytest.approx(sum(times) / len(times))

    def test_ut014_p95_response_time(self, checker):
        """UT-014: P95 响应时间"""
        times = [0.1 * (i + 1) for i in range(20)]  # 0.1 ~ 2.0
        results = [make_result("provider_a", True, t) for t in times]
        inject_history(checker, "provider_a", results)
        # 窗口=10 → 最后 10 条: 1.1, 1.2, ..., 2.0
        # P95 index = int(10 * 0.95) = 9 → times[9] = 2.0
        p95 = checker.get_p95_response_time("provider_a")
        assert p95 is not None
        assert p95 >= 1.9  # P95 应该在高位

    def test_no_history_returns_none(self, checker):
        """无历史时返回 None"""
        assert checker.get_avg_response_time("provider_a") is None
        assert checker.get_p95_response_time("provider_a") is None


# ============================================================
# IT: 集成测试 — 多服务商
# ============================================================

class TestMultiProviderIntegration:
    """IT-001 ~ IT-006: 多服务商集成测试"""

    @pytest.mark.asyncio
    async def test_it001_check_all_healthy(self, checker):
        """IT-001: 多服务商批量检查 — 全部正常"""
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        with patch("aiohttp.ClientSession") as MockSession:
            instance = AsyncMock()
            instance.get = MagicMock(return_value=mock_resp)
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockSession.return_value = instance

            results = await checker.check_all()

        assert len(results) == 3
        assert all(r.success for r in results)
        provider_names = {r.provider_name for r in results}
        assert provider_names == {"provider_a", "provider_b", "provider_c"}

    @pytest.mark.asyncio
    async def test_it002_partial_unhealthy(self, checker):
        """IT-002: 部分服务商不可用"""
        call_count = 0

        def side_effect_get(url, **kwargs):
            nonlocal call_count
            call_count += 1
            mock_resp = AsyncMock()
            # 第 2 个调用返回 500
            if call_count == 2:
                mock_resp.status = 500
            else:
                mock_resp.status = 200
            mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
            mock_resp.__aexit__ = AsyncMock(return_value=False)
            return mock_resp

        with patch("aiohttp.ClientSession") as MockSession:
            instance = AsyncMock()
            instance.get = MagicMock(side_effect=side_effect_get)
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockSession.return_value = instance

            results = await checker.check_all()

        successes = [r for r in results if r.success]
        failures = [r for r in results if not r.success]
        assert len(successes) == 2
        assert len(failures) == 1

    @pytest.mark.asyncio
    async def test_it003_all_unhealthy(self, checker):
        """IT-003: 全部服务商不可用"""
        mock_resp = AsyncMock()
        mock_resp.status = 503
        mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
        mock_resp.__aexit__ = AsyncMock(return_value=False)

        with patch("aiohttp.ClientSession") as MockSession:
            instance = AsyncMock()
            instance.get = MagicMock(return_value=mock_resp)
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockSession.return_value = instance

            results = await checker.check_all()

        assert len(results) == 3
        assert all(not r.success for r in results)

    @pytest.mark.asyncio
    async def test_it004_concurrent_independence(self, checker):
        """IT-004: 并发检查各服务商独立"""
        responses = {
            "https://api-a.example.com/health": (200, 0.1),
            "https://api-b.example.com/health": (500, 0.2),
            "https://api-c.example.com/health": (200, 0.05),
        }

        def side_effect_get(url, **kwargs):
            status, delay = responses.get(url, (200, 0.01))
            mock_resp = AsyncMock()
            mock_resp.status = status
            mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
            mock_resp.__aexit__ = AsyncMock(return_value=False)
            return mock_resp

        with patch("aiohttp.ClientSession") as MockSession:
            instance = AsyncMock()
            instance.get = MagicMock(side_effect=side_effect_get)
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockSession.return_value = instance

            results = await checker.check_all()

        result_map = {r.provider_name: r for r in results}
        assert result_map["provider_a"].success is True
        assert result_map["provider_b"].success is False
        assert result_map["provider_c"].success is True

    @pytest.mark.asyncio
    async def test_it005_status_transition(self, single_checker):
        """IT-005: 状态变迁 healthy → unhealthy → healthy"""
        mock_session = AsyncMock(spec=aiohttp.ClientSession)

        # Phase 1: 5 次成功 → healthy
        for _ in range(5):
            mock_resp = AsyncMock()
            mock_resp.status = 200
            mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
            mock_resp.__aexit__ = AsyncMock(return_value=False)
            mock_session.get = MagicMock(return_value=mock_resp)
            await single_checker.check_provider(
                "solo", "https://solo.example.com/health", session=mock_session
            )
        assert single_checker.get_status("solo") == HealthStatus.HEALTHY

        # Phase 2: 5 次失败 → unhealthy (窗口=5，全失败)
        for _ in range(5):
            mock_session.get = MagicMock(side_effect=asyncio.TimeoutError())
            await single_checker.check_provider(
                "solo", "https://solo.example.com/health", session=mock_session
            )
        assert single_checker.get_status("solo") == HealthStatus.UNHEALTHY

        # Phase 3: 5 次成功 → healthy
        for _ in range(5):
            mock_resp = AsyncMock()
            mock_resp.status = 200
            mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
            mock_resp.__aexit__ = AsyncMock(return_value=False)
            mock_session.get = MagicMock(return_value=mock_resp)
            await single_checker.check_provider(
                "solo", "https://solo.example.com/health", session=mock_session
            )
        assert single_checker.get_status("solo") == HealthStatus.HEALTHY

    def test_it006_health_report(self, checker):
        """IT-006: 全局健康报告"""
        # 注入不同状态
        inject_history(checker, "provider_a",
                       [make_result("provider_a", True) for _ in range(10)])
        inject_history(checker, "provider_b",
                       [make_result("provider_b", True) for _ in range(7)] +
                       [make_result("provider_b", False, error="fail") for _ in range(3)])
        inject_history(checker, "provider_c",
                       [make_result("provider_c", False, error="fail") for _ in range(10)])

        report = checker.get_health_report()

        assert len(report) == 3
        assert report["provider_a"].status == HealthStatus.HEALTHY
        assert report["provider_b"].status == HealthStatus.DEGRADED
        assert report["provider_c"].status == HealthStatus.UNHEALTHY

        # 验证摘要字段完整
        for name, health in report.items():
            assert isinstance(health, ProviderHealth)
            assert health.total_checks > 0
            assert 0.0 <= health.error_rate <= 1.0


# ============================================================
# ET: 边界/异常测试
# ============================================================

class TestEdgeCases:
    """ET-001 ~ ET-004: 边界与异常场景"""

    @pytest.mark.asyncio
    async def test_et001_zero_providers(self, empty_checker):
        """ET-001: 零服务商 → 空报告，不报错"""
        results = await empty_checker.check_all()
        assert results == []
        report = empty_checker.get_health_report()
        assert report == {}

    @pytest.mark.asyncio
    async def test_et002_invalid_url(self):
        """ET-002: 非法 URL → 优雅失败，标记 unhealthy"""
        checker = HealthChecker(
            providers={"bad": "not-a-url"},
            window_size=5,
            timeout=5.0,
        )
        result = await checker.check_provider("bad", "not-a-url")
        assert result.success is False
        assert "Invalid URL" in result.error
        assert checker.get_status("bad") == HealthStatus.UNHEALTHY

    @pytest.mark.asyncio
    async def test_et002_empty_url(self):
        """ET-002b: 空 URL"""
        checker = HealthChecker(
            providers={"empty": ""},
            window_size=5,
            timeout=5.0,
        )
        result = await checker.check_provider("empty", "")
        assert result.success is False

    @pytest.mark.asyncio
    async def test_et003_very_long_timeout(self):
        """ET-003: 超大响应超时截断"""
        checker = HealthChecker(
            providers={"slow": "https://slow.example.com/health"},
            window_size=5,
            timeout=2.0,  # 2 秒超时
        )
        mock_session = AsyncMock(spec=aiohttp.ClientSession)
        mock_session.get = MagicMock(side_effect=asyncio.TimeoutError())

        result = await checker.check_provider(
            "slow", "https://slow.example.com/health", session=mock_session
        )
        assert result.success is False
        assert result.response_time == 2.0  # 截断为超时值

    @pytest.mark.asyncio
    async def test_et004_one_hangs_others_ok(self, checker):
        """ET-004: 一个挂起不阻塞其他"""
        call_count = 0

        def side_effect_get(url, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise asyncio.TimeoutError()
            mock_resp = AsyncMock()
            mock_resp.status = 200
            mock_resp.__aenter__ = AsyncMock(return_value=mock_resp)
            mock_resp.__aexit__ = AsyncMock(return_value=False)
            return mock_resp

        with patch("aiohttp.ClientSession") as MockSession:
            instance = AsyncMock()
            instance.get = MagicMock(side_effect=side_effect_get)
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            MockSession.return_value = instance

            results = await checker.check_all()

        assert len(results) == 3
        successes = [r for r in results if r.success]
        failures = [r for r in results if not r.success]
        assert len(successes) == 2
        assert len(failures) == 1


# ============================================================
# 额外: HealthChecker 构造参数测试
# ============================================================

class TestConstruction:
    """构造器与配置"""

    def test_default_construction(self):
        hc = HealthChecker()
        assert hc.providers == {}
        assert hc.window_size == 10
        assert hc.timeout == 10.0

    def test_custom_construction(self):
        hc = HealthChecker(
            providers={"x": "https://x.com"},
            window_size=20,
            timeout=3.0,
        )
        assert hc.providers == {"x": "https://x.com"}
        assert hc.window_size == 20
        assert hc.timeout == 3.0
