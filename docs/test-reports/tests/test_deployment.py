"""
PRJ-LITE999-T-016 测试用例
生产环境部署方案：负载均衡、数据库、缓存、监控
"""

import asyncio
import threading
import time

import pytest

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.deployment.config import (
    DeploymentConfig, Environment, LBConfig, DBConfig, CacheConfig,
    MonitorConfig, ValidationError,
)
from src.deployment.load_balancer import (
    LoadBalancer, LBNode, LBStrategy, NoHealthyNodeError,
)
from src.deployment.database import (
    DatabasePool, DBConnection, ReadWriteRouter, PoolExhaustedError, RetryStrategy,
)
from src.deployment.cache import CacheManager, CacheStats
from src.deployment.monitoring import (
    MonitoringCollector, MetricType, HealthEndpoint, AlertRule,
)


# ============================================================
# Helpers
# ============================================================

class FakeClock:
    def __init__(self, start=1000.0):
        self._now = start
    def __call__(self):
        return self._now
    def advance(self, s):
        self._now += s


# ============================================================
# DC: 部署配置
# ============================================================

class TestDeploymentConfig:

    def test_dc001_defaults(self):
        """DC-001: 默认配置完整"""
        cfg = DeploymentConfig()
        assert cfg.environment == Environment.DEVELOPMENT
        assert cfg.lb.strategy == "round_robin"
        assert cfg.db.pool_min == 5
        assert cfg.cache.default_ttl == 300.0
        assert cfg.monitoring.metrics_path == "/metrics"

    def test_dc002_production_validation(self):
        """DC-002: 生产环境必填项缺失报错"""
        cfg = DeploymentConfig(environment=Environment.PRODUCTION)
        with pytest.raises(ValidationError):
            cfg.validate()

    def test_dc002_production_valid(self):
        """DC-002b: 生产环境必填项齐全通过"""
        cfg = DeploymentConfig(
            environment=Environment.PRODUCTION,
            db=DBConfig(primary_dsn="postgres://localhost/prod"),
        )
        cfg.validate()  # 不抛异常

    def test_dc003_environments(self):
        """DC-003: 环境标识"""
        for env in [Environment.PRODUCTION, Environment.STAGING, Environment.DEVELOPMENT]:
            cfg = DeploymentConfig(environment=env)
            assert cfg.environment == env

    def test_dc004_serialization(self):
        """DC-004: 配置序列化/反序列化"""
        cfg = DeploymentConfig(
            environment=Environment.STAGING,
            db=DBConfig(primary_dsn="postgres://test"),
            cache=CacheConfig(key_prefix="staging:"),
        )
        d = cfg.to_dict()
        restored = DeploymentConfig.from_dict(d)
        assert restored.environment == Environment.STAGING
        assert restored.db.primary_dsn == "postgres://test"
        assert restored.cache.key_prefix == "staging:"

    def test_dc005_invalid_port(self):
        """DC-005: 非法端口拒绝"""
        cfg = DeploymentConfig(lb=LBConfig(nodes=[{"host": "a", "port": 99999}]))
        with pytest.raises(ValidationError):
            cfg.validate(strict=True)

    def test_dc005_negative_weight(self):
        """DC-005b: 负权重拒绝"""
        cfg = DeploymentConfig(lb=LBConfig(nodes=[{"host": "a", "weight": -1}]))
        with pytest.raises(ValidationError):
            cfg.validate(strict=True)


# ============================================================
# LB: 负载均衡
# ============================================================

