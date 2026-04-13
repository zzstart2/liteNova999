"""
PRJ-LITE999-T-014 测试用例
仪表盘功能：用量统计准确性和数据一致性验证
"""

import csv
import io
import json
import tempfile
import threading
import time
from decimal import Decimal
from pathlib import Path

import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.dashboard.usage import UsageTracker, UsageEvent, ValidationError
from src.dashboard.aggregator import MetricsAggregator
from src.dashboard.store import DashboardStore
from src.dashboard.api import DashboardAPI


# ============================================================
# Helpers
# ============================================================

class FakeClock:
    def __init__(self, start=1_700_000_000.0):
        self._now = start
    def __call__(self):
        return self._now
    def advance(self, s):
        self._now += s


def make_event(eid="e1", provider="qwen", model="qwen-turbo",
               prompt=100, completion=50, cost="0.001000", ts=None):
    return UsageEvent(
        event_id=eid, provider=provider, model=model,
        prompt_tokens=prompt, completion_tokens=completion,
        cost=Decimal(cost), timestamp=ts or time.time(),
    )


def seed_tracker(tracker, n=10, providers=None, models=None, base_ts=1_700_000_000.0):
    """给 tracker 填充 n 条事件"""
    providers = providers or ["qwen", "doubao", "glm"]
    models = models or ["qwen-turbo", "doubao-pro", "glm-4"]
    for i in range(n):
        p = providers[i % len(providers)]
        m = models[i % len(models)]
        tracker.record(make_event(
            eid=f"seed-{i}", provider=p, model=m,
            prompt=100 + i, completion=50 + i,
            cost=f"0.{i:06d}", ts=base_ts + i * 3600,
        ))


# ============================================================
# UT: 用量记录 (UT-001 ~ UT-012)
# ============================================================

