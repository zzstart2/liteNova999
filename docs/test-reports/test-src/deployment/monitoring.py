"""PRJ-LITE999-T-016: 监控采集器"""

import time
import threading
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class MetricType(str, Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"


@dataclass
class MetricValue:
    metric_type: MetricType
    value: float = 0.0
    labels: dict[str, str] = field(default_factory=dict)
    buckets: list[float] = field(default_factory=lambda: [0.01, 0.05, 0.1, 0.5, 1.0, 5.0])
    bucket_counts: dict[float, int] = field(default_factory=dict)
    count: int = 0
    total: float = 0.0

    def __post_init__(self):
        if self.metric_type == MetricType.HISTOGRAM and not self.bucket_counts:
            self.bucket_counts = {b: 0 for b in self.buckets}
            self.bucket_counts[float("inf")] = 0


@dataclass
class AlertRule:
    metric_name: str
    threshold: float
    operator: str = ">"  # >, <, >=, <=
    message: str = ""


@dataclass
class Alert:
    rule: AlertRule
    current_value: float
    triggered_at: float = field(default_factory=time.time)


class HealthEndpoint:
    def __init__(self):
        self._components: dict[str, bool] = {}

    def register(self, name: str, healthy: bool = True) -> None:
        self._components[name] = healthy

    def set_status(self, name: str, healthy: bool) -> None:
        self._components[name] = healthy

    def healthz(self) -> dict:
        all_healthy = all(self._components.values()) if self._components else True
        return {
            "status": "ok" if all_healthy else "degraded",
            "components": dict(self._components),
        }

    def readyz(self) -> dict:
        all_ready = all(self._components.values()) if self._components else True
        return {
            "ready": all_ready,
            "components": dict(self._components),
        }


class MonitoringCollector:
    def __init__(self):
        self._metrics: dict[str, MetricValue] = {}
        self._alerts: list[AlertRule] = []
        self._triggered: list[Alert] = []
        self._health = HealthEndpoint()
        self._lock = threading.Lock()

    @property
    def health(self) -> HealthEndpoint:
        return self._health

    def register_metric(self, name: str, metric_type: MetricType,
                        labels: dict[str, str] | None = None,
                        buckets: list[float] | None = None) -> None:
        key = self._metric_key(name, labels)
        mv = MetricValue(metric_type=metric_type, labels=labels or {})
        if buckets and metric_type == MetricType.HISTOGRAM:
            mv.buckets = buckets
            mv.bucket_counts = {b: 0 for b in buckets}
            mv.bucket_counts[float("inf")] = 0
        self._metrics[key] = mv

    def _metric_key(self, name: str, labels: dict[str, str] | None = None) -> str:
        if not labels:
            return name
        sorted_labels = sorted((labels or {}).items())
        label_str = ",".join(f'{k}="{v}"' for k, v in sorted_labels)
        return f"{name}{{{label_str}}}"

    def inc(self, name: str, value: float = 1.0, labels: dict | None = None) -> None:
        key = self._metric_key(name, labels)
        with self._lock:
            if key not in self._metrics:
                self._metrics[key] = MetricValue(metric_type=MetricType.COUNTER, labels=labels or {})
            self._metrics[key].value += value

    def set_gauge(self, name: str, value: float, labels: dict | None = None) -> None:
        key = self._metric_key(name, labels)
        with self._lock:
            if key not in self._metrics:
                self._metrics[key] = MetricValue(metric_type=MetricType.GAUGE, labels=labels or {})
            self._metrics[key].value = value

    def observe(self, name: str, value: float, labels: dict | None = None) -> None:
        key = self._metric_key(name, labels)
        with self._lock:
            if key not in self._metrics:
                self._metrics[key] = MetricValue(metric_type=MetricType.HISTOGRAM, labels=labels or {})
            mv = self._metrics[key]
            mv.count += 1
            mv.total += value
            for b in sorted(mv.bucket_counts.keys()):
                if value <= b:
                    mv.bucket_counts[b] += 1

    def get_value(self, name: str, labels: dict | None = None) -> float | None:
        key = self._metric_key(name, labels)
        mv = self._metrics.get(key)
        return mv.value if mv else None

    def get_metric(self, name: str, labels: dict | None = None) -> MetricValue | None:
        key = self._metric_key(name, labels)
        return self._metrics.get(key)

    def register_alert(self, rule: AlertRule) -> None:
        self._alerts.append(rule)

    def check_alerts(self) -> list[Alert]:
        triggered = []
        for rule in self._alerts:
            val = self.get_value(rule.metric_name)
            if val is None:
                continue
            fire = False
            if rule.operator == ">" and val > rule.threshold:
                fire = True
            elif rule.operator == ">=" and val >= rule.threshold:
                fire = True
            elif rule.operator == "<" and val < rule.threshold:
                fire = True
            elif rule.operator == "<=" and val <= rule.threshold:
                fire = True
            if fire:
                alert = Alert(rule=rule, current_value=val)
                triggered.append(alert)
        self._triggered.extend(triggered)
        return triggered

    def export_prometheus(self) -> str:
        lines = []
        for key, mv in sorted(self._metrics.items()):
            name = key.split("{")[0] if "{" in key else key
            if mv.metric_type == MetricType.COUNTER:
                lines.append(f"# TYPE {name} counter")
                lines.append(f"{key} {mv.value}")
            elif mv.metric_type == MetricType.GAUGE:
                lines.append(f"# TYPE {name} gauge")
                lines.append(f"{key} {mv.value}")
            elif mv.metric_type == MetricType.HISTOGRAM:
                lines.append(f"# TYPE {name} histogram")
                for b in sorted(mv.bucket_counts.keys()):
                    b_str = "+Inf" if b == float("inf") else str(b)
                    lines.append(f'{name}_bucket{{le="{b_str}"}} {mv.bucket_counts[b]}')
                lines.append(f"{name}_count {mv.count}")
                lines.append(f"{name}_sum {mv.total}")
        return "\n".join(lines) + "\n"
