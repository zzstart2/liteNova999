"""PRJ-LITE999-T-016: 负载均衡器"""

import threading
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class LBStrategy(str, Enum):
    ROUND_ROBIN = "round_robin"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    LEAST_CONNECTIONS = "least_connections"


class NoHealthyNodeError(Exception):
    def __init__(self):
        super().__init__("No healthy nodes available")


@dataclass
class LBNode:
    host: str
    port: int = 80
    weight: int = 1
    healthy: bool = True
    active_connections: int = 0
    metadata: dict = field(default_factory=dict)

    @property
    def address(self) -> str:
        return f"{self.host}:{self.port}"


class LoadBalancer:
    def __init__(self, nodes: list[LBNode] | None = None, strategy: LBStrategy = LBStrategy.ROUND_ROBIN):
        self._nodes: list[LBNode] = list(nodes or [])
        self.strategy = strategy
        self._rr_index = 0
        self._wrr_state: dict[str, int] = {}
        self._lock = threading.Lock()

    def add_node(self, node: LBNode) -> None:
        with self._lock:
            self._nodes.append(node)

    def remove_node(self, host: str) -> None:
        with self._lock:
            self._nodes = [n for n in self._nodes if n.host != host]

    def mark_unhealthy(self, host: str) -> None:
        with self._lock:
            for n in self._nodes:
                if n.host == host:
                    n.healthy = False

    def mark_healthy(self, host: str) -> None:
        with self._lock:
            for n in self._nodes:
                if n.host == host:
                    n.healthy = True

    def get_healthy_nodes(self) -> list[LBNode]:
        return [n for n in self._nodes if n.healthy]

    def select(self) -> LBNode:
        with self._lock:
            healthy = [n for n in self._nodes if n.healthy]
            if not healthy:
                raise NoHealthyNodeError()

            if self.strategy == LBStrategy.ROUND_ROBIN:
                return self._select_round_robin(healthy)
            elif self.strategy == LBStrategy.WEIGHTED_ROUND_ROBIN:
                return self._select_weighted_rr(healthy)
            elif self.strategy == LBStrategy.LEAST_CONNECTIONS:
                return self._select_least_conn(healthy)
            return self._select_round_robin(healthy)

    def _select_round_robin(self, healthy: list[LBNode]) -> LBNode:
        idx = self._rr_index % len(healthy)
        self._rr_index += 1
        return healthy[idx]

    def _select_weighted_rr(self, healthy: list[LBNode]) -> LBNode:
        total = sum(n.weight for n in healthy)
        if total == 0:
            return healthy[0]
        idx = self._rr_index % total
        self._rr_index += 1
        cumulative = 0
        for n in healthy:
            cumulative += n.weight
            if idx < cumulative:
                return n
        return healthy[-1]

    def _select_least_conn(self, healthy: list[LBNode]) -> LBNode:
        return min(healthy, key=lambda n: n.active_connections)

    def connect(self, node: LBNode) -> None:
        node.active_connections += 1

    def disconnect(self, node: LBNode) -> None:
        node.active_connections = max(0, node.active_connections - 1)

    @property
    def node_count(self) -> int:
        return len(self._nodes)
