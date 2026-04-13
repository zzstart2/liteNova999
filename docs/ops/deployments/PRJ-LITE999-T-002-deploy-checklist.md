# 部署清单 — PRJ-LITE999-T-002 开发环境搭建与项目初始化

> **任务:** PRJ-LITE999-T-002 — Fork New-API 仓库、配置 CI/CD、建立代码规范和分支策略
> **日期:** 2026-04-10
> **状态:** 执行中 — 本地步骤已完成，远程 Fork 阻塞

---

## 一、部署范围

T-002 是**研发基础设施任务**，不涉及应用功能上线。部署内容：

| 类别 | 交付物 | 目标位置 |
|------|--------|----------|
| 仓库 | Fork QuantumNous/new-api | GitHub `zzstart2/new-api` |
| 分支策略 | main + develop + Git Flow | GitHub 仓库分支 & Protection Rules |
| CI | `ci.yml` — lint/test/build | GitHub Actions |
| CD | `cd.yml` — 镜像发布/自动部署 | GitHub Actions + GHCR + 目标服务器 |
| 代码规范 | golangci-lint / editorconfig / Conventional Commits | 仓库配置文件 |
| 贡献规范 | CONTRIBUTING.md + PR Template | 仓库文档 |
| 本地开发 | docker-compose.dev.yml + .env.dev | 开发者本地 |

### 已就绪的文件 (develop 分支, commit `9e1c34f`)

```
new-api/
├── .editorconfig                          # 编辑器格式统一
├── .env.dev                               # 本地开发环境变量
├── .golangci.yml                          # Go 静态分析 (36 rules)
├── .github/
│   ├── pull_request_template.md           # PR 检查清单模板
│   └── workflows/
│       ├── ci.yml                         # CI: Go lint → Frontend lint → Go test → Docker build
│       └── cd.yml                         # CD: tag v* → GHCR push (amd64+arm64) → Staging SSH deploy
├── docker-compose.dev.yml                 # 本地开发 (PG15 + Redis7)
└── CONTRIBUTING.md                        # 分支策略 + 提交规范 + 代码标准
```

---

## 二、部署步骤

### Step 1: Fork 仓库 ⚠️ 需手动操作

> 当前 GitHub Token (fine-grained PAT) 缺少 fork/create-repo 权限，需手动或更新 Token。

**方案 A: 手动 Fork (推荐)**

1. 浏览器打开 https://github.com/QuantumNous/new-api
2. 点击右上角 **Fork** → 选择 `zzstart2` 账号
3. 取消勾选 "Copy the `main` branch only"（保留所有分支）
4. 确认创建

**方案 B: 更新 Token 后自动执行**

给 Token 添加 `Repository → Administration → Read and Write` 权限后：
```bash
gh repo fork QuantumNous/new-api --clone=false
```

- [ ] Fork 完成，确认 `zzstart2/new-api` 可访问

### Step 2: 推送 develop 分支与配置文件

```bash
cd /root/.openclaw/workspace-ops-prjlite999/new-api

# 将 remote 指向 fork
git remote set-url origin https://github.com/zzstart2/new-api.git

# 推送 main (与上游同步) 和 develop (含 T-002 配置)
git push -u origin main
git push -u origin develop

# 验证
gh repo view zzstart2/new-api --json defaultBranchRef
```

- [ ] `main` 分支已推送
- [ ] `develop` 分支已推送（含 8 个新文件）

### Step 3: 配置 Branch Protection Rules

在 GitHub → Settings → Branches → Add rule：

**`main` 分支保护：**

| 规则 | 设置 |
|------|------|
| Require pull request before merging | ✅ |
| Required approvals | `1` |
| Require status checks to pass | ✅ |
| Required checks | `Lint (Go)`, `Test (Go)`, `Build Docker Image` |
| Require branches to be up to date | ✅ |
| Do not allow bypassing | ✅ (含管理员) |

**`develop` 分支保护：**

| 规则 | 设置 |
|------|------|
| Require pull request before merging | ✅ |
| Required approvals | `1` |
| Require status checks to pass | ✅ |
| Required checks | `Lint (Go)`, `Test (Go)` |

