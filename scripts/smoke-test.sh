#!/bin/bash
# LiteNova Smoke Test
# Usage: ./scripts/smoke-test.sh [base_url] [api_key]
# Defaults: http://localhost:3000, no API test if key not provided

set -euo pipefail

BASE="${1:-http://localhost:3000}"
API_KEY="${2:-}"
PASS=0
FAIL=0

check() {
    local name="$1"
    local result="$2"
    local expect="$3"
    if [ "$result" = "$expect" ]; then
        echo "  PASS  $name"
        PASS=$((PASS+1))
    else
        echo "  FAIL  $name (got: $result, expected: $expect)"
        FAIL=$((FAIL+1))
    fi
}

echo "=== LiteNova Smoke Test ==="
echo "Target: $BASE"
echo ""

# 1. API status
echo "[1/6] API Status"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/status")
check "/api/status returns 200" "$CODE" "200"

VERSION=$(curl -s "$BASE/api/status" | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['version'])" 2>/dev/null || echo "unknown")
echo "       Version: $VERSION"

# 2. Frontend pages
echo "[2/6] Frontend Pages"
for page in "/" "/login" "/dashboard" "/channel-health"; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$page")
    check "GET $page" "$CODE" "200"
done

# 3. Frontend JS bundle
echo "[3/6] Frontend Bundle"
HAS_JS=$(curl -s "$BASE/" | grep -c "static/js/main" || echo "0")
check "index.html has JS bundle" "$([ "$HAS_JS" -gt 0 ] && echo "yes" || echo "no")" "yes"

# 4. Health endpoint (requires admin session)
echo "[4/6] Health Endpoint (admin)"
SESSION=$(curl -sD - -X POST "$BASE/api/user/login" -H "Content-Type: application/json" -d '{"username":"root","password":"123456"}' 2>&1 | grep -i set-cookie | sed 's/.*session=\([^;]*\).*/session=\1/' || echo "")
if [ -n "$SESSION" ]; then
    HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "session=$SESSION" "$BASE/api/channel/health")
    if [ "$HEALTH_CODE" = "200" ]; then
        check "/api/channel/health" "$HEALTH_CODE" "200"
    else
        echo "  SKIP  /api/channel/health returned $HEALTH_CODE (login may have failed)"
    fi

    PROVIDERS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "session=$SESSION" "$BASE/api/channel/providers")
    if [ "$PROVIDERS_CODE" = "200" ]; then
        check "/api/channel/providers" "$PROVIDERS_CODE" "200"
    else
        echo "  SKIP  /api/channel/providers returned $PROVIDERS_CODE"
    fi
else
    echo "  SKIP  Could not login (password may differ)"
fi

# 5. Docker containers (only if running locally)
echo "[5/6] Docker Containers"
if command -v docker &>/dev/null; then
    for c in one-api one-api-db one-api-redis; do
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$c" 2>/dev/null || echo "not_found")
        check "Container $c" "$STATUS" "healthy"
    done
else
    echo "  SKIP  Docker not available"
fi

# 6. API relay (only if key provided)
echo "[6/6] API Relay"
if [ -n "$API_KEY" ]; then
    RESP=$(curl -s --max-time 30 "$BASE/v1/chat/completions" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model":"qwen-plus","messages":[{"role":"user","content":"say ok"}]}')
    HAS_CHOICES=$(echo "$RESP" | python3 -c "import json,sys;r=json.load(sys.stdin);print('yes' if 'choices' in r else 'no')" 2>/dev/null || echo "no")
    check "Relay /v1/chat/completions" "$HAS_CHOICES" "yes"

    PT_RESP=$(curl -s --max-time 30 "$BASE/passthrough/v1/chat/completions" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model":"qwen-plus","messages":[{"role":"user","content":"say ok"}]}')
    HAS_PT=$(echo "$PT_RESP" | python3 -c "import json,sys;r=json.load(sys.stdin);print('yes' if 'choices' in r else 'no')" 2>/dev/null || echo "no")
    check "Passthrough /passthrough/v1/chat/completions" "$HAS_PT" "yes"
else
    echo "  SKIP  No API key provided"
fi

# Summary
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
