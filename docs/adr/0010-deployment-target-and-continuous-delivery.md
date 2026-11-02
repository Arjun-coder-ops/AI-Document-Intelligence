# ADR 0010: Deployment Target and Continuous Delivery Architecture

## Status

Accepted

## Context

DocSage consists of three distinct workloads:

1. `apps/api`: Express 5 HTTP/SSE server requiring low connection overhead, persistent pooled database connections, and long-lived streaming connections.
2. `apps/worker`: Continuous background worker polling `pg-boss` queues, executing CPU/memory-intensive PDF parsing and embedding generation.
3. `apps/web`: React 18 single-page application requiring global edge caching, fast initial load, and automated preview deployments.
4. Database & Storage: Serverless PostgreSQL with `pgvector` on Neon.

We required a deployment strategy that minimizes operational overhead, supports zero-downtime rolling updates, guarantees strict fail-closed database migration execution before code deployment, and remains fully transparent and explainable to hiring committees.

## Options Considered

1. **Option 1: Self-Managed Kubernetes (EKS / GKE)**
   - _Pros:_ Ultimate flexibility, granular autoscaling, local container parity.
   - _Cons:_ Significant operational burden (Ingress controllers, Cert-Manager, IAM roles for service accounts, node pool management) disproportionate to current engineering scale; high baseline idle cloud cost ($150+/mo).

2. **Option 2: Single Monolithic Virtual Machine (AWS EC2 / DigitalOcean Droplet)**
   - _Pros:_ Simple architecture, low initial setup complexity.
   - _Cons:_ Single point of failure; manual OS patching; lacks automated preview deployments; difficult to isolate resource exhaustion between heavy PDF parsing and latency-sensitive streaming chat.

3. **Option 3: Decoupled Multi-Host PaaS (Render / Fly.io for Containers + Vercel for Web + Neon for Postgres) [Chosen]**
   - _Pros:_
     - Independent scaling of HTTP API and background worker processes.
     - Vercel provides world-class Edge CDN distribution and instantaneous preview builds.
     - Render/Fly.io supports native Docker container deployment from GitHub Container Registry (GHCR) with automated zero-downtime health-checked deployments.
     - Ephemeral Neon database branching integrates natively with GitHub Actions to provide copy-on-write preview databases per PR.
   - _Cons:_ Multi-vendor configuration; requires managing deployment tokens and webhooks across providers.

## Decision

We adopted **Option 3: Decoupled Containerized Services on Render/Fly.io with Vercel Edge Hosting and Neon Postgres**.

### Continuous Delivery Pipeline Flow:

1. **Migrations First (Fail-Closed):** The CD pipeline (`.github/workflows/cd.yml`) connects directly to Neon using the direct session endpoint (`DATABASE_URL_DIRECT`) and applies Drizzle migrations. If migration or validation fails, the deployment halts immediately, preventing code rollout.
2. **Container Registry Push:** API and Worker containers are built via Docker Buildx and pushed to GitHub Container Registry (`ghcr.io/org/api:sha`, `ghcr.io/org/worker:sha`).
3. **Rolling Service Deployment:** Webhook deploy triggers notify Render to pull the newly built image and execute a rolling zero-downtime restart.
4. **Edge Frontend Deployment:** Vercel deploys the compiled React bundle with global asset distribution.
5. **Canary Verification:** Post-deployment smoke probes ping `/health/ready` and execute a canary request against the live production endpoint. If readiness fails, the workflow alerts engineering.

## Trade-offs & Consequences

- **Positive:**
  - Zero server management overhead.
  - Strict isolation: Heavy PDF parsing in `apps/worker` cannot starve CPU or memory from user-facing SSE chat streams in `apps/api`.
  - Preview database parity: Every pull request receives an isolated Neon branch running exact schema migrations without touching production data.
- **Negative:**
  - Multi-provider secret management requires storing API tokens for Neon, Render/Fly.io, and Vercel in GitHub Secrets.
