"""
PRJ-LITE999-T-014: 仪表盘查询 API
分页、过滤、导出
"""

from __future__ import annotations

import csv
import io
import json
import math
from decimal import Decimal
from typing import Optional

from src.dashboard.usage import UsageTracker, UsageEvent
from src.dashboard.aggregator import MetricsAggregator


class DashboardAPI:
    """
    仪表盘查询接口
    """

    def __init__(self, tracker: UsageTracker):
        self._tracker = tracker
        self._agg = MetricsAggregator(tracker)

    # ---- 汇总 ----

    def get_summary(self) -> dict:
        return self._agg.summary()

    # ---- 分页查询 ----

    def list_events(self, *, page: int = 1, page_size: int = 20,
                    provider: Optional[str] = None,
                    model: Optional[str] = None,
                    start: Optional[float] = None,
                    end: Optional[float] = None) -> dict:
        events = self._agg.filter_events(provider=provider, model=model, start=start, end=end)
        total = len(events)
        total_pages = max(1, math.ceil(total / page_size))
        offset = (page - 1) * page_size
        page_events = events[offset:offset + page_size]
        return {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
            "items": page_events,
        }

    # ---- 过滤 ----

    def filter_by_provider(self, provider: str) -> list[UsageEvent]:
        return self._agg.filter_events(provider=provider)

    def filter_by_model(self, model: str) -> list[UsageEvent]:
        return self._agg.filter_events(model=model)

    def filter_by_time(self, start: float, end: float) -> list[UsageEvent]:
        return self._agg.filter_events(start=start, end=end)

    # ---- 导出 ----

    def export_json(self, **filters) -> str:
        events = self._agg.filter_events(**filters)
        items = []
        for e in events:
            items.append({
                "event_id": e.event_id,
                "provider": e.provider,
                "model": e.model,
                "prompt_tokens": e.prompt_tokens,
                "completion_tokens": e.completion_tokens,
                "total_tokens": e.total_tokens,
                "cost": str(e.cost),
                "timestamp": e.timestamp,
            })
        return json.dumps(items, default=str)

    def export_csv(self, **filters) -> str:
        events = self._agg.filter_events(**filters)
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["event_id", "provider", "model", "prompt_tokens", "completion_tokens", "total_tokens", "cost", "timestamp"])
        for e in events:
            writer.writerow([e.event_id, e.provider, e.model, e.prompt_tokens, e.completion_tokens, e.total_tokens, str(e.cost), e.timestamp])
        return buf.getvalue()
