"""
PRJ-LITE999-T-014: 用量跟踪器
记录每次 API 调用的 Token / 请求数 / 费用，支持多维统计
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional


@dataclass
class UsageEvent:
    """单次 API 调用的用量事件"""
    event_id: str
    provider: str          # 厂商名
    model: str             # 模型名
    prompt_tokens: int     # prompt tokens
    completion_tokens: int # completion tokens
    cost: Decimal          # 费用 (精确到 6 位小数)
    timestamp: float = field(default_factory=time.time)  # unix ts
    success: bool = True

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


class ValidationError(Exception):
    pass


class UsageTracker:
    """
    用量跟踪器 — 线程安全地记录事件并提供统计快照
    """

    def __init__(self, *, clock=None):
        self._lock = threading.Lock()
        self._events: list[UsageEvent] = []
        self._seen_ids: set[str] = set()
        self._clock = clock or time.time

    # ------ 写入 ------

    def record(self, event: UsageEvent) -> bool:
        """
        记录一条事件。返回 True 表示新增，False 表示幂等跳过。
        """
        if event.prompt_tokens < 0 or event.completion_tokens < 0:
            raise ValidationError("Token count must be non-negative")
        if event.cost < 0:
            raise ValidationError("Cost must be non-negative")

        with self._lock:
            if event.event_id in self._seen_ids:
                return False
            self._seen_ids.add(event.event_id)
            self._events.append(event)
            return True

    def record_batch(self, events: list[UsageEvent]) -> int:
        """批量记录，返回实际新增条数"""
        count = 0
        for e in events:
            if self.record(e):
                count += 1
        return count

    # ------ 统计 ------

    @property
    def total_events(self) -> int:
        with self._lock:
            return len(self._events)

    @property
    def total_tokens(self) -> int:
        with self._lock:
            return sum(e.total_tokens for e in self._events)

    @property
    def total_requests(self) -> int:
        with self._lock:
            return len(self._events)

    @property
    def total_cost(self) -> Decimal:
        with self._lock:
            return sum((e.cost for e in self._events), Decimal("0"))

    def by_provider(self) -> dict[str, dict]:
        """按厂商聚合: {provider: {tokens, requests, cost}}"""
        with self._lock:
            result: dict[str, dict] = {}
            for e in self._events:
                if e.provider not in result:
                    result[e.provider] = {"tokens": 0, "requests": 0, "cost": Decimal("0")}
                result[e.provider]["tokens"] += e.total_tokens
                result[e.provider]["requests"] += 1
                result[e.provider]["cost"] += e.cost
            return result

    def by_model(self) -> dict[str, dict]:
        """按模型聚合"""
        with self._lock:
            result: dict[str, dict] = {}
            for e in self._events:
                if e.model not in result:
                    result[e.model] = {"tokens": 0, "requests": 0, "cost": Decimal("0")}
                result[e.model]["tokens"] += e.total_tokens
                result[e.model]["requests"] += 1
                result[e.model]["cost"] += e.cost
            return result

    def by_window(self, window: str = "hour") -> dict[str, dict]:
        """
        按时间窗口聚合。window: 'minute' | 'hour' | 'day'
        返回 {window_key: {tokens, requests, cost}}
        """
        fmt_map = {"minute": "%Y-%m-%d %H:%M", "hour": "%Y-%m-%d %H:00", "day": "%Y-%m-%d"}
        fmt = fmt_map.get(window, fmt_map["hour"])
        with self._lock:
            result: dict[str, dict] = {}
            for e in self._events:
                dt = datetime.fromtimestamp(e.timestamp, tz=timezone.utc)
                key = dt.strftime(fmt)
                if key not in result:
                    result[key] = {"tokens": 0, "requests": 0, "cost": Decimal("0")}
                result[key]["tokens"] += e.total_tokens
                result[key]["requests"] += 1
                result[key]["cost"] += e.cost
            return result

    def events_in_range(self, start: float, end: float) -> list[UsageEvent]:
        with self._lock:
            return [e for e in self._events if start <= e.timestamp < end]

    def get_events(self) -> list[UsageEvent]:
        with self._lock:
            return list(self._events)

    def snapshot(self) -> dict:
        """序列化为 dict"""
        with self._lock:
            return {
                "events": [
                    {
                        "event_id": e.event_id,
                        "provider": e.provider,
                        "model": e.model,
                        "prompt_tokens": e.prompt_tokens,
                        "completion_tokens": e.completion_tokens,
                        "cost": str(e.cost),
                        "timestamp": e.timestamp,
                        "success": e.success,
                    }
                    for e in self._events
                ]
            }

    @classmethod
    def from_snapshot(cls, data: dict, **kwargs) -> "UsageTracker":
        """从 dict 恢复"""
        tracker = cls(**kwargs)
        for item in data.get("events", []):
            event = UsageEvent(
                event_id=item["event_id"],
                provider=item["provider"],
                model=item["model"],
                prompt_tokens=item["prompt_tokens"],
                completion_tokens=item["completion_tokens"],
                cost=Decimal(item["cost"]),
                timestamp=item["timestamp"],
                success=item.get("success", True),
            )
            tracker.record(event)
        return tracker
