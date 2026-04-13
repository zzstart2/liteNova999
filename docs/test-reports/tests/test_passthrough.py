"""
PRJ-LITE999-T-013 测试用例
透传模式功能测试：各厂商格式兼容性、错误处理、性能测试

覆盖：代理核心 (UT)、路由 (UT)、厂商兼容性 (UT)、错误处理 (UT)、集成 (IT)、性能 (PT)、边界 (ET)
"""

import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock

import pytest
import aiohttp

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.passthrough.router import PassthroughRouter, ProviderRoute, RouteNotFoundError
from src.passthrough.proxy import (
    PassthroughProxy, PassthroughRequest, PassthroughResponse, PassthroughChunk,
)


# ============================================================
# Fixtures
# ============================================================

ROUTES = [
    ProviderRoute("qwen", "/qwen", "https://dashscope.aliyuncs.com/compatible-mode/v1", api_key="sk-qwen"),
    ProviderRoute("doubao", "/doubao", "https://ark.cn-beijing.volces.com/api/v3", api_key="sk-doubao"),
    ProviderRoute("glm", "/glm", "https://open.bigmodel.cn/api/paas/v4", api_key="sk-glm"),
    ProviderRoute("kimi", "/kimi", "https://api.moonshot.cn/v1", api_key="sk-kimi"),
    ProviderRoute("minimax", "/minimax", "https://api.minimax.chat/v1", api_key="sk-mm"),
]


@pytest.fixture
def router():
    return PassthroughRouter(ROUTES)


@pytest.fixture
def proxy(router):
    return PassthroughProxy(router)


# ============================================================
# Helpers
# ============================================================

class AsyncIterLines:
    def __init__(self, lines):
        self._lines = list(lines)
        self._i = 0
    def __aiter__(self):
        return self
    async def __anext__(self):
        if self._i >= len(self._lines):
            raise StopAsyncIteration
        v = self._lines[self._i]
        self._i += 1
        return v


def make_mock_session(status=200, body=b"{}", headers=None, lines=None):
    resp = AsyncMock()
    resp.status = status
    resp.read = AsyncMock(return_value=body)
    resp.headers = headers or {}
    if lines is not None:
        resp.content = AsyncIterLines(lines)
    resp.__aenter__ = AsyncMock(return_value=resp)
    resp.__aexit__ = AsyncMock(return_value=False)
    session = AsyncMock()
    session.request = MagicMock(return_value=resp)
    return session


def qwen_body():
    return json.dumps({"model": "qwen-turbo", "messages": [{"role": "user", "content": "hi"}]})


def qwen_response():
    return json.dumps({"id": "1", "choices": [{"message": {"content": "hello"}, "finish_reason": "stop"}], "usage": {"total_tokens": 10}}).encode()


def minimax_body():
    return json.dumps({"model": "MiniMax-Text-01", "messages": [{"sender_type": "USER", "text": "hi"}], "tokens_to_generate": 100})


def minimax_response():
    return json.dumps({"choices": [{"messages": [{"text": "hello"}], "finish_reason": "stop"}], "base_resp": {"status_code": 0}}).encode()


# ============================================================
# UT-001 ~ UT-008: PassthroughProxy 核心
# ============================================================

