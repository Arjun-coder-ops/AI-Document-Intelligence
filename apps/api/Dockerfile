# Multi-stage production build for DocSage API
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package manifests across monorepo workspaces
COPY package*.json tsconfig.base.json tsconfig.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/db/package*.json ./packages/db/
COPY packages/rag/package*.json ./packages/rag/
COPY apps/api/package*.json ./apps/api/
COPY apps/worker/package*.json ./apps/worker/
COPY apps/web/package*.json ./apps/web/
COPY evals/package*.json ./evals/

# Install all dependencies with frozen lockfile
RUN npm ci

# Copy source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build shared packages and API application
RUN npm run build --workspace=@docsage/shared && \
    npm run build --workspace=@docsage/db && \
    npm run build --workspace=@docsage/rag && \
    npm run build --workspace=@docsage/api

# Prune devDependencies for lean production image
RUN npm prune --omit=dev

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install runtime utilities for container healthchecks
RUN apk add --no-cache curl

# Copy runtime node_modules and compiled distributions
COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=node:node --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --chown=node:node --from=builder /app/packages/db/dist ./packages/db/dist
COPY --chown=node:node --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --chown=node:node --from=builder /app/packages/rag/dist ./packages/rag/dist
COPY --chown=node:node --from=builder /app/packages/rag/package.json ./packages/rag/package.json
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=5s \
  CMD curl -f http://localhost:3000/health/live || exit 1

CMD ["node", "apps/api/dist/index.js"]