```bash
# 或通过 API 配置 (需 Token 有 admin 权限):
gh api repos/zzstart2/new-api/branches/main/protection \
  -X PUT -f required_status_checks='{"strict":true,"contexts":["Lint (Go)","Test (Go)","Build Docker Image"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1}'
```

- [ ] `main` 保护规则已配置
- [ ] `develop` 保护规则已配置

### Step 4: 配置 Repository Secrets

GitHub → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 用途 | 来源 |
|--------|------|------|
| *(GITHUB_TOKEN)* | GHCR 登录 | 自动提供，无需配置 |
| `STAGING_HOST` | Staging 服务器地址 | 运维提供 |
| `STAGING_USER` | Staging SSH 用户名 | 运维提供 |
| `STAGING_SSH_KEY` | Staging SSH 私钥 | `ssh-keygen -t ed25519` |

**可选 (Production 自动部署时需要):**

| Secret | 用途 |
|--------|------|
| `PROD_HOST` | 生产服务器地址 |
| `PROD_USER` | 生产 SSH 用户名 |
| `PROD_SSH_KEY` | 生产 SSH 私钥 |

- [ ] `STAGING_HOST` 已配置
- [ ] `STAGING_USER` 已配置
- [ ] `STAGING_SSH_KEY` 已配置

### Step 5: 验证 CI Pipeline

创建一个测试 PR 触发 CI：

```bash
git checkout develop
git checkout -b chore/verify-ci
echo "# CI Verification" >> CI_TEST.md
git add CI_TEST.md
git commit -m "chore: verify CI pipeline"
git push origin chore/verify-ci

# 创建 PR
gh pr create \
  --base develop \
  --head chore/verify-ci \
  --title "chore: verify CI pipeline" \
  --body "Verification PR for T-002 CI setup. Close after all checks pass."
```

等待 CI 完成后检查：

- [ ] **Lint (Go)** — golangci-lint 通过
- [ ] **Lint (Frontend)** — bun lint 通过
- [ ] **Test (Go)** — go test 通过 (含 PG/Redis service containers)
- [ ] **Build Docker Image** — docker build 成功

验证完成后关闭 PR：
```bash
gh pr close <PR_NUMBER> --delete-branch
```

### Step 6: 验证 CD Pipeline

打一个测试 tag 验证 CD (仅在 Staging Secrets 已配置后)：

```bash
git checkout main
git tag -a v0.0.1-rc.1 -m "T-002: CD pipeline verification"
git push origin v0.0.1-rc.1
```

检查 Actions 页面：

- [ ] **Build & Push Release Image** — 镜像成功推送到 GHCR
- [ ] **Deploy to Staging** — SSH 部署执行成功 (如 Secrets 已配)
- [ ] GHCR 可见 `ghcr.io/zzstart2/new-api:0.0.1-rc.1`

```bash
# 验证镜像可拉取
docker pull ghcr.io/zzstart2/new-api:0.0.1-rc.1
```

清理测试 tag：
```bash
git tag -d v0.0.1-rc.1
git push origin --delete v0.0.1-rc.1
```

### Step 7: 配置上游同步 (可选)

保持 fork 与上游同步：

```bash
# 本地添加 upstream
git remote add upstream https://github.com/QuantumNous/new-api.git

# 定期同步
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

或在 GitHub 仓库页面启用 "Sync fork" 按钮自动同步。

- [ ] upstream remote 已添加

---

## 三、部署后验证矩阵

| # | 验证项 | 方法 | 预期结果 | 通过 |
|---|--------|------|----------|------|
| 1 | Fork 仓库存在 | `gh repo view zzstart2/new-api` | 返回仓库信息 | [ ] |
| 2 | develop 分支含配置文件 | GitHub 页面检查 develop 分支 | 8 个新文件可见 | [ ] |
| 3 | main 保护规则 | Settings → Branches | 需要 PR + CI + 1 Review | [ ] |
| 4 | develop 保护规则 | Settings → Branches | 需要 PR + CI | [ ] |
| 5 | CI - Go Lint | 测试 PR 的 Actions | ✅ 通过 | [ ] |
| 6 | CI - Frontend Lint | 测试 PR 的 Actions | ✅ 通过 | [ ] |
| 7 | CI - Go Test | 测试 PR 的 Actions | ✅ 通过 (PG+Redis) | [ ] |
| 8 | CI - Docker Build | 测试 PR 的 Actions | ✅ 构建成功 | [ ] |
| 9 | CD - GHCR Push | 测试 tag 的 Actions | 镜像推送成功 | [ ] |
| 10 | CD - Staging Deploy | 测试 tag 的 Actions | SSH 部署成功 | [ ] |
| 11 | 本地开发环境 | `docker compose -f docker-compose.dev.yml up -d` | PG+Redis 启动 | [ ] |
| 12 | PR 模板 | 创建 PR 时自动加载 | 检查清单可见 | [ ] |

---

## 四、团队 Onboarding 清单

新成员入职时按此配置本地开发环境：

```bash
# 1. 克隆
git clone https://github.com/zzstart2/new-api.git
cd new-api
git checkout develop