class TestLoadBalancer:

    def test_lb001_round_robin(self):
        """LB-001: 轮询均匀分配"""
        nodes = [LBNode(host=f"n{i}") for i in range(3)]
        lb = LoadBalancer(nodes, strategy=LBStrategy.ROUND_ROBIN)
        selections = [lb.select().host for _ in range(9)]
        assert selections == ["n0", "n1", "n2"] * 3

    def test_lb002_weighted_round_robin(self):
        """LB-002: 加权轮询按比例分配"""
        nodes = [
            LBNode(host="heavy", weight=3),
            LBNode(host="light", weight=1),
        ]
        lb = LoadBalancer(nodes, strategy=LBStrategy.WEIGHTED_ROUND_ROBIN)
        counts = {"heavy": 0, "light": 0}
        for _ in range(400):
            counts[lb.select().host] += 1
        ratio = counts["heavy"] / counts["light"]
        assert 2.5 < ratio < 3.5  # ~3:1

    def test_lb003_least_connections(self):
        """LB-003: 最少连接"""
        n1 = LBNode(host="n1", active_connections=10)
        n2 = LBNode(host="n2", active_connections=2)
        n3 = LBNode(host="n3", active_connections=5)
        lb = LoadBalancer([n1, n2, n3], strategy=LBStrategy.LEAST_CONNECTIONS)
        assert lb.select().host == "n2"

    def test_lb004_unhealthy_excluded(self):
        """LB-004: unhealthy 节点不参与"""
        nodes = [LBNode(host="good"), LBNode(host="bad", healthy=False)]
        lb = LoadBalancer(nodes)
        for _ in range(10):
            assert lb.select().host == "good"

    def test_lb005_recovery(self):
        """LB-005: 恢复后重新参与"""
        lb = LoadBalancer([LBNode(host="a"), LBNode(host="b")])
        lb.mark_unhealthy("a")
        assert lb.select().host == "b"
        lb.mark_healthy("a")
        hosts = {lb.select().host for _ in range(10)}
        assert "a" in hosts

    def test_lb006_all_unhealthy(self):
        """LB-006: 全部不可用"""
        lb = LoadBalancer([LBNode(host="a", healthy=False)])
        with pytest.raises(NoHealthyNodeError):
            lb.select()

    def test_lb007_single_node(self):
        """LB-007: 单节点"""
        lb = LoadBalancer([LBNode(host="solo")])
        for _ in range(10):
            assert lb.select().host == "solo"

    def test_lb008_thread_safety(self):
        """LB-008: 并发选择"""
        nodes = [LBNode(host=f"n{i}") for i in range(3)]
        lb = LoadBalancer(nodes)
        results = []
        errors = []

        def worker():
            try:
                for _ in range(100):
                    results.append(lb.select().host)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads: t.start()
        for t in threads: t.join()
        assert not errors
        assert len(results) == 1000


# ============================================================
# DB: 数据库连接池
# ============================================================

class TestDatabasePool:

    def test_db001_acquire(self):
        """DB-001: 获取连接"""
        pool = DatabasePool("postgres://test", min_size=2, max_size=5)
        conn = pool.acquire()
        assert isinstance(conn, DBConnection)
        assert conn.in_use

    def test_db002_release_reuse(self):
        """DB-002: 释放后可复用"""
        pool = DatabasePool("postgres://test", min_size=1, max_size=2)
        c1 = pool.acquire()
        pool.release(c1)
        c2 = pool.acquire()
        assert c2.conn_id == c1.conn_id  # 同一连接

    def test_db003_pool_exhausted(self):
        """DB-003: 连接池耗尽"""
        pool = DatabasePool("postgres://test", min_size=1, max_size=2)
        pool.acquire()
        pool.acquire()
        with pytest.raises(PoolExhaustedError):
            pool.acquire()

    def test_db004_read_write_split(self):
        """DB-004: 读写分离"""
        primary = DatabasePool("postgres://primary", min_size=1, max_size=5, is_primary=True)
        replica = DatabasePool("postgres://replica", min_size=1, max_size=5, is_primary=False)
        rw = ReadWriteRouter(primary, [replica])

        w = rw.get_write_conn()
        assert w.is_primary is True
        rw.release(w)

        r = rw.get_read_conn()
        assert r.is_primary is False
        rw.release(r)

    def test_db005_health_check_eviction(self):
        """DB-005: 连接健康检查淘汰"""
        pool = DatabasePool("postgres://test", min_size=2, max_size=5)
        pool._pool[0].healthy = False
        removed = pool.health_check()
        assert removed == 1
        assert pool.size >= 2  # 补充到 min_size

    def test_db006_retry_strategy(self):
        """DB-006: 指数退避重试"""
        strategy = RetryStrategy(max_retries=3, base_delay=0.001)
        assert strategy.get_delay(0) == pytest.approx(0.001)
        assert strategy.get_delay(1) == pytest.approx(0.002)
        assert strategy.get_delay(2) == pytest.approx(0.004)

    @pytest.mark.asyncio
    async def test_db006_retry_execute(self):
        """DB-006b: 重试执行"""
        strategy = RetryStrategy(max_retries=2, base_delay=0.001)
        call_count = 0

        async def flaky():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("fail")
            return "ok"

        result = await strategy.execute(flaky)
        assert result == "ok"
        assert call_count == 3

    def test_db007_pool_sizes(self):
        """DB-007: min/max 边界"""
        pool = DatabasePool("postgres://test", min_size=3, max_size=3)
        assert pool.size == 3
        c1 = pool.acquire()
        c2 = pool.acquire()
        c3 = pool.acquire()
        with pytest.raises(PoolExhaustedError):
            pool.acquire()
        pool.release(c1)
        c4 = pool.acquire()  # 不抛异常
        assert c4.conn_id == c1.conn_id


