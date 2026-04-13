#!/usr/bin/env bash
# =============================================================================
# PRJ-LITE999-T-002 部署脚本 — 开发环境搭建与项目初始化
# 前置条件: Fork 已手动完成 (zzstart2/new-api 存在)
# =============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/.openclaw/workspace-ops-prjlite999/new-api}"
FORK_OWNER="${FORK_OWNER:-zzstart2}"
FORK_REPO="new-api"
FORK_FULL="$FORK_OWNER/$FORK_REPO"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
check() { echo -e "  ${GREEN}✓${NC} $*"; }
skip()  { echo -e "  ${YELLOW}⊘${NC} $*"; }

# --------------- Pre-flight ---------------
info "Pre-flight checks"
command -v gh >/dev/null 2>&1 || error "gh CLI 未安装"
command -v git >/dev/null 2>&1 || error "git 未安装"
cd "$REPO_DIR" || error "仓库目录 $REPO_DIR 不存在"

# Verify fork exists
if gh repo view "$FORK_FULL" --json name >/dev/null 2>&1; then
    check "Fork $FORK_FULL 存在"
else
    error "Fork $FORK_FULL 不存在。请先手动 fork QuantumNous/new-api"
fi

# --------------- Step 1: 配置 Remote ---------------
info "Step 1: 配置 Git Remote"
CURRENT_ORIGIN=$(git remote get-url origin 2>/dev/null || echo "none")

if echo "$CURRENT_ORIGIN" | grep -q "$FORK_OWNER"; then
    check "origin 已指向 fork"
else
    info "  切换 origin: $CURRENT_ORIGIN → $FORK_FULL"
    git remote set-url origin "https://github.com/$FORK_FULL.git"
    check "origin 已更新"
fi

# 添加 upstream (如果不存在)
if git remote get-url upstream >/dev/null 2>&1; then
    check "upstream remote 已存在"
else
    git remote add upstream https://github.com/QuantumNous/new-api.git
    check "upstream remote 已添加"
fi

echo "  Remotes:"
git remote -v | sed 's/^/    /'

# --------------- Step 2: 推送分支 ---------------
info "Step 2: 推送分支"

push_branch() {
    local branch="$1"
    if git push -u origin "$branch" 2>&1; then
        check "$branch 已推送"
    else
        warn "$branch 推送失败 (可能权限不足)"
    fi
}

push_branch "main"
push_branch "develop"

# --------------- Step 3: 验证远程分支 ---------------
info "Step 3: 验证远程文件"

REMOTE_FILES=$(gh api "repos/$FORK_FULL/git/trees/develop?recursive=1" \
    --jq '.tree[].path' 2>/dev/null || echo "")

T002_FILES=(
    ".editorconfig"
    ".env.dev"
    ".golangci.yml"
    ".github/workflows/ci.yml"
    ".github/workflows/cd.yml"
    ".github/pull_request_template.md"
    "CONTRIBUTING.md"
    "docker-compose.dev.yml"
)

all_found=true
for f in "${T002_FILES[@]}"; do
    if echo "$REMOTE_FILES" | grep -qx "$f"; then
        check "$f"
    else
        warn "$f 未在 develop 分支找到"
        all_found=false
    fi
done

# --------------- Step 4: CI 验证 PR ---------------
info "Step 4: 创建 CI 验证 PR"

git checkout develop 2>/dev/null
if git show-ref --verify --quiet refs/heads/chore/verify-ci-t002; then
    git branch -D chore/verify-ci-t002
fi

git checkout -b chore/verify-ci-t002
echo -e "\n<!-- T-002 CI verification $(date -Iseconds) -->" >> CONTRIBUTING.md
git add CONTRIBUTING.md
git commit -m "chore: verify CI pipeline (T-002)"

if git push origin chore/verify-ci-t002 2>&1; then
    PR_URL=$(gh pr create \
        --repo "$FORK_FULL" \
        --base develop \
        --head chore/verify-ci-t002 \
        --title "chore: verify CI pipeline (T-002)" \
        --body "Automated verification PR for T-002 CI setup.

**Expected CI checks:**
- [ ] Lint (Go) — golangci-lint
- [ ] Lint (Frontend) — bun lint
- [ ] Test (Go) — race + coverage with PG/Redis
- [ ] Build Docker Image — multi-stage build

Close after all checks pass." 2>&1 || echo "PR creation failed")

    if echo "$PR_URL" | grep -q "http"; then
        check "验证 PR 已创建: $PR_URL"
        echo ""
        info "请在 GitHub Actions 页面检查 CI 是否全部通过"
        info "通过后运行: gh pr close --repo $FORK_FULL --delete-branch <PR_NUMBER>"
    else
        warn "PR 创建失败: $PR_URL"
    fi
else
    warn "推送 chore/verify-ci-t002 失败"
fi

git checkout develop 2>/dev/null

# --------------- Step 5: 提示手动配置 ---------------
echo ""
info "=========================================="
info " T-002 自动化步骤完成"
info "=========================================="
echo ""
warn "以下步骤需要在 GitHub 网页手动配置:"
echo ""
echo "  1. Branch Protection Rules"
echo "     → Settings → Branches → Add rule"
echo "     → main: require PR + 1 review + CI checks"
echo "     → develop: require PR + CI checks"
echo ""
echo "  2. Repository Secrets (CD 部署需要)"
echo "     → Settings → Secrets → Actions"
echo "     → STAGING_HOST / STAGING_USER / STAGING_SSH_KEY"
echo ""
echo "  3. 验证 CI (查看上面创建的 PR)"
echo "     → Actions tab → 等待 4 个 checks 全部通过"
echo ""
info "完整清单: deployments/PRJ-LITE999-T-002-deploy-checklist.md"