class TestProxyCore:

    @pytest.mark.asyncio
    async def test_ut001_body_passthrough(self, proxy):
        raw = qwen_body()
        session = make_mock_session(body=qwen_response())
        req = PassthroughRequest(path="/qwen/chat/completions", body=raw)
        resp = await proxy.forward(req, session=session)
        call_args = session.request.call_args
        sent_data = call_args.kwargs.get("data", b"")
        assert json.loads(sent_data) == json.loads(raw)

    @pytest.mark.asyncio
    async def test_ut002_custom_headers_passthrough(self, proxy):
        session = make_mock_session(body=qwen_response())
        req = PassthroughRequest(
            path="/qwen/chat/completions",
            body=qwen_body(),
            headers={"X-Custom-Trace": "abc123", "X-Request-Id": "req-1"},
        )
        resp = await proxy.forward(req, session=session)
        sent_headers = session.request.call_args.kwargs.get("headers", {})
        assert sent_headers.get("X-Custom-Trace") == "abc123"
        assert sent_headers.get("X-Request-Id") == "req-1"

    @pytest.mark.asyncio
    async def test_ut003_api_key_injection(self, proxy):
        session = make_mock_session(body=qwen_response())
        req = PassthroughRequest(
            path="/qwen/chat/completions",
            body=qwen_body(),
            headers={"Authorization": "Bearer client-key-should-be-replaced"},
        )
        resp = await proxy.forward(req, session=session)
        sent_headers = session.request.call_args.kwargs.get("headers", {})
        assert sent_headers["Authorization"] == "Bearer sk-qwen"

    @pytest.mark.asyncio
    async def test_ut004_response_body_passthrough(self, proxy):
        vendor_body = qwen_response()
        session = make_mock_session(body=vendor_body)
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        resp = await proxy.forward(req, session=session)
        assert resp.body == vendor_body
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_ut005_status_code_preserved(self, proxy):
        for code in [200, 400, 401, 429, 500, 503]:
            session = make_mock_session(status=code, body=b'{"error":"test"}')
            req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
            resp = await proxy.forward(req, session=session)
            assert resp.status_code == code

    @pytest.mark.asyncio
    async def test_ut006_response_headers_preserved(self, proxy):
        session = make_mock_session(body=b"{}", headers={"Content-Type": "application/json", "X-Request-Id": "vendor-123"})
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        resp = await proxy.forward(req, session=session)
        assert any(k.lower() == "content-type" for k in resp.headers.keys())

    @pytest.mark.asyncio
    async def test_ut007_stream_passthrough(self, proxy):
        chunks = [b'data: {"choices":[{"delta":{"content":"He"}}]}\n', b'data: {"choices":[{"delta":{"content":"llo"}}]}\n', b'data: [DONE]\n']
        session = make_mock_session(lines=chunks)
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        collected = []
        async for chunk in proxy.forward_stream(req, session=session):
            collected.append(chunk)
        assert len(collected) >= 2

    @pytest.mark.asyncio
    async def test_ut008_stream_done_signal(self, proxy):
        chunks = [b'data: {"choices":[{"delta":{"content":"x"}}]}\n', b'data: [DONE]\n']
        session = make_mock_session(lines=chunks)
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        last = None
        async for chunk in proxy.forward_stream(req, session=session):
            last = chunk
        assert last.is_done


# ============================================================
# UT-009 ~ UT-016: Router 路由
# ============================================================

class TestRouter:

    def test_ut009_qwen(self, router):
        route, url = router.resolve("/qwen/chat/completions")
        assert route.name == "qwen"
        assert "dashscope" in url

    def test_ut010_doubao(self, router):
        route, url = router.resolve("/doubao/chat/completions")
        assert route.name == "doubao"
        assert "volces.com" in url

    def test_ut011_glm(self, router):
        route, url = router.resolve("/glm/chat/completions")
        assert route.name == "glm"
        assert "bigmodel.cn" in url

    def test_ut012_kimi(self, router):
        route, url = router.resolve("/kimi/chat/completions")
        assert route.name == "kimi"
        assert "moonshot.cn" in url

    def test_ut013_minimax(self, router):
        route, url = router.resolve("/minimax/text/chatcompletion_v2")
        assert route.name == "minimax"
        assert "minimax.chat" in url

    def test_ut014_path_rewrite(self, router):
        _, url = router.resolve("/qwen/chat/completions")
        assert url == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

    def test_ut015_not_found(self, router):
        with pytest.raises(RouteNotFoundError):
            router.resolve("/unknown/chat")

    def test_ut016_query_params(self, router):
        _, url = router.resolve("/qwen/models", {"page": "1", "size": "10"})
        assert "page=1" in url
        assert "size=10" in url


# ============================================================
# UT-017 ~ UT-031: 厂商格式兼容性
# ============================================================