# ============================================================
# CA: 缓存管理
# ============================================================

class TestCacheManager:

    def test_ca001_set_get(self):
        """CA-001: set + get"""
        cm = CacheManager(default_ttl=300)
        cm.set("key1", "value1")
        assert cm.get("key1") == "value1"

    def test_ca002_delete(self):
        """CA-002: delete"""
        cm = CacheManager()
        cm.set("key1", "val")
        assert cm.delete("key1") is True
        assert cm.get("key1") is None

    def test_ca003_ttl_expiry(self):
        """CA-003: TTL 过期"""
        clock = FakeClock()
        cm = CacheManager(default_ttl=10, clock=clock)
        cm.set("k", "v")
        assert cm.get("k") == "v"
        clock.advance(11)
        assert cm.get("k") is None

    def test_ca004_key_prefix_isolation(self):
        """CA-004: Key 前缀隔离"""
        cm_a = CacheManager(key_prefix="app_a:")
        cm_b = CacheManager(key_prefix="app_b:")
        cm_a.set("user", "Alice")
        cm_b.set("user", "Bob")
        assert cm_a.get("user") == "Alice"
        assert cm_b.get("user") == "Bob"

    def test_ca005_null_cache(self):
        """CA-005: 空值缓存（穿透保护）"""
        clock = FakeClock()
        cm = CacheManager(clock=clock)
        cm.set_null("missing_key", ttl=60)
        # get 命中但返回 None
        result = cm.get("missing_key")
        assert result is None
        assert cm.stats.hits == 1  # 是命中，不是 miss

    def test_ca006_stats(self):
        """CA-006: 命中率统计"""
        cm = CacheManager()
        cm.set("a", 1)
        cm.get("a")    # hit
        cm.get("a")    # hit
        cm.get("b")    # miss
        assert cm.stats.hits == 2
        assert cm.stats.misses == 1
        assert cm.stats.hit_rate == pytest.approx(2/3)

    def test_ca007_mget_mset(self):
        """CA-007: 批量操作"""
        cm = CacheManager()
        cm.mset({"x": 1, "y": 2, "z": 3})
        result = cm.mget(["x", "y", "z", "w"])
        assert result == {"x": 1, "y": 2, "z": 3, "w": None}


# ============================================================
# MO: 监控采集
# ============================================================