class TestUsageTracker:

    def test_ut001_single_event(self):
        """UT-001: 单条事件记录"""
        t = UsageTracker()
        e = make_event()
        assert t.record(e) is True
        assert t.total_events == 1

    def test_ut002_token_accumulation(self):
        """UT-002: Token 计数累加"""
        t = UsageTracker()
        t.record(make_event(eid="a", prompt=100, completion=50))
        t.record(make_event(eid="b", prompt=200, completion=80))
        assert t.total_tokens == 100 + 50 + 200 + 80

    def test_ut003_request_count(self):
        """UT-003: 请求次数累加"""
        t = UsageTracker()
        for i in range(5):
            t.record(make_event(eid=f"r{i}"))
        assert t.total_requests == 5

    def test_ut004_cost_precision(self):
        """UT-004: 费用计算精度 (6 位小数)"""
        t = UsageTracker()
        t.record(make_event(eid="a", cost="0.000001"))
        t.record(make_event(eid="b", cost="0.000002"))
        t.record(make_event(eid="c", cost="0.000003"))
        assert t.total_cost == Decimal("0.000006")

    def test_ut005_multi_provider(self):
        """UT-005: 多厂商分别统计"""
        t = UsageTracker()
        t.record(make_event(eid="q1", provider="qwen", prompt=100, completion=50))
        t.record(make_event(eid="d1", provider="doubao", prompt=200, completion=100))
        by_p = t.by_provider()
        assert by_p["qwen"]["tokens"] == 150
        assert by_p["doubao"]["tokens"] == 300

    def test_ut006_multi_model(self):
        """UT-006: 多模型分别统计"""
        t = UsageTracker()
        t.record(make_event(eid="a", model="qwen-turbo", prompt=100, completion=50))
        t.record(make_event(eid="b", model="qwen-max", prompt=200, completion=80))
        by_m = t.by_model()
        assert by_m["qwen-turbo"]["tokens"] == 150
        assert by_m["qwen-max"]["tokens"] == 280

    def test_ut007_time_window_aggregation(self):
        """UT-007: 时间窗口聚合 (分/时/日)"""
        t = UsageTracker()
        # 2023-11-15 00:00 UTC — pick a clean day start
        base = 1_700_006_400.0
        t.record(make_event(eid="a", prompt=10, completion=5, ts=base))
        t.record(make_event(eid="b", prompt=20, completion=10, ts=base + 3600))
        t.record(make_event(eid="c", prompt=30, completion=15, ts=base + 7200))

        by_hour = t.by_window("hour")
        assert len(by_hour) == 3

        by_day = t.by_window("day")
        assert len(by_day) == 1  # all same day (within 3h)

        by_min = t.by_window("minute")
        assert len(by_min) == 3

    def test_ut008_empty_window_zero(self):
        """UT-008: 空窗口返回零值"""
        t = UsageTracker()
        assert t.by_window("hour") == {}
        assert t.total_tokens == 0
        assert t.total_cost == Decimal("0")

    def test_ut009_cross_day_boundary(self):
        """UT-009: 跨日统计边界"""
        t = UsageTracker()
        # 2023-11-14 23:59 UTC
        t.record(make_event(eid="day1", ts=1_700_006_340.0, prompt=100, completion=50))
        # 2023-11-15 00:01 UTC
        t.record(make_event(eid="day2", ts=1_700_006_460.0, prompt=200, completion=100))
        by_day = t.by_window("day")
        assert len(by_day) == 2

    def test_ut010_concurrent_writes(self):
        """UT-010: 并发写入准确性"""
        t = UsageTracker()
        errors = []

        def writer(thread_id):
            try:
                for i in range(100):
                    t.record(make_event(eid=f"t{thread_id}-{i}", prompt=1, completion=1, cost="0.000001"))
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=writer, args=(tid,)) for tid in range(10)]
        for th in threads: th.start()
        for th in threads: th.join()
        assert not errors
        assert t.total_events == 1000
        assert t.total_tokens == 2000

    def test_ut011_bulk_write_no_loss(self):
        """UT-011: 大批量写入不丢失"""
        t = UsageTracker()
        events = [make_event(eid=f"bulk-{i}", prompt=1, completion=1) for i in range(10000)]
        count = t.record_batch(events)
        assert count == 10000
        assert t.total_events == 10000

    def test_ut012_idempotent(self):
        """UT-012: 重复事件幂等"""
        t = UsageTracker()
        e = make_event(eid="dup")
        assert t.record(e) is True
        assert t.record(e) is False
        assert t.total_events == 1


# ============================================================
# AG: 聚合查询 (AG-001 ~ AG-010)
# ============================================================

class TestAggregator:

    @pytest.fixture
    def setup(self):
        t = UsageTracker()
        seed_tracker(t, n=30, base_ts=1_700_000_000.0)
        agg = MetricsAggregator(t)
        return t, agg

    def test_ag001_by_provider(self, setup):
        """AG-001: 按厂商聚合"""
        t, agg = setup
        by_p = agg.by_provider()
        assert set(by_p.keys()) == {"qwen", "doubao", "glm"}
        assert all(v["requests"] == 10 for v in by_p.values())

    def test_ag002_by_model(self, setup):
        """AG-002: 按模型聚合"""
        _, agg = setup
        by_m = agg.by_model()
        assert set(by_m.keys()) == {"qwen-turbo", "doubao-pro", "glm-4"}

    def test_ag003_by_hour(self, setup):
        """AG-003: 按时段聚合 (hourly)"""
        _, agg = setup
        by_h = agg.by_window("hour")
        assert len(by_h) == 30  # 每条间隔 1h

    def test_ag004_by_day(self, setup):
        """AG-004: 按时段聚合 (daily)"""
        _, agg = setup
        by_d = agg.by_window("day")
        assert len(by_d) >= 1

    def test_ag005_cross_aggregate(self, setup):
        """AG-005: 多维交叉 (厂商 × 日期)"""
        _, agg = setup
        cross = agg.cross_aggregate("provider", "day")
        assert "qwen" in cross
        for day_data in cross["qwen"].values():
            assert "tokens" in day_data

    def test_ag006_top_providers(self, setup):
        """AG-006: TopN 厂商"""
        _, agg = setup
        top = agg.top_providers(n=2, metric="tokens")
        assert len(top) == 2
        assert top[0][1] >= top[1][1]  # 降序

    def test_ag007_top_models(self, setup):
        """AG-007: TopN 模型"""
        _, agg = setup
        top = agg.top_models(n=2, metric="requests")
        assert len(top) == 2

    def test_ag008_trend_growth(self, setup):
        """AG-008: 趋势环比增长率"""
        _, agg = setup
        trend = agg.trend(window="day", metric="tokens")
        assert len(trend) >= 1
        assert "growth_pct" in trend[0]
        # 第一个窗口没有前值
        assert trend[0]["growth_pct"] is None

    def test_ag009_empty_aggregation(self):
        """AG-009: 空数据集聚合返回空"""
        t = UsageTracker()
        agg = MetricsAggregator(t)
        assert agg.by_provider() == {}
        assert agg.by_model() == {}
        assert agg.summary()["total_tokens"] == 0

    def test_ag010_time_range_filter(self, setup):
        """AG-010: 时间范围过滤"""
        _, agg = setup
        base = 1_700_000_000.0
        filtered = agg.filter_events(start=base, end=base + 3 * 3600)
        assert len(filtered) == 3  # 0h, 1h, 2h


