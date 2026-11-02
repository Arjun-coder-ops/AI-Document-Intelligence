# Multi-stage production build for DocSage Worker
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
COPY apps/worker/ ./apps/worker/

# Build shared packages and Worker application
RUN npm run build --workspace=@docsage/shared && \
    npm run build --workspace=@docsage/db && \
    npm run build --workspace=@docsage/rag && \
    npm run build --workspace=@docsage/worker

# Prune devDependencies for lean production image
RUN npm prune --omit=dev

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy runtime node_modules and compiled distributions
COPY --chown=node:node package*.json ./
COPY --chown=node:node node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=node:node --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --chown=node:node --from=builder /app/packages/db/dist ./packages/db/dist
COPY --chown=node:node --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --chown=node:node --from=builder /app/packages/rag/dist ./packages/rag/dist
COPY --chown=node:node --from=builder /app/packages/rag/package.json ./packages/rag/package.json
COPY --chown=node:node --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --chown=node:node --from=builder /app/apps/worker/package.json ./apps/worker/package.json

USER node

CMD ["node", "apps/worker/dist/index.js"]