class TestMonitoringCollector:

    def test_mo001_counter(self):
        """MO-001: Counter 递增"""
        mc = MonitoringCollector()
        mc.inc("requests_total")
        mc.inc("requests_total")
        mc.inc("requests_total", 3)
        assert mc.get_value("requests_total") == 5.0

    def test_mo002_gauge(self):
        """MO-002: Gauge 设置"""
        mc = MonitoringCollector()
        mc.set_gauge("cpu_usage", 0.75)
        assert mc.get_value("cpu_usage") == 0.75
        mc.set_gauge("cpu_usage", 0.3)
        assert mc.get_value("cpu_usage") == 0.3

    def test_mo003_histogram(self):
        """MO-003: Histogram 分桶"""
        mc = MonitoringCollector()
        mc.register_metric("latency", MetricType.HISTOGRAM, buckets=[0.1, 0.5, 1.0])
        mc.observe("latency", 0.05)
        mc.observe("latency", 0.3)
        mc.observe("latency", 0.8)
        mv = mc.get_metric("latency")
        assert mv.count == 3
        assert mv.bucket_counts[0.1] == 1   # 0.05 <= 0.1
        assert mv.bucket_counts[0.5] == 2   # 0.05, 0.3 <= 0.5
        assert mv.bucket_counts[1.0] == 3   # all <= 1.0

    def test_mo004_healthz(self):
        """MO-004: /healthz 端点"""
        mc = MonitoringCollector()
        mc.health.register("database", True)
        mc.health.register("cache", True)
        result = mc.health.healthz()
        assert result["status"] == "ok"

        mc.health.set_status("cache", False)
        result = mc.health.healthz()
        assert result["status"] == "degraded"

    def test_mo005_readyz(self):
        """MO-005: /readyz 端点"""
        mc = MonitoringCollector()
        mc.health.register("database", True)
        mc.health.register("cache", True)
        assert mc.health.readyz()["ready"] is True

        mc.health.set_status("database", False)
        assert mc.health.readyz()["ready"] is False

    def test_mo006_alert_threshold(self):
        """MO-006: 告警阈值"""
        mc = MonitoringCollector()
        mc.set_gauge("error_rate", 0.15)
        mc.register_alert(AlertRule(
            metric_name="error_rate", threshold=0.1, operator=">",
            message="Error rate too high",
        ))
        alerts = mc.check_alerts()
        assert len(alerts) == 1
        assert alerts[0].current_value == 0.15

    def test_mo006_alert_not_triggered(self):
        """MO-006b: 未超阈值不告警"""
        mc = MonitoringCollector()
        mc.set_gauge("error_rate", 0.05)
        mc.register_alert(AlertRule(metric_name="error_rate", threshold=0.1, operator=">"))
        alerts = mc.check_alerts()
        assert len(alerts) == 0

    def test_mo007_prometheus_export(self):
        """MO-007: Prometheus 格式导出"""
        mc = MonitoringCollector()
        mc.inc("http_requests_total", 42)
        mc.set_gauge("memory_bytes", 1024000)
        output = mc.export_prometheus()
        assert "# TYPE http_requests_total counter" in output
        assert "http_requests_total 42" in output
        assert "# TYPE memory_bytes gauge" in output
        assert "memory_bytes 1024000" in output

    def test_mo008_labels(self):
        """MO-008: 指标标签"""
        mc = MonitoringCollector()
        mc.inc("requests", labels={"method": "GET"})
        mc.inc("requests", labels={"method": "POST"})
        mc.inc("requests", labels={"method": "GET"}, value=2)
        assert mc.get_value("requests", {"method": "GET"}) == 3.0
        assert mc.get_value("requests", {"method": "POST"}) == 1.0


# ============================================================
# IT: 集成测试
# ============================================================