# ============================================================
# ST: 数据持久化 (ST-001 ~ ST-008)
# ============================================================

class TestStore:

    def test_st001_save_load(self, tmp_path):
        """ST-001: 快照保存/恢复"""
        t = UsageTracker()
        seed_tracker(t, n=5)
        store = DashboardStore(tmp_path / "data.json")
        n = store.save(t)
        assert n == 5
        loaded = store.load()
        assert loaded.total_events == 5

    def test_st002_data_consistency(self, tmp_path):
        """ST-002: 恢复后数据一致"""
        t = UsageTracker()
        seed_tracker(t, n=20)
        store = DashboardStore(tmp_path / "data.json")
        store.save(t)
        loaded = store.load()
        assert loaded.total_tokens == t.total_tokens
        assert loaded.total_cost == t.total_cost
        assert loaded.total_requests == t.total_requests

    def test_st003_incremental_save(self, tmp_path):
        """ST-003: 增量保存"""
        store = DashboardStore(tmp_path / "data.json")
        t = UsageTracker()
        t.record(make_event(eid="a"))
        store.save(t)
        t.record(make_event(eid="b"))
        store.save(t)
        loaded = store.load()
        assert loaded.total_events == 2

    def test_st004_concurrent_read_write(self, tmp_path):
        """ST-004: 并发读写不阻塞"""
        store = DashboardStore(tmp_path / "data.json")
        t = UsageTracker()
        seed_tracker(t, n=10)
        errors = []

        def save_loop():
            try:
                for _ in range(20):
                    store.save(t)
            except Exception as e:
                errors.append(e)

        def load_loop():
            try:
                for _ in range(20):
                    store.load()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=save_loop), threading.Thread(target=load_loop)]
        for th in threads: th.start()
        for th in threads: th.join()
        assert not errors

    def test_st005_empty_save_load(self, tmp_path):
        """ST-005: 空数据保存/恢复"""
        store = DashboardStore(tmp_path / "data.json")
        t = UsageTracker()
        store.save(t)
        loaded = store.load()
        assert loaded.total_events == 0

    def test_st006_corrupt_file(self, tmp_path):
        """ST-006: 损坏文件恢复降级"""
        p = tmp_path / "data.json"
        p.write_text("THIS IS NOT JSON!!!", encoding="utf-8")
        store = DashboardStore(p)
        loaded = store.load()
        assert loaded.total_events == 0  # 降级为空

    def test_st007_idempotent_save(self, tmp_path):
        """ST-007: 多次快照幂等"""
        store = DashboardStore(tmp_path / "data.json")
        t = UsageTracker()
        seed_tracker(t, n=5)
        store.save(t)
        store.save(t)
        store.save(t)
        loaded = store.load()
        assert loaded.total_events == 5

    def test_st008_large_snapshot_perf(self, tmp_path):
        """ST-008: 大数据集快照性能"""
        store = DashboardStore(tmp_path / "data.json")
        t = UsageTracker()
        seed_tracker(t, n=10000)
        start = time.perf_counter()
        store.save(t)
        save_ms = (time.perf_counter() - start) * 1000
        start = time.perf_counter()
        loaded = store.load()
        load_ms = (time.perf_counter() - start) * 1000
        assert loaded.total_events == 10000
        assert save_ms < 5000, f"Save took {save_ms:.0f}ms"
        assert load_ms < 5000, f"Load took {load_ms:.0f}ms"


