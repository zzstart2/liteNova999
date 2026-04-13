"""PRJ-LITE999-T-016: 部署配置管理"""

import json
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any


class Environment(str, Enum):
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"


class ValidationError(Exception):
    def __init__(self, field_name: str, message: str):
        self.field_name = field_name
        super().__init__(f"Config validation error on '{field_name}': {message}")


@dataclass
class LBConfig:
    strategy: str = "round_robin"
    health_check_path: str = "/healthz"
    health_check_interval: float = 10.0
    nodes: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class DBConfig:
    primary_dsn: str = ""
    replica_dsns: list[str] = field(default_factory=list)
    pool_min: int = 5
    pool_max: int = 20
    connect_timeout: float = 5.0
    retry_max: int = 3
    retry_base_delay: float = 0.5


@dataclass
class CacheConfig:
    url: str = "redis://localhost:6379"
    default_ttl: float = 300.0
    key_prefix: str = "app:"
    max_connections: int = 50
    cluster_mode: bool = False


@dataclass
class MonitorConfig:
    metrics_path: str = "/metrics"
    collect_interval: float = 15.0
    alert_thresholds: dict[str, float] = field(default_factory=dict)


@dataclass
class DeploymentConfig:
    environment: Environment = Environment.DEVELOPMENT
    lb: LBConfig = field(default_factory=LBConfig)
    db: DBConfig = field(default_factory=DBConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    monitoring: MonitorConfig = field(default_factory=MonitorConfig)

    def validate(self, strict: bool = False) -> list[str]:
        errors = []
        if strict or self.environment == Environment.PRODUCTION:
            if not self.db.primary_dsn:
                errors.append("db.primary_dsn is required for production")
            if self.db.pool_min < 0:
                errors.append("db.pool_min must be >= 0")
            if self.db.pool_max < self.db.pool_min:
                errors.append("db.pool_max must be >= pool_min")
        for i, node in enumerate(self.lb.nodes):
            w = node.get("weight", 1)
            if isinstance(w, (int, float)) and w < 0:
                errors.append(f"lb.nodes[{i}].weight must be >= 0")
            port = node.get("port", 80)
            if isinstance(port, int) and (port < 1 or port > 65535):
                errors.append(f"lb.nodes[{i}].port must be 1-65535")
        if errors:
            raise ValidationError("deployment", "; ".join(errors))
        return []

    def to_dict(self) -> dict:
        d = asdict(self)
        d["environment"] = self.environment.value
        return d

    @classmethod
    def from_dict(cls, data: dict) -> "DeploymentConfig":
        env = data.get("environment", "development")
        cfg = cls(environment=Environment(env))
        if "lb" in data:
            for k, v in data["lb"].items():
                if hasattr(cfg.lb, k):
                    setattr(cfg.lb, k, v)
        if "db" in data:
            for k, v in data["db"].items():
                if hasattr(cfg.db, k):
                    setattr(cfg.db, k, v)
        if "cache" in data:
            for k, v in data["cache"].items():
                if hasattr(cfg.cache, k):
                    setattr(cfg.cache, k, v)
        if "monitoring" in data:
            for k, v in data["monitoring"].items():
                if hasattr(cfg.monitoring, k):
                    setattr(cfg.monitoring, k, v)
        return cfg