class TestVendorCompatibility:

    @pytest.mark.asyncio
    async def test_qwen_request_passthrough(self, proxy):
        body = qwen_body()
        session = make_mock_session(body=b'{"ok":true}')
        req = PassthroughRequest(path="/qwen/chat/completions", body=body)
        resp = await proxy.forward(req, session=session)
        sent_data = session.request.call_args.kwargs.get("data", b"")
        assert json.loads(sent_data) == json.loads(body)

    @pytest.mark.asyncio
    async def test_qwen_response_passthrough(self, proxy):
        body = qwen_response()
        session = make_mock_session(body=body)
        req = PassthroughRequest(path="/qwen/chat/completions", body='{"model":"t","messages":[]}')
        resp = await proxy.forward(req, session=session)
        assert resp.body == body

    @pytest.mark.asyncio
    async def test_doubao_request(self, proxy):
        body = json.dumps({"model": "doubao-pro", "messages": [{"role": "user", "content": "hi"}]})
        session = make_mock_session(body=b'{"ok":true}')
        req = PassthroughRequest(path="/doubao/chat/completions", body=body)
        resp = await proxy.forward(req, session=session)
        assert resp.is_success

    @pytest.mark.asyncio
    async def test_glm_request(self, proxy):
        body = json.dumps({"model": "glm-4", "messages": [{"role": "user", "content": "hi"}]})
        session = make_mock_session(body=b'{"ok":true}')
        req = PassthroughRequest(path="/glm/chat/completions", body=body)
        resp = await proxy.forward(req, session=session)
        assert resp.is_success

    @pytest.mark.asyncio
    async def test_kimi_request(self, proxy):
        body = json.dumps({"model": "moonshot-v1-8k", "messages": [{"role": "user", "content": "hi"}]})
        session = make_mock_session(body=b'{"ok":true}')
        req = PassthroughRequest(path="/kimi/chat/completions", body=body)
        resp = await proxy.forward(req, session=session)
        assert resp.is_success

    @pytest.mark.asyncio
    async def test_minimax_request_passthrough(self, proxy):
        body = minimax_body()
        session = make_mock_session(body=minimax_response())
        req = PassthroughRequest(path="/minimax/text/chatcompletion_v2", body=body)
        resp = await proxy.forward(req, session=session)
        sent_data = session.request.call_args.kwargs.get("data", b"")
        assert "sender_type" in json.dumps(json.loads(sent_data))

    @pytest.mark.asyncio
    async def test_minimax_response_passthrough(self, proxy):
        body = minimax_response()
        session = make_mock_session(body=body)
        req = PassthroughRequest(path="/minimax/text/chatcompletion_v2", body=minimax_body())
        resp = await proxy.forward(req, session=session)
        assert resp.body == body
        assert "base_resp" in resp.json

    @pytest.mark.asyncio
    async def test_all_vendors_response_preserve(self, proxy):
        vendors = [
            ("/qwen/chat/completions", qwen_response()),
            ("/doubao/chat/completions", b'{"choices":[{"message":{"content":"ok"}}]}'),
            ("/glm/chat/completions", b'{"choices":[{"message":{"content":"ok"}}]}'),
            ("/kimi/chat/completions", b'{"choices":[{"message":{"content":"ok"}}]}'),
            ("/minimax/text/chatcompletion_v2", minimax_response()),
        ]
        for path, resp_body in vendors:
            session = make_mock_session(body=resp_body)
            req = PassthroughRequest(path=path, body='{"model":"t","messages":[]}')
            resp = await proxy.forward(req, session=session)
            assert resp.body == resp_body


# ============================================================
# UT-032 ~ UT-039: 错误处理
# ============================================================