class TestIntegration:

    def test_it001_all_components_init(self):
        """IT-001: 全组件初始化"""
        lb = LoadBalancer([LBNode(host="app1"), LBNode(host="app2")])
        db = DatabasePool("postgres://primary", min_size=2, max_size=5)
        cache = CacheManager(key_prefix="prod:")
        monitor = MonitoringCollector()

        assert lb.node_count == 2
        assert db.size >= 2
        assert cache.size == 0
        monitor.health.register("lb", True)
        monitor.health.register("db", True)
        monitor.health.register("cache", True)
        assert monitor.health.readyz()["ready"] is True

    def test_it002_request_pipeline(self):
        """IT-002: LB选节点→DB查询→Cache缓存→Monitor记录"""
        lb = LoadBalancer([LBNode(host="app1"), LBNode(host="app2")])
        db = DatabasePool("postgres://primary", min_size=2, max_size=5)
        cache = CacheManager(key_prefix="prod:")
        monitor = MonitoringCollector()

        # 1. LB 选节点
        node = lb.select()
        lb.connect(node)
        monitor.inc("requests_total", labels={"node": node.host})

        # 2. Cache 查询
        cached = cache.get("user:123")
        if cached is None:
            # 3. DB 查询
            conn = db.acquire()
            result = {"id": 123, "name": "Alice"}  # 模拟查询
            db.release(conn)
            # 4. 写入缓存
            cache.set("user:123", result)
            monitor.inc("cache_miss")
        else:
            monitor.inc("cache_hit")

        lb.disconnect(node)

        assert cache.get("user:123") == {"id": 123, "name": "Alice"}
        assert monitor.get_value("requests_total", {"node": node.host}) == 1.0

    def test_it003_node_failure_alert(self):
        """IT-003: 节点故障→LB摘除→Monitor告警"""
        lb = LoadBalancer([LBNode(host="app1"), LBNode(host="app2")])
        monitor = MonitoringCollector()
        monitor.health.register("app1", True)
        monitor.health.register("app2", True)

        # 模拟 app1 故障
        lb.mark_unhealthy("app1")
        monitor.health.set_status("app1", False)
        monitor.set_gauge("unhealthy_nodes", 1)
        monitor.register_alert(AlertRule(
            metric_name="unhealthy_nodes", threshold=0, operator=">",
            message="Node down",
        ))

        alerts = monitor.check_alerts()
        assert len(alerts) == 1
        assert monitor.health.healthz()["status"] == "degraded"

        # LB 只分配到 app2
        for _ in range(5):
            assert lb.select().host == "app2"

    def test_it004_hot_reload(self):
        """IT-004: 配置热更新"""
        cache = CacheManager(default_ttl=60, key_prefix="v1:")
        cache.set("key", "old")
        assert cache.get("key") == "old"

        # 模拟热更新：新 CacheManager
        cache2 = CacheManager(default_ttl=120, key_prefix="v2:")
        cache2.set("key", "new")
        assert cache2.get("key") == "new"
        # 旧 cache 不受影响
        assert cache.get("key") == "old"


# ============================================================
# ET: 边界/异常测试
# ============================================================

class TestEdgeCases:

    def test_et001_zero_nodes(self):
        """ET-001: 零节点 LB"""
        lb = LoadBalancer([])
        with pytest.raises(NoHealthyNodeError):
            lb.select()

    def test_et002_negative_weight_validation(self):
        """ET-002: 负权重 → ValidationError"""
        cfg = DeploymentConfig(lb=LBConfig(nodes=[{"host": "a", "weight": -5}]))
        with pytest.raises(ValidationError):
            cfg.validate(strict=True)

    def test_et003_large_pool(self):
        """ET-003: 超大连接池不 OOM"""
        pool = DatabasePool("postgres://test", min_size=0, max_size=10000)
        conns = []
        for _ in range(100):  # 只申请 100 个验证功能
            conns.append(pool.acquire())
        assert pool.size == 100
        for c in conns:
            pool.release(c)

    def test_et004_ttl_zero(self):
        """ET-004: TTL=0 立即过期"""
        clock = FakeClock()
        cm = CacheManager(clock=clock)
        cm.set("k", "v", ttl=0)
        assert cm.get("k") is None  # 立即过期

    def test_et005_special_chars_key(self):
        """ET-005: 特殊字符 cache key"""
        cm = CacheManager()
        weird_keys = ["key with spaces", "key:colon", "key/slash", "key{brace}", "中文key", "emoji🔥"]
        for k in weird_keys:
            cm.set(k, f"val-{k}")
            assert cm.get(k) == f"val-{k}"