# 2. 启动依赖服务
docker compose -f docker-compose.dev.yml up -d

# 3. 配置环境变量
cp .env.dev .env

# 4. 后端启动
go mod download
go run main.go

# 5. 前端启动
cd web
bun install
bun run dev

# 6. 访问 http://localhost:3000
```

**必读文档：**
- `CONTRIBUTING.md` — 分支命名、提交规范、PR 流程
- `.github/pull_request_template.md` — PR 检查清单

---

## 五、已知阻塞与风险

| 项目 | 状态 | 影响 | 解决方案 |
|------|------|------|----------|
| GitHub Token 权限不足 | ⚠️ 阻塞 Step 1 | 无法自动 fork | 手动 fork 或更新 Token |
| Staging Secrets 未配置 | ⚠️ 阻塞 Step 4/6 | CD 部署 job 会失败 | 运维提供服务器信息 |
| 上游 PR Check 使用 `anti-slop` | ℹ️ 信息 | 仅影响向上游提 PR | fork 可自行调整 workflow |
| Go 1.25/1.26 版本差异 | ℹ️ 低风险 | go.mod 指定 1.25，Dockerfile 用 1.26 | 兼容，无需处理 |

---

## 六、回滚方案

T-002 是基础设施任务，回滚方式按层级：

| 场景 | 操作 |
|------|------|
| CI 失败阻塞正常开发 | 临时关闭 Branch Protection 中的 status check 要求 |
| CD 发布了错误镜像 | 删除 GHCR 中的对应 tag；`docker compose` 回退到上一版本 |
| 整个 fork 有问题 | 删除 fork 重新来：Settings → Delete this repository |
| 本地开发环境问题 | `docker compose -f docker-compose.dev.yml down -v` 清理重建 |

---

## 七、执行记录 (2026-04-10)

### 已完成

| Step | 动作 | 结果 |
|------|------|------|
| 本地验证 | T-002 全部 8 个配置文件完整性检查 | ✅ 8/8 通过 |
| 本地验证 | CI workflow YAML 语法校验 (ci.yml, cd.yml) | ✅ 通过 |
| 本地验证 | .golangci.yml YAML 语法校验 | ✅ 通过 |
| Remote | upstream remote 添加 | ✅ 已添加 |
| 分支准备 | chore/verify-ci-t002 分支已创建并 commit | ✅ 就绪待推送 |
| Token 测试 | 验证 Token 可 push 到已有仓库 | ✅ 确认可用 |

### 阻塞

| Step | 动作 | 结果 | 解决方案 |
|------|------|------|----------|
| Step 1 | `gh repo fork` | ❌ 403 — Token 无 fork 权限 | **需手动 fork** |
| Step 1 | `gh repo create` | ❌ 403 — Token 无 create 权限 | 同上 |

### 解除阻塞后的一键命令

手动 fork 完成后，在本机运行：

```bash
cd /root/.openclaw/workspace-ops-prjlite999/new-api

# 1. 切换 remote 到你的 fork
git remote set-url origin https://github.com/zzstart2/new-api.git

# 2. 推送所有分支
git push -u origin main
git push -u origin develop
git push origin chore/verify-ci-t002

# 3. 创建 CI 验证 PR
gh pr create --repo zzstart2/new-api \
  --base develop --head chore/verify-ci-t002 \
  --title "chore: verify CI pipeline (T-002)" \
  --body "Automated verification. Close after all checks pass."
```

---

*清单编制: ops-prjlite999 | 日期: 2026-04-10*
