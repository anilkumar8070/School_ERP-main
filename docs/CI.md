# Continuous Integration (CI) Documentation

This document describes the GitHub Actions CI pipeline architecture, workflow jobs, environment configuration, local testing procedures, and troubleshooting guidelines for the **School ERP** application.

---

## 1. Overview & Architecture

The CI pipeline runs automatically on GitHub Actions to validate every Pull Request and push to primary branches (`main`, `develop`).

```mermaid
graph TD
    A[Git Event: Push / Pull Request] --> B{GitHub Actions Workflow}
    
    subgraph backend_ci [Job: Backend CI]
        B --> C1[Spin up PostgreSQL Service Container]
        C1 --> C2[Install Dependencies - npm ci]
        C2 --> C3[Generate Prisma Client]
        C3 --> C4[Apply Migrations - prisma db push]
        C4 --> C5[Seed Database - prisma/seed.js]
        C5 --> C6[Run Jest Tests - npm test]
        C6 --> C7[Security Audit - npm audit]
        C7 --> C8[Upload Coverage Artifacts]
    end

    subgraph frontend_ci [Job: Frontend CI]
        B --> D1[Install Dependencies - npm ci]
        D1 --> D2[Code Quality - ESLint]
        D2 --> D3[Build Verification - Vite Build]
        D3 --> D4[Security Audit - npm audit]
        D4 --> D5[Upload Build Artifact]
    end
```

---

## 2. Trigger Conditions

The workflow defined in `.github/workflows/ci.yml` is triggered automatically on:

| Event | Branches | Purpose |
| ----- | -------- | ------- |
| `push` | `main`, `develop` | Validates merged code integrity on primary integration branches |
| `pull_request` | `*` (all branches) | Pre-merge verification for all incoming pull requests |

### Concurrency Policy

To save CI minutes and avoid race conditions, concurrent workflow runs on the same branch or pull request reference are automatically cancelled:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

## 3. Job Specifications

### Job 1: `backend-ci` (Backend CI)
- **Runner OS**: `ubuntu-latest`
- **Node.js Version**: `20.x` LTS
- **Timeout**: 15 minutes
- **Service Container**: `postgres:16-alpine`
  - Health check: `pg_isready -U postgres -d school_erp`
  - Port mapping: `5432:5432`
- **Execution Steps**:
  1. Checkout repository code.
  2. Setup Node.js with dependency caching for `backend/package-lock.json`.
  3. Cache Prisma binary engines (`~/.cache/prisma`).
  4. Create temporary `.env` using environment secrets (`${{ secrets.DATABASE_URL }}`, `${{ secrets.JWT_SECRET }}`).
  5. Install dependencies via `npm ci`.
  6. Generate Prisma client (`npx prisma generate`).
  7. Run schema migration (`npx prisma db push --skip-generate`).
  8. Seed database (`node prisma/seed.js`).
  9. Execute Jest unit and integration tests (`npm test -- --coverage`).
  10. Run high-severity security audit (`npm audit --omit=dev --audit-level=high`).
  11. Upload test and coverage artifacts.

### Job 2: `frontend-ci` (Frontend CI)
- **Runner OS**: `ubuntu-latest`
- **Node.js Version**: `20.x` LTS
- **Timeout**: 15 minutes
- **Execution Steps**:
  1. Checkout repository code.
  2. Setup Node.js with dependency caching for `frontend/package-lock.json`.
  3. Create temporary `.env` from `.env.example`.
  4. Install dependencies via `npm ci`.
  5. Run ESLint code quality check (`npm run lint`).
  6. Verify Vite production build (`npm run build`).
  7. Run high-severity security audit (`npm audit --omit=dev --audit-level=high`).
  8. Upload production build artifact (`frontend/dist/`).

---

## 4. Environment Variables & GitHub Secrets

Passwords, database connection strings, and JWT secrets are **never hardcoded** in the `.github/workflows/ci.yml` file. Instead, they are retrieved dynamically from **GitHub Repository Secrets**.

### How to Configure GitHub Secrets:

1. Open your repository on GitHub.
2. Go to **Settings** -> **Secrets and variables** -> **Actions** (as shown in your screenshot).
3. Under the **Secrets** tab, click **New repository secret**.
4. Add the following recommended secrets:

| Secret Name | Description / Example Value |
| ----------- | --------------------------- |
| `POSTGRES_USER` | `postgres` |
| `POSTGRES_PASSWORD` | `your_secure_db_password` |
| `POSTGRES_DB` | `school_erp` |
| `DATABASE_URL` | `postgresql://postgres:your_secure_db_password@localhost:5432/school_erp?schema=public` |
| `JWT_SECRET` | `your_super_secret_jwt_key_here` |

### How GitHub Secrets Work in `.github/workflows/ci.yml`:

```yaml
env:
  POSTGRES_USER: ${{ secrets.POSTGRES_USER || 'postgres' }}
  POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD || 'postgres' }}
  POSTGRES_DB: ${{ secrets.POSTGRES_DB || 'school_erp' }}
  DATABASE_URL: ${{ secrets.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/school_erp?schema=public' }}
  JWT_SECRET: ${{ secrets.JWT_SECRET || 'ci-dummy-jwt-secret-key-12345' }}
```

- When you add custom secrets in GitHub, GitHub Actions automatically masks their values in build logs (showing `***`).
- The `|| 'fallback'` fallback guarantees the CI pipeline runs cleanly on fresh forks and local pull requests even if repository secrets are not yet added.

---

## 5. Local Testing & Verification

You can run every step of the CI pipeline locally before pushing your code.

### Backend Verification:
```bash
cd backend
npm ci
cp .env.example .env
npx prisma generate
npx prisma db push
node prisma/seed.js
npm test
```

### Frontend Verification:
```bash
cd frontend
npm ci
cp .env.example .env
npm run lint
npm run build
```

---

## 6. How to Debug CI Failures

When a job fails in GitHub Actions:

1. **Navigate to the Failed Action**:
   - Go to the **Actions** tab in GitHub repository.
   - Click on the failed workflow run.
2. **Inspect Job Logs**:
   - Click on `Backend CI` or `Frontend CI` to expand the log steps.
   - Look for error tracebacks in red.
3. **Common Issues & Fixes**:
   - **Prisma Migration Failure**: Check if `backend/prisma/schema.prisma` has syntax errors or breaking model changes without fallback defaults.
   - **ESLint Errors**: Run `npm run lint` locally in `frontend` to reproduce and auto-fix formatting or unused variable issues.
   - **Test Failures**: Run `npm test` locally in `backend` to debug Jest test failures.
   - **Audit Failures**: Run `npm audit` to check high/critical severity security advisories.