class TestErrorHandling:

    @pytest.mark.asyncio
    @pytest.mark.parametrize("status", [400, 401, 429, 500])
    async def test_vendor_http_errors_passthrough(self, proxy, status):
        err_body = json.dumps({"error": {"message": f"err-{status}"}}).encode()
        session = make_mock_session(status=status, body=err_body)
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        resp = await proxy.forward(req, session=session)
        assert resp.status_code == status
        assert resp.body == err_body

    @pytest.mark.asyncio
    async def test_ut034_429_with_retry_after(self, proxy):
        session = make_mock_session(status=429, body=b'{"error":"rate limited"}', headers={"Retry-After": "30"})
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        resp = await proxy.forward(req, session=session)
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_ut036_connection_failure(self, proxy):
        session = AsyncMock()
        session.request = MagicMock(side_effect=aiohttp.ClientConnectorError(connection_key=MagicMock(), os_error=OSError("Connection refused")))
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        resp = await proxy.forward(req, session=session)
        assert resp.status_code == 502
        assert "Bad Gateway" in resp.text

    @pytest.mark.asyncio
    async def test_ut037_timeout(self, proxy):
        session = AsyncMock()
        session.request = MagicMock(side_effect=asyncio.TimeoutError())
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        resp = await proxy.forward(req, session=session)
        assert resp.status_code == 504
        assert "Timeout" in resp.text

    @pytest.mark.asyncio
    async def test_ut038_dns_failure(self, proxy):
        session = AsyncMock()
        session.request = MagicMock(side_effect=aiohttp.ClientConnectorError(connection_key=MagicMock(), os_error=OSError("DNS resolution failed")))
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        resp = await proxy.forward(req, session=session)
        assert resp.status_code == 502

    @pytest.mark.asyncio
    async def test_ut039_non_json_body(self, proxy):
        session = make_mock_session()
        req = PassthroughRequest(path="/qwen/chat/completions", body=b"not json at all")
        resp = await proxy.forward(req, session=session)
        assert resp.status_code == 400
        assert "not valid JSON" in resp.text

    @pytest.mark.asyncio
    async def test_route_not_found_404(self, proxy):
        req = PassthroughRequest(path="/unknown/api", body="{}")
        resp = await proxy.forward(req, session=AsyncMock())
        assert resp.status_code == 404


# ============================================================
# IT: 集成测试
# ============================================================

class TestIntegration:

    @pytest.mark.asyncio
    async def test_it001_e2e_qwen(self, proxy):
        body = qwen_body()
        session = make_mock_session(body=qwen_response())
        req = PassthroughRequest(path="/qwen/chat/completions", body=body)
        resp = await proxy.forward(req, session=session)
        assert resp.is_success
        assert "choices" in resp.json

    @pytest.mark.asyncio
    async def test_it002_e2e_minimax(self, proxy):
        body = minimax_body()
        session = make_mock_session(body=minimax_response())
        req = PassthroughRequest(path="/minimax/text/chatcompletion_v2", body=body)
        resp = await proxy.forward(req, session=session)
        assert resp.is_success
        assert "base_resp" in resp.json

    @pytest.mark.asyncio
    async def test_it003_e2e_stream(self, proxy):
        chunks = [b'data: {"choices":[{"delta":{"content":"H"}}]}\n', b'data: {"choices":[{"delta":{"content":"i"}}]}\n', b'data: [DONE]\n']
        session = make_mock_session(lines=chunks)
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        collected = []
        async for c in proxy.forward_stream(req, session=session):
            collected.append(c)
        assert len(collected) >= 2
        assert collected[-1].is_done

    @pytest.mark.asyncio
    async def test_it004_error_passthrough(self, proxy):
        err = json.dumps({"error": {"code": "invalid_model"}}).encode()
        session = make_mock_session(status=400, body=err)
        req = PassthroughRequest(path="/glm/chat/completions", body='{"model":"bad"}')
        resp = await proxy.forward(req, session=session)
        assert resp.status_code == 400
        assert resp.body == err

    @pytest.mark.asyncio
    async def test_it005_sequential_different_vendors(self, proxy):
        vendors = [
            ("/qwen/chat/completions", qwen_response()),
            ("/doubao/chat/completions", b'{"choices":[{"message":{"content":"doubao"}}]}'),
            ("/glm/chat/completions", b'{"choices":[{"message":{"content":"glm"}}]}'),
            ("/kimi/chat/completions", b'{"choices":[{"message":{"content":"kimi"}}]}'),
            ("/minimax/text/chatcompletion_v2", minimax_response()),
        ]
        for path, resp_body in vendors:
            session = make_mock_session(body=resp_body)
            req = PassthroughRequest(path=path, body='{"model":"t","messages":[]}')
            resp = await proxy.forward(req, session=session)
            assert resp.is_success


# ============================================================
# PT: 性能测试
# ============================================================

