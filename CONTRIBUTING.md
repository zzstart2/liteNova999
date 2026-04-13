# Contributing Guide

## Branch Strategy (Git Flow)

```
main          ← production-ready, protected
  └── develop ← integration branch, CI must pass
        ├── feature/xxx   ← new features
        ├── fix/xxx       ← bug fixes
        └── chore/xxx     ← maintenance, docs, CI
release/x.y.z ← release candidates from develop → merge to main + develop
hotfix/xxx    ← urgent fixes from main → merge to main + develop
```

### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<short-desc>` | `feature/add-gemini-adapter` |
| Bug fix | `fix/<short-desc>` | `fix/token-counting-overflow` |
| Chore | `chore/<short-desc>` | `chore/update-ci-go-version` |
| Release | `release/<version>` | `release/1.2.0` |
| Hotfix | `hotfix/<short-desc>` | `hotfix/critical-auth-bypass` |

### Rules

1. **Never push directly to `main` or `develop`** — always use Pull Requests
2. **All PRs require CI pass** + at least 1 review approval
3. **Squash merge** for feature/fix branches → keeps history clean
4. **Merge commit** for release/hotfix branches → preserves release history

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, no logic change) |
| `refactor` | Code refactor (no new feature, no fix) |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build, CI, tooling |

### Examples

```
feat(relay): add Claude 4 model support
fix(billing): correct token counting for streaming responses
chore(ci): add golangci-lint to PR checks
docs: update deployment guide for Docker Compose v2
```

## Code Standards

### Go (Backend)

- Follow standard Go conventions (`gofmt`, `goimports`)
- Run `golangci-lint run` before committing
- Write tests for new logic — aim for >70% coverage on new code
- Use structured logging via the project's `logger` package
- Error messages: lowercase, no trailing punctuation

### JavaScript/React (Frontend)

- Use ESLint config from the project
- Prefer functional components with hooks
- Use TypeScript types where applicable

## Pull Request Checklist

- [ ] Branch follows naming convention
- [ ] Commits follow conventional commits format
- [ ] CI passes (lint + test + build)
- [ ] New code has tests
- [ ] No secrets or credentials committed
- [ ] Changelog updated (for features/fixes)

## Development Setup

```bash
# Backend
go mod download
go run main.go

# Frontend
cd web
bun install
bun run dev

# Full stack via Docker
docker compose up -d
```
