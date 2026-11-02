# Contributing to DocSage

Thank you for contributing to DocSage. This project enforces strict FAANG-grade software engineering standards.

## Code Standards

- **Language**: TypeScript strict mode across all workspaces. No `any`, no unchecked casts.
- **Validation**: All external inputs (HTTP bodies, query params, headers, env vars, worker jobs) must be validated with Zod.
- **Testing**: Unit and integration tests are required for all logic. The repository enforces an 80% coverage threshold.
- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `ci:`, `chore:`.

## Local Development Workflow

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start local infrastructure:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
3. Run verification before committing:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
