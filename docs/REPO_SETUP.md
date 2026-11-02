# Repository Setup, Branch Protection & Secrets Configuration

This guide details the exact configurations required to enforce FAANG-hiring-committee-grade CI/CD and deployment standards for the **DocSage** repository.

---

## 1. Branch Protection Rules

Configure GitHub branch protection on the `main` branch (**Settings -> Branches -> Add branch ruleset** or **Branch protection rule**):

1. **Branch pattern:** `main`
2. **Require a pull request before merging:**
   - Require approvals: `1`
   - Dismiss stale pull request approvals when new commits are pushed: `Checked`
   - Require review from Code Owners: `Checked` (enforces `.github/CODEOWNERS`)
3. **Require status checks to pass before merging:**
   - Require branches to be up to date before merging: `Checked`
   - **Required Status Checks:**
     - `Code Quality (Lint, Typecheck, Prettier)` (`quality`)
     - `Unit & Integration Tests (PostgreSQL + pgvector)` (`test`)
     - `Retrieval Eval & Regression Guard` (`retrieval-eval`)
     - `Security Audits & Secret Scanning` (`security`)
     - `Build Monorepo & Container Images` (`build`)
     - `Playwright E2E Integration` (`e2e`)
4. **Require conversation resolution before merging:** `Checked`
5. **Require signed commits:** Recommended
6. **Do not allow bypassing the above settings:** `Checked` (including administrators)

---

## 2. GitHub Secrets & Variables

Navigate to **Settings -> Secrets and variables -> Actions** and configure the following parameters:

### Secrets (`Repository Secrets` or `Environment: production`)

| Secret Name                 | Required By                 | Description                                                         | Example / Format                                                    |
| :-------------------------- | :-------------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------ |
| `DATABASE_URL`              | CI (`test`), Apps           | Neon pooled connection string                                       | `postgresql://user:pass@ep-pooler.neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_DIRECT`       | CI (`test`), CD (`migrate`) | Neon direct connection string (session-mode for Drizzle migrations) | `postgresql://user:pass@ep-direct.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET`                | Apps, CI, CD                | Minimum 32-character HMAC secret for access token signing           | `b8e7...64-char-hex-or-base64...`                                   |
| `REFRESH_SECRET`            | Apps, CI, CD                | Minimum 32-character secret for rotating refresh token hashing      | `a1d4...64-char-hex-or-base64...`                                   |
| `GROQ_API_KEY`              | Apps, Nightly Eval          | Primary LLM inference API key                                       | `gsk_...`                                                           |
| `OPENAI_API_KEY`            | Apps, Nightly Eval          | Secondary fallback LLM inference key                                | `sk-...`                                                            |
| `COHERE_API_KEY`            | Apps, Nightly Eval          | Cohere Reranker API key                                             | `...`                                                               |
| `NEON_API_KEY`              | Neon Preview Workflow       | Neon platform API key for ephemeral branching                       | `nkey_...`                                                          |
| `NEON_PROJECT_ID`           | Neon Preview Workflow       | Neon project identifier                                             | `ep-sparkling-water-123456`                                         |
| `RENDER_API_DEPLOY_HOOK`    | CD (`deploy-backend`)       | Render deploy hook URL for `docsage-api` service                    | `https://api.render.com/deploy/srv-xxx?key=yyy`                     |
| `RENDER_WORKER_DEPLOY_HOOK` | CD (`deploy-backend`)       | Render deploy hook URL for `docsage-worker` service                 | `https://api.render.com/deploy/srv-aaa?key=bbb`                     |
| `VERCEL_TOKEN`              | CD (`deploy-frontend`)      | Vercel Personal Access Token for deployments                        | `...`                                                               |
| `VERCEL_ORG_ID`             | CD (`deploy-frontend`)      | Vercel team/org identifier                                          | `team_...`                                                          |
| `VERCEL_PROJECT_ID`         | CD (`deploy-frontend`)      | Vercel project identifier                                           | `prj_...`                                                           |
| `PRODUCTION_API_URL`        | CD (`smoke-test`)           | Public HTTPS endpoint of deployed production API                    | `https://api.docsage.io`                                            |

### Variables (`Repository Variables`)

| Variable Name               | Default Value | Description                                                         |
| :-------------------------- | :------------ | :------------------------------------------------------------------ |
| `EMBEDDING_DIM`             | `384`         | Target vector dimension asserted against database column on startup |
| `HNSW_EF_SEARCH`            | `40`          | Default HNSW search graph exploration parameter                     |
| `RATE_LIMIT_USER_PER_MIN`   | `20`          | Token bucket capacity per authenticated user                        |
| `RATE_LIMIT_TENANT_PER_MIN` | `100`         | Token bucket capacity per tenant workspace                          |

---

## 3. Ephemeral Neon Branching Verification

When a Pull Request is opened:

1. `neon-preview.yml` intercepts the event and executes `neondatabase/create-branch-action`.
2. A branch named `preview/pr-<PR_NUMBER>` is instantiated instantaneously with copy-on-write storage.
3. Drizzle migrations execute against the branch's dedicated direct connection string.
4. When the PR is merged or closed, `neondatabase/delete-branch-action` automatically destroys the isolated branch, incurring zero idle database cost.

---

## 4. Regression Blocker Demonstration

To verify that the CI regression blocker operates correctly:

1. Introduce a deliberately worsened chunking overlap or disable reranking in `evals/configs/`.
2. Push a branch and open a PR.
3. `retrieval-eval` runs the deterministic offline test against `evals/thresholds.json`.
4. The job exits with code `1`, blocking merge until the regression is remedied.
