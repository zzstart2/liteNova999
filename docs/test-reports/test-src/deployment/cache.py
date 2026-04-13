"""PRJ-LITE999-T-016: 缓存管理器"""

import time
from dataclasses import dataclass, field
from typing import Any, Optional


_SENTINEL = object()  # 标记空值缓存


@dataclass
class CacheEntry:
    value: Any
    expire_at: Optional[float] = None

    def is_expired(self, now: float | None = None) -> bool:
        if self.expire_at is None:
            return False
        return (now or time.monotonic()) >= self.expire_at


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    @property
    def miss_rate(self) -> float:
        return 1.0 - self.hit_rate


class CacheManager:
    def __init__(self, default_ttl: float = 300.0, key_prefix: str = "",
                 clock=None):
        self.default_ttl = default_ttl
        self.key_prefix = key_prefix
        self._clock = clock or time.monotonic
        self._store: dict[str, CacheEntry] = {}
        self.stats = CacheStats()

    def _full_key(self, key: str) -> str:
        return f"{self.key_prefix}{key}"

    def get(self, key: str) -> Any:
        fk = self._full_key(key)
        entry = self._store.get(fk)
        if entry is None:
            self.stats.misses += 1
            return None
        if entry.is_expired(self._clock()):
            del self._store[fk]
            self.stats.misses += 1
            return None
        self.stats.hits += 1
        if entry.value is _SENTINEL:
            return None  # 空值缓存 — 命中但返回 None
        return entry.value

    def set(self, key: str, value: Any, ttl: float | None = None) -> None:
        fk = self._full_key(key)
        actual_ttl = ttl if ttl is not None else self.default_ttl
        expire_at = None
        if actual_ttl > 0:
            expire_at = self._clock() + actual_ttl
        elif actual_ttl == 0:
            expire_at = self._clock()  # 立即过期
        self._store[fk] = CacheEntry(value=value, expire_at=expire_at)
        self.stats.sets += 1

    def set_null(self, key: str, ttl: float | None = None) -> None:
        """缓存空值（穿透保护）"""
        fk = self._full_key(key)
        actual_ttl = ttl if ttl is not None else 60.0
        expire_at = self._clock() + actual_ttl if actual_ttl > 0 else None
        self._store[fk] = CacheEntry(value=_SENTINEL, expire_at=expire_at)
        self.stats.sets += 1

    def delete(self, key: str) -> bool:
        fk = self._full_key(key)
        if fk in self._store:
            del self._store[fk]
            self.stats.deletes += 1
            return True
        return False

    def mget(self, keys: list[str]) -> dict[str, Any]:
        return {k: self.get(k) for k in keys}

    def mset(self, mapping: dict[str, Any], ttl: float | None = None) -> None:
        for k, v in mapping.items():
            self.set(k, v, ttl)

    def clear(self) -> None:
        self._store.clear()

    @property
    def size(self) -> int:
        return len(self._store)