# ============================================================
# AP: API 查询 (AP-001 ~ AP-008)
# ============================================================

class TestDashboardAPI:

    @pytest.fixture
    def api(self):
        t = UsageTracker()
        seed_tracker(t, n=50, base_ts=1_700_000_000.0)
        return DashboardAPI(t)

    def test_ap001_summary(self, api):
        """AP-001: 获取总量摘要"""
        s = api.get_summary()
        assert s["total_requests"] == 50
        assert s["total_tokens"] > 0
        assert s["providers"] == 3

    def test_ap002_pagination(self, api):
        """AP-002: 分页查询"""
        page1 = api.list_events(page=1, page_size=10)
        assert page1["page"] == 1
        assert page1["page_size"] == 10
        assert len(page1["items"]) == 10
        assert page1["total"] == 50
        assert page1["total_pages"] == 5

        page5 = api.list_events(page=5, page_size=10)
        assert len(page5["items"]) == 10

    def test_ap003_filter_provider(self, api):
        """AP-003: 厂商过滤"""
        events = api.filter_by_provider("qwen")
        assert all(e.provider == "qwen" for e in events)

    def test_ap004_filter_time(self, api):
        """AP-004: 时间范围过滤"""
        base = 1_700_000_000.0
        events = api.filter_by_time(base, base + 5 * 3600)
        assert len(events) == 5

    def test_ap005_filter_model(self, api):
        """AP-005: 模型过滤"""
        events = api.filter_by_model("glm-4")
        assert all(e.model == "glm-4" for e in events)

    def test_ap006_export_json(self, api):
        """AP-006: 导出 JSON"""
        raw = api.export_json(provider="qwen")
        data = json.loads(raw)
        assert isinstance(data, list)
        assert all(item["provider"] == "qwen" for item in data)

    def test_ap007_export_csv(self, api):
        """AP-007: 导出 CSV"""
        raw = api.export_csv()
        reader = csv.reader(io.StringIO(raw))
        header = next(reader)
        assert "event_id" in header
        assert "provider" in header
        rows = list(reader)
        assert len(rows) == 50

    def test_ap008_empty_result(self):
        """AP-008: 空结果集"""
        t = UsageTracker()
        api = DashboardAPI(t)
        page = api.list_events()
        assert page["total"] == 0
        assert page["items"] == []
        assert api.export_json() == "[]"


# ============================================================
# DC: 数据一致性 (DC-001 ~ DC-006)
# ============================================================

