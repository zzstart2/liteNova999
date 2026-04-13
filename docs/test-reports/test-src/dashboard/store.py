"""
PRJ-LITE999-T-014: 仪表盘数据持久化
快照保存/恢复、并发安全
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

from src.dashboard.usage import UsageTracker


class StoreError(Exception):
    pass


class DashboardStore:
    """
    文件持久化层 — 快照保存与恢复
    """

    def __init__(self, path: str | Path):
        self._path = Path(path)
        self._lock = threading.Lock()

    def save(self, tracker: UsageTracker) -> int:
        """
        保存快照，返回写入的事件数
        """
        data = tracker.snapshot()
        with self._lock:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(json.dumps(data, default=str), encoding="utf-8")
        return len(data.get("events", []))

    def load(self) -> UsageTracker:
        """
        恢复快照。文件不存在返回空 tracker; 损坏则降级。
        """
        with self._lock:
            if not self._path.exists():
                return UsageTracker()
            raw = self._path.read_text(encoding="utf-8")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return UsageTracker()  # 降级为空
        return UsageTracker.from_snapshot(data)

    def exists(self) -> bool:
        return self._path.exists()

    def delete(self):
        with self._lock:
            if self._path.exists():
                self._path.unlink()
