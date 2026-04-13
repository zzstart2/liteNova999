"""PRJ-LITE999-T-016: 数据库连接池 + 读写分离"""

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum


class PoolExhaustedError(Exception):
    def __init__(self, pool_name: str = ""):
        super().__init__(f"Connection pool exhausted: {pool_name}")


@dataclass
class DBConnection:
    conn_id: str
    dsn: str
    is_primary: bool = False
    healthy: bool = True
    created_at: float = field(default_factory=time.monotonic)
    _in_use: bool = False

    @property
    def in_use(self) -> bool:
        return self._in_use


class DatabasePool:
    def __init__(self, dsn: str, min_size: int = 2, max_size: int = 10,
                 is_primary: bool = True):
        self.dsn = dsn
        self.min_size = min_size
        self.max_size = max_size
        self.is_primary = is_primary
        self._pool: list[DBConnection] = []
        self._counter = 0
        self._init_pool()

    def _init_pool(self):
        for _ in range(self.min_size):
            self._pool.append(self._create_conn())

    def _create_conn(self) -> DBConnection:
        self._counter += 1
        return DBConnection(
            conn_id=f"conn-{self._counter}",
            dsn=self.dsn,
            is_primary=self.is_primary,
        )

    def acquire(self) -> DBConnection:
        for conn in self._pool:
            if not conn._in_use and conn.healthy:
                conn._in_use = True
                return conn
        if len(self._pool) < self.max_size:
            conn = self._create_conn()
            conn._in_use = True
            self._pool.append(conn)
            return conn
        raise PoolExhaustedError(self.dsn)

    def release(self, conn: DBConnection) -> None:
        conn._in_use = False

    def health_check(self) -> int:
        removed = 0
        for conn in list(self._pool):
            if not conn.healthy:
                self._pool.remove(conn)
                removed += 1
        while len(self._pool) < self.min_size:
            self._pool.append(self._create_conn())
        return removed

    @property
    def size(self) -> int:
        return len(self._pool)

    @property
    def available(self) -> int:
        return sum(1 for c in self._pool if not c._in_use and c.healthy)

    @property
    def in_use(self) -> int:
        return sum(1 for c in self._pool if c._in_use)


class RetryStrategy:
    def __init__(self, max_retries: int = 3, base_delay: float = 0.5, max_delay: float = 30.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay

    def get_delay(self, attempt: int) -> float:
        delay = self.base_delay * (2 ** attempt)
        return min(delay, self.max_delay)

    async def execute(self, action, *args, **kwargs):
        last_err = None
        for attempt in range(self.max_retries + 1):
            try:
                return await action(*args, **kwargs)
            except Exception as e:
                last_err = e
                if attempt < self.max_retries:
                    await asyncio.sleep(self.get_delay(attempt))
        raise last_err


class ReadWriteRouter:
    def __init__(self, primary: DatabasePool, replicas: list[DatabasePool] | None = None):
        self.primary = primary
        self.replicas = replicas or []
        self._read_idx = 0

    def get_write_conn(self) -> DBConnection:
        return self.primary.acquire()

    def get_read_conn(self) -> DBConnection:
        if not self.replicas:
            return self.primary.acquire()
        pool = self.replicas[self._read_idx % len(self.replicas)]
        self._read_idx += 1
        return pool.acquire()

    def release(self, conn: DBConnection) -> None:
        if conn.is_primary:
            self.primary.release(conn)
        else:
            for pool in self.replicas:
                if conn.dsn == pool.dsn:
                    pool.release(conn)
                    return
