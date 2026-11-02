# Multi-stage production build for DocSage Web (React + Vite)
FROM node:20-alpine AS builder

WORKDIR /app

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
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

# Build shared packages and Web frontend
RUN npm run build --workspace=@docsage/shared && \
    npm run build --workspace=@docsage/web

# Production static file serving with Nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Expose standard web port
EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