class TestDataConsistency:

    @pytest.fixture
    def tracker(self):
        t = UsageTracker()
        seed_tracker(t, n=60, base_ts=1_700_000_000.0)
        return t

    def test_dc001_total_equals_sum_of_providers(self, tracker):
        """DC-001: 总量 = 各厂商之和"""
        by_p = tracker.by_provider()
        sum_tokens = sum(v["tokens"] for v in by_p.values())
        sum_requests = sum(v["requests"] for v in by_p.values())
        sum_cost = sum(v["cost"] for v in by_p.values())
        assert sum_tokens == tracker.total_tokens
        assert sum_requests == tracker.total_requests
        assert sum_cost == tracker.total_cost

    def test_dc002_total_equals_sum_of_models(self, tracker):
        """DC-002: 总量 = 各模型之和"""
        by_m = tracker.by_model()
        sum_tokens = sum(v["tokens"] for v in by_m.values())
        sum_requests = sum(v["requests"] for v in by_m.values())
        sum_cost = sum(v["cost"] for v in by_m.values())
        assert sum_tokens == tracker.total_tokens
        assert sum_requests == tracker.total_requests
        assert sum_cost == tracker.total_cost

    def test_dc003_total_equals_sum_of_windows(self, tracker):
        """DC-003: 总量 = 各时段之和"""
        by_h = tracker.by_window("hour")
        sum_tokens = sum(v["tokens"] for v in by_h.values())
        sum_requests = sum(v["requests"] for v in by_h.values())
        assert sum_tokens == tracker.total_tokens
        assert sum_requests == tracker.total_requests

    def test_dc004_concurrent_write_consistency(self):
        """DC-004: 并发写入后一致性"""
        t = UsageTracker()
        def writer(tid):
            for i in range(100):
                t.record(make_event(eid=f"c{tid}-{i}", provider=["qwen", "doubao"][tid % 2],
                                    prompt=10, completion=5, cost="0.000100"))
        threads = [threading.Thread(target=writer, args=(tid,)) for tid in range(10)]
        for th in threads: th.start()
        for th in threads: th.join()

        by_p = t.by_provider()
        sum_tokens = sum(v["tokens"] for v in by_p.values())
        assert sum_tokens == t.total_tokens
        assert t.total_events == 1000

    def test_dc005_snapshot_consistency(self, tracker, tmp_path):
        """DC-005: 快照前后一致性"""
        store = DashboardStore(tmp_path / "dc.json")
        before_tokens = tracker.total_tokens
        before_cost = tracker.total_cost
        before_requests = tracker.total_requests
        store.save(tracker)
        loaded = store.load()
        assert loaded.total_tokens == before_tokens
        assert loaded.total_cost == before_cost
        assert loaded.total_requests == before_requests

    def test_dc006_bulk_consistency(self):
        """DC-006: 大批量写入后一致性"""
        t = UsageTracker()
        events = [make_event(eid=f"b{i}", provider=["qwen", "doubao", "glm"][i % 3],
                             prompt=i + 1, completion=i, cost=f"0.{i:06d}") for i in range(5000)]
        t.record_batch(events)

        by_p = t.by_provider()
        assert sum(v["tokens"] for v in by_p.values()) == t.total_tokens
        assert sum(v["requests"] for v in by_p.values()) == t.total_requests
        assert sum(v["cost"] for v in by_p.values()) == t.total_cost


# ============================================================
# ET: 边界/异常 (ET-001 ~ ET-005)
# ============================================================

class TestEdgeCases:

    def test_et001_negative_tokens_rejected(self):
        """ET-001: 负数 Token 拒绝"""
        t = UsageTracker()
        with pytest.raises(ValidationError):
            t.record(make_event(prompt=-1))

    def test_et002_zero_tokens(self):
        """ET-002: 零 Token 事件"""
        t = UsageTracker()
        t.record(make_event(prompt=0, completion=0, cost="0.000000"))
        assert t.total_tokens == 0
        assert t.total_events == 1

    def test_et003_huge_numbers(self):
        """ET-003: 极大数值不溢出"""
        t = UsageTracker()
        t.record(make_event(eid="big", prompt=10**9, completion=10**9, cost="999999.999999"))
        assert t.total_tokens == 2 * 10**9
        assert t.total_cost == Decimal("999999.999999")

    def test_et004_unknown_provider(self):
        """ET-004: 未知厂商名"""
        t = UsageTracker()
        t.record(make_event(provider="unknown_vendor_xyz"))
        by_p = t.by_provider()
        assert "unknown_vendor_xyz" in by_p

    def test_et005_future_timestamp(self):
        """ET-005: 未来时间戳事件"""
        t = UsageTracker()
        future_ts = time.time() + 365 * 86400
        t.record(make_event(ts=future_ts))
        assert t.total_events == 1