class TestPerformance:

    @pytest.mark.asyncio
    async def test_pt001_proxy_overhead(self, proxy):
        session = make_mock_session(body=b"{}")
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        await proxy.forward(req, session=session)  # warmup
        latencies = []
        for _ in range(500):
            start = time.perf_counter()
            await proxy.forward(req, session=session)
            latencies.append((time.perf_counter() - start) * 1000)
        latencies.sort()
        p95 = latencies[int(len(latencies) * 0.95)]
        assert p95 < 5.0, f"P95 {p95:.2f}ms > 5ms"

    @pytest.mark.asyncio
    async def test_pt002_large_request(self, proxy):
        big = json.dumps({"model": "test", "messages": [{"role": "user", "content": "x" * 1_000_000}]})
        session = make_mock_session(body=b'{"ok":true}')
        req = PassthroughRequest(path="/qwen/chat/completions", body=big)
        resp = await proxy.forward(req, session=session)
        assert resp.is_success

    @pytest.mark.asyncio
    async def test_pt003_large_response(self, proxy):
        big_resp = json.dumps({"content": "y" * 1_000_000}).encode()
        session = make_mock_session(body=big_resp)
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        resp = await proxy.forward(req, session=session)
        assert len(resp.body) == len(big_resp)

    @pytest.mark.asyncio
    async def test_pt004_concurrent_100(self, proxy):
        session = make_mock_session(body=qwen_response())
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        tasks = [proxy.forward(req, session=session) for _ in range(100)]
        results = await asyncio.gather(*tasks)
        assert len(results) == 100
        assert all(r.is_success for r in results)

    @pytest.mark.asyncio
    async def test_pt005_stream_1000_chunks(self, proxy):
        lines = [f'data: {{"choices":[{{"delta":{{"content":"c{i}"}}}}]}}\n'.encode() for i in range(1000)]
        lines.append(b'data: [DONE]\n')
        session = make_mock_session(lines=lines)
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        count = 0
        async for _ in proxy.forward_stream(req, session=session):
            count += 1
        assert count == 1001


# ============================================================
# ET: 边界/异常测试
# ============================================================

class TestEdgeCases:

    @pytest.mark.asyncio
    async def test_et001_empty_body(self, proxy):
        session = make_mock_session()
        req = PassthroughRequest(path="/qwen/chat/completions", body=b"")
        resp = await proxy.forward(req, session=session)
        assert resp.status_code in (200, 400)

    @pytest.mark.asyncio
    async def test_et002_empty_path(self, proxy):
        req = PassthroughRequest(path="", body="{}")
        resp = await proxy.forward(req, session=AsyncMock())
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_et003_many_headers(self, proxy):
        headers = {f"X-Header-{i}": f"value-{i}" for i in range(100)}
        session = make_mock_session(body=b"{}")
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body(), headers=headers)
        resp = await proxy.forward(req, session=session)
        sent_h = session.request.call_args.kwargs.get("headers", {})
        assert len(sent_h) >= 100

    @pytest.mark.asyncio
    async def test_et004_binary_body(self, proxy):
        session = make_mock_session()
        req = PassthroughRequest(path="/qwen/chat/completions", body=bytes(range(256)))
        resp = await proxy.forward(req, session=session)
        assert resp.status_code == 400

    def test_router_unregister(self, router):
        router.unregister("qwen")
        with pytest.raises(RouteNotFoundError):
            router.resolve("/qwen/chat/completions")

    def test_router_list_and_get(self, router):
        routes = router.list_routes()
        assert len(routes) == 5
        r = router.get_route_by_name("kimi")
        assert r is not None
        assert router.get_route_by_name("nonexistent") is None

    @pytest.mark.asyncio
    async def test_response_properties(self, proxy):
        body = json.dumps({"key": "value"}).encode()
        session = make_mock_session(status=200, body=body)
        req = PassthroughRequest(path="/qwen/chat/completions", body=qwen_body())
        resp = await proxy.forward(req, session=session)
        assert resp.text == body.decode()
        assert resp.json == {"key": "value"}
        assert resp.is_success is True
        assert resp.elapsed_ms >= 0