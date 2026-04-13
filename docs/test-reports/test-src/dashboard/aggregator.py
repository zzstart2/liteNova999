"""
PRJ-LITE999-T-014: 聚合引擎
多维聚合、TopN、趋势计算
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Optional

from src.dashboard.usage import UsageTracker, UsageEvent


class MetricsAggregator:
    """
    对 UsageTracker 的数据做高级聚合查询
    """

    def __init__(self, tracker: UsageTracker):
        self._tracker = tracker

    # ---- 按维度聚合 ----

    def by_provider(self) -> dict[str, dict]:
        return self._tracker.by_provider()

    def by_model(self) -> dict[str, dict]:
        return self._tracker.by_model()

    def by_window(self, window: str = "hour") -> dict[str, dict]:
        return self._tracker.by_window(window)

    # ---- 交叉聚合 ----

    def cross_aggregate(self, dim1: str, dim2: str) -> dict[str, dict[str, dict]]:
        """
        二维交叉聚合, e.g. dim1='provider', dim2='day'
        返回 {dim1_val: {dim2_val: {tokens, requests, cost}}}
        """
        from datetime import datetime, timezone
        events = self._tracker.get_events()
        result: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {"tokens": 0, "requests": 0, "cost": Decimal("0")}))

        for e in events:
            k1 = getattr(e, dim1, e.provider) if dim1 != "day" else datetime.fromtimestamp(e.timestamp, tz=timezone.utc).strftime("%Y-%m-%d")
            k2 = getattr(e, dim2, e.provider) if dim2 != "day" else datetime.fromtimestamp(e.timestamp, tz=timezone.utc).strftime("%Y-%m-%d")

            if dim1 == "day":
                k1 = datetime.fromtimestamp(e.timestamp, tz=timezone.utc).strftime("%Y-%m-%d")
            else:
                k1 = getattr(e, dim1, str(e.provider))

            if dim2 == "day":
                k2 = datetime.fromtimestamp(e.timestamp, tz=timezone.utc).strftime("%Y-%m-%d")
            else:
                k2 = getattr(e, dim2, str(e.provider))

            result[k1][k2]["tokens"] += e.total_tokens
            result[k1][k2]["requests"] += 1
            result[k1][k2]["cost"] += e.cost

        return dict(result)

    # ---- TopN ----

    def top_providers(self, n: int = 5, metric: str = "tokens") -> list[tuple[str, int | Decimal]]:
        by_p = self.by_provider()
        items = [(name, stats[metric]) for name, stats in by_p.items()]
        items.sort(key=lambda x: x[1], reverse=True)
        return items[:n]

    def top_models(self, n: int = 5, metric: str = "tokens") -> list[tuple[str, int | Decimal]]:
        by_m = self.by_model()
        items = [(name, stats[metric]) for name, stats in by_m.items()]
        items.sort(key=lambda x: x[1], reverse=True)
        return items[:n]

    # ---- 趋势 ----

    def trend(self, window: str = "day", metric: str = "tokens") -> list[dict]:
        """
        按时间窗口计算趋势，包含环比增长率
        """
        by_w = self.by_window(window)
        sorted_keys = sorted(by_w.keys())
        result = []
        prev_val = None
        for key in sorted_keys:
            val = by_w[key][metric]
            growth = None
            if prev_val is not None and prev_val > 0:
                growth = round((val - prev_val) / prev_val * 100, 2)
            elif prev_val is not None and prev_val == 0 and val > 0:
                growth = float("inf")
            result.append({"window": key, "value": val, "growth_pct": growth})
            prev_val = val
        return result

    # ---- 汇总 ----

    def summary(self) -> dict:
        return {
            "total_tokens": self._tracker.total_tokens,
            "total_requests": self._tracker.total_requests,
            "total_cost": self._tracker.total_cost,
            "providers": len(self._tracker.by_provider()),
            "models": len(self._tracker.by_model()),
        }

    def filter_events(self, *, provider: Optional[str] = None,
                      model: Optional[str] = None,
                      start: Optional[float] = None,
                      end: Optional[float] = None) -> list[UsageEvent]:
        events = self._tracker.get_events()
        if provider:
            events = [e for e in events if e.provider == provider]
        if model:
            events = [e for e in events if e.model == model]
        if start is not None:
            events = [e for e in events if e.timestamp >= start]
        if end is not None:
            events = [e for e in events if e.timestamp < end]
        return events
