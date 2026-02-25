# V Sync

A full-stack workflow automation platform. Build, run, and automate workflows across cloud, desktop, and mobile.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Local Setup (Full Stack)](#local-setup-full-stack)
- [Repository Structure](#repository-structure)
- [Packages](#packages)
- [Apps](#apps)
- [Development](#development)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Testing](#testing)
- [Building](#building)
- [Deployment](#deployment)
- [CI/CD Pipelines](#cicd-pipelines)
- [Git Workflow](#git-workflow)
- [Code Conventions](#code-conventions)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | >= 22 | [nodejs.org](https://nodejs.org) or `nvm install 22` |
| **pnpm** | 9.15.9 (exact) | `corepack enable && corepack prepare pnpm@9.15.9 --activate` |
| **Git** | any recent | [git-scm.com](https://git-scm.com) |

**Optional** (needed for specific workflows):

| Tool | Purpose | Install |
|------|---------|---------|
| Docker | Local API container testing | [docker.com](https://www.docker.com) |
| Fly CLI | API deployment | `brew install flyctl` or [fly.io/docs](https://fly.io/docs/flyctl/install/) |
| Vercel CLI | Web deployment | `npm i -g vercel` |
| EAS CLI | Mobile builds | `npm i -g eas-cli` |
| Expo CLI | Mobile dev | `npm i -g expo-cli` |

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/vsync/vsync-workflow.git
cd vsync-workflow

# 2. Install dependencies
pnpm install

# 3. Set up environment (uses defaults that work out of the box)
cp .env .env.local   # optional — .env ships with working defaults

# 4. Build all packages (required before first run)
pnpm build

# 5. Start everything in dev mode
pnpm dev
```

This starts:
- **API server** at `http://localhost:3001` (Hono + PGlite in-memory DB)
- **Web app** at `http://localhost:3000` (Next.js 15)

No external database required for local development — the API uses PGlite (in-memory PostgreSQL) when `DATABASE_URL` is not set.

---

## Local Setup (Full Stack)

This section walks through getting **every** service running on your machine — API, web, desktop, mobile, database, and tests — from a completely fresh clone.

### 1. System Prerequisites

Before anything else, make sure these are installed:

```bash
# Check Node.js (must be >= 22)
node -v
# v22.x.x

# Enable corepack (ships with Node.js) and activate pnpm
corepack enable
corepack prepare pnpm@9.15.9 --activate

# Verify pnpm
pnpm -v
# 9.15.9
```

**For mobile development (optional):**

| Tool | Platform | Install |
|------|----------|---------|
| Xcode | macOS | Mac App Store |
| Xcode Command Line Tools | macOS | `xcode-select --install` |
| CocoaPods | iOS | `sudo gem install cocoapods` |
| Android Studio | Android | [developer.android.com](https://developer.android.com/studio) |
| JDK 17 | Android | Bundled with Android Studio |
| Watchman | macOS | `brew install watchman` |
| EAS CLI | Builds | `npm i -g eas-cli` |

**For desktop development (optional):**

No additional system dependencies — Electron is installed as a dev dependency.

### 2. Clone and Install

```bash
git clone https://github.com/vsync/vsync-workflow.git
cd vsync-workflow

# Install all workspace dependencies (packages, apps, tooling)
pnpm install
```

This installs dependencies for all 11 packages, 3 apps, and root dev tooling in one go.

### 3. Environment Setup

The repo ships with a `.env` file that has working defaults for local development:

```bash
# (Optional) Create a local override file if you want to customize anything
cp .env .env.local
```

**Out-of-the-box defaults** (no changes needed to get started):

| Variable | Default | Notes |
|----------|---------|-------|
| `AUTH_SECRET` | `vsync-local-dev-secret-...` | Token signing key (change in production) |
| `APP_URL` | `http://localhost:3000` | Web app origin |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API URL (used by browser fetch calls) |
| `CORS_ORIGINS` | `http://localhost:3000` | CORS allowed origins |
| `DATABASE_URL` | *(unset)* | Leave unset for PGlite (zero-config in-memory DB) |
| `GOOGLE_CLIENT_ID` | *(blank)* | Leave blank — social login is disabled locally |
| `MS_CLIENT_ID` | *(blank)* | Leave blank — social login is disabled locally |
| `RESEND_API_KEY` | *(blank)* | Leave blank — emails are skipped locally |

### 4. Initial Build

**This step is required before first run.** Turborepo builds all 11 packages in dependency order:

```bash
pnpm build
```

Expected output: all tasks should pass (look for `Tasks: N/N successful`). The build produces `dist/` folders in every package and `.next/` in the web app.

### 5. Running API + Web (Core Development)

```bash
pnpm dev
```

This starts both services concurrently via Turborepo:

| Service | URL | What it does |
|---------|-----|-------------|
| **API server** | `http://localhost:3001` | Hono REST API + WebSocket. Uses PGlite (in-memory PostgreSQL) — auto-creates all 19 tables on startup |
| **Web app** | `http://localhost:3000` | Next.js 15 with hot reload |

**Verify everything works:**

```bash
# In a separate terminal — check API health
curl http://localhost:3001/api/v1/health
# → {"status":"ok"}

# Open web app
open http://localhost:3000
```

You can now sign up with any email/password (no email verification in local dev), create an organization, and start building workflows.

### 6. Running the Desktop App

The desktop app runs an embedded Electron + SQLite environment:

```bash
# Make sure all workspace packages are built first
pnpm build

# Start Electron in dev mode (watches for changes and hot-reloads)
pnpm --filter @vsync/desktop dev
```

This runs `tsup --watch` (TypeScript bundler) and `electron .` concurrently. The desktop app opens automatically.

### 7. Running the Mobile App

**Prerequisites:** Xcode (iOS) or Android Studio (Android) must be installed.

```bash
# Start the Expo dev server
pnpm --filter @vsync/mobile start
```

Then press:
- `i` to open in iOS Simulator
- `a` to open in Android Emulator
- Scan the QR code with Expo Go on a physical device

**Or launch directly:**

```bash
# iOS
pnpm --filter @vsync/mobile ios

# Android
pnpm --filter @vsync/mobile android
```

> **Note:** The mobile app connects to the API at `localhost:3001` by default. On a physical device, replace `localhost` with your machine's LAN IP in the app config.

### 8. Using PostgreSQL Instead of PGlite

PGlite (in-memory) is perfect for quick local dev, but data is lost on restart. To persist data with real PostgreSQL:

```bash
# Option A: Docker (quickest)
docker run -d \
  --name vsync-pg \
  -p 5432:5432 \
  -e POSTGRES_USER=vsync \
  -e POSTGRES_PASSWORD=vsync \
  -e POSTGRES_DB=vsync \
  postgres:16

# Option B: Use an existing PostgreSQL instance
# Just set the connection string below

# Set the connection string
export DATABASE_URL="postgresql://vsync:vsync@localhost:5432/vsync"

# Run database migrations (creates all tables)
pnpm --filter @vsync/db db:migrate

# Seed starter templates (6 public workflows)
pnpm --filter @vsync/db db:seed

# Now start the dev servers — API will use PostgreSQL instead of PGlite
pnpm dev
```

### 9. Running All E2E Tests

E2E tests use Playwright with real servers (API + Web):

```bash
# Step 1: Build everything (Playwright needs production builds)
pnpm build

# Step 2: Install browser engines (first time only)
pnpm exec playwright install --with-deps

# Step 3: Run the full test suite
pnpm test:e2e
```

Playwright automatically:
- Starts the API server on port 3001 (PGlite in-memory, `E2E=true` skips email verification)
- Starts the Next.js web server on port 3000
- Creates a test user and saves auth state to `e2e/.auth/user.json`
- Runs all test specs sequentially across Chromium, Firefox, and WebKit

**Useful Playwright commands:**

```bash
# Run with interactive UI
pnpm exec playwright test --ui

# Run a specific test file
pnpm exec playwright test e2e/tests/workflows.spec.ts

# Run only on Chromium (faster)
pnpm exec playwright test --project=chromium

# View the HTML report after a run
pnpm exec playwright show-report e2e/playwright-report
```

### 10. Running Unit Tests

```bash
# All packages
pnpm test

# Single package
pnpm test --filter=@vsync/engine

# Watch mode (during development)
pnpm exec vitest --watch
```

### 11. Port Summary

| Port | Service | Notes |
|------|---------|-------|
| `3000` | Next.js web app | Dev server (hot reload) or production build |
| `3001` | Hono API server | REST + WebSocket |
| `5432` | PostgreSQL | Only if using real Postgres (not PGlite) |
| `8081` | Expo dev server | Metro bundler for mobile |
| `19000` | Expo Go | Dev client connection |

Make sure these ports are free before starting. To kill a stale process on a port:

```bash
lsof -ti:3001 | xargs kill -9   # Example: kill process on port 3001
```

### 12. Full Stack Cheat Sheet

```bash
# ── From zero to running (first time) ──
git clone https://github.com/vsync/vsync-workflow.git
cd vsync-workflow
corepack enable && corepack prepare pnpm@9.15.9 --activate
pnpm install
pnpm build
pnpm dev                    # API (3001) + Web (3000)

# ── Daily development ──
pnpm dev                    # Start everything
pnpm typecheck              # Check types across monorepo
pnpm lint                   # Lint all packages
pnpm test                   # Run all unit tests

# ── Desktop ──
pnpm build
pnpm --filter @vsync/desktop dev

# ── Mobile ──
pnpm --filter @vsync/mobile start
# Press 'i' for iOS, 'a' for Android

# ── Database (with real PostgreSQL) ──
export DATABASE_URL="postgresql://vsync:vsync@localhost:5432/vsync"
pnpm --filter @vsync/db db:migrate
pnpm --filter @vsync/db db:seed
pnpm dev

# ── E2E tests ──
pnpm build
pnpm exec playwright install --with-deps  # first time only
pnpm test:e2e

# ── Clean start (nuclear option) ──
pnpm clean                  # Remove all dist/, .next/, node_modules
pnpm install
pnpm build
pnpm dev
```

---

## Repository Structure

```
vsync-workflow/
├── apps/                          # Deployable applications
│   ├── web/                       #   Next.js 15 web app (port 3000)
│   ├── desktop/                   #   Electron desktop app
│   └── mobile/                    #   Expo / React Native mobile app
│
├── packages/                      # Shared libraries
│   ├── shared-types/              #   TypeScript types & interfaces
│   ├── config/                    #   Configuration management
│   ├── blocks/                    #   Workflow block schemas & validation
│   ├── db/                        #   Database layer (Drizzle ORM)
│   ├── auth/                      #   Authentication (better-auth)
│   ├── engine/                    #   Workflow execution engine
│   ├── engine-adapters/           #   Platform adapters (Node, mobile)
│   ├── key-manager/               #   Encryption & key management
│   ├── designer/                  #   AI-powered workflow designer
│   ├── ui/                        #   React component library
│   └── api/                       #   Backend API server (Hono)
│
├── tooling/                       # Shared dev configs
│   ├── typescript/                #   Base tsconfig
│   ├── eslint/                    #   ESLint config
│   └── vitest/                    #   Vitest config
│
├── e2e/                           # Playwright end-to-end tests
│   ├── playwright.config.ts
│   ├── tests/                     #   Test specs
│   ├── fixtures/                  #   Test data
│   └── setup/                     #   Auth setup & teardown
│
├── .github/workflows/             # CI/CD pipelines
│   ├── ci.yml                     #   PR validation
│   ├── deploy-api.yml             #   API → Fly.io
│   ├── deploy-web.yml             #   Web → Vercel
│   ├── build-desktop.yml          #   Desktop → GitHub Releases
│   └── build-mobile.yml           #   Mobile → App Store / Play Store
│
├── Dockerfile                     # API container (multi-stage)
├── fly.toml                       # Fly.io deployment config
├── turbo.json                     # Turborepo task pipeline
├── pnpm-workspace.yaml            # pnpm workspace definition
├── CLAUDE.md                      # AI assistant guidelines
└── .env                           # Local dev environment
```

---

## Packages

Each package is self-contained with its own `package.json`, `tsconfig.json`, and build output in `dist/`.

### Core

| Package | Alias | Purpose |
|---------|-------|---------|
| `packages/shared-types` | `@vsync/shared-types` | TypeScript type definitions shared across the entire monorepo |
| `packages/config` | `@vsync/config` | Runtime configuration with environment-aware defaults |
| `packages/blocks` | `@vsync/blocks` | Block type schemas, validation, and default values for all 21 block types |

### Data

| Package | Alias | Purpose |
|---------|-------|---------|
| `packages/db` | `@vsync/db` | Drizzle ORM layer with PostgreSQL, PGlite, and SQLite support. Contains schema, migrations, repositories, and seed scripts |
| `packages/auth` | `@vsync/auth` | Authentication via better-auth. Email/password, OAuth (Google, Microsoft), SSO |
| `packages/key-manager` | `@vsync/key-manager` | Cryptographic key management with AES-256-GCM encryption via @noble/ciphers |

### Runtime

| Package | Alias | Purpose |
|---------|-------|---------|
| `packages/engine` | `@vsync/engine` | Workflow execution engine. Interprets block graphs sequentially with conditions, loops, and state management |
| `packages/engine-adapters` | `@vsync/engine-adapters` | Platform-specific adapters: Node.js (image processing via sharp, FTP), mobile (camera, location) |
| `packages/api` | `@vsync/api` | Hono REST API server (port 3001). Routes, middleware, WebSocket support, health endpoint |

### Frontend

| Package | Alias | Purpose |
|---------|-------|---------|
| `packages/ui` | `@vsync/ui` | React component library built on Radix UI, Tailwind CSS 4, XYFlow, and Tanstack Table |
| `packages/designer` | `@vsync/designer` | AI workflow designer using Anthropic Claude and OpenAI. Converts natural language into valid block configurations |

### Dependency Graph

```
shared-types ─── config ─── blocks
     │              │          │
     └──── db ──────┘     engine
           │                 │
          auth        engine-adapters
           │
          api ──── key-manager
           │
          designer ── ui
```

---

## Apps

### Web (`apps/web`)

Next.js 15 with App Router, React 19, and Tailwind CSS.

```bash
pnpm --filter @vsync/web dev       # Dev server on port 3000
pnpm --filter @vsync/web build     # Production build
pnpm --filter @vsync/web start     # Start production server
```

**Key routes:**
- `/dashboard` — Overview with stats and recent runs
- `/workflows` — List, create, and manage workflows
- `/workflows/[id]` — Visual workflow builder with AI assistant
- `/runs` — Execution history with live WebSocket updates
- `/devices` — Registered device management
- `/templates` — Public starter templates
- `/settings` — Organization management (members, auth, keys, billing)
- `/onboarding` — First-run wizard

### Desktop (`apps/desktop`)

Electron app with local SQLite database and auto-updates via GitHub Releases.

```bash
pnpm --filter @vsync/desktop dev         # Dev mode (watch + Electron)
pnpm --filter @vsync/desktop build:mac   # macOS (DMG + ZIP, x64 + arm64)
pnpm --filter @vsync/desktop build:win   # Windows (NSIS installer)
pnpm --filter @vsync/desktop build:linux # Linux (AppImage + DEB)
```

### Mobile (`apps/mobile`)

Expo / React Native app with camera, barcode scanning, and location support.

```bash
pnpm --filter @vsync/mobile start        # Expo dev server
pnpm --filter @vsync/mobile ios          # iOS simulator
pnpm --filter @vsync/mobile android      # Android emulator
```

**EAS Build profiles** (`apps/mobile/eas.json`):

| Profile | API URL | Distribution |
|---------|---------|-------------|
| `development` | localhost:3001 | Internal (simulator/APK) |
| `preview` | staging API | Internal (release builds) |
| `production` | production API | App Store / Play Store |

---

## Development

### Daily Workflow

```bash
# Start dev servers (API + Web + packages in watch mode)
pnpm dev

# Type-check the entire monorepo
pnpm typecheck

# Lint all packages
pnpm lint

# Run unit tests
pnpm test

# Run E2E tests (requires built packages)
pnpm build && pnpm test:e2e
```

### Working on a Single Package

Turborepo automatically builds dependencies. To focus on one package:

```bash
# Build only the web app (and its deps)
pnpm build --filter=@vsync/web

# Run tests for a single package
pnpm test --filter=@vsync/engine

# Dev mode for a single package
pnpm dev --filter=@vsync/api
```

### Turborepo Task Pipeline

The build system uses Turborepo to manage dependencies between tasks:

| Task | Depends On | Cache |
|------|-----------|-------|
| `build` | `^build` (all transitive deps) | Yes |
| `typecheck` | `^build` | Yes |
| `test` | `build` | Yes |
| `lint` | — | Yes |
| `dev` | `^build` | No (persistent) |

The `^` prefix means "build dependencies first". Running `pnpm build --filter=@vsync/web` automatically builds `shared-types`, `config`, `blocks`, `db`, `auth`, `designer`, and `ui` in the correct order.

---

## Environment Variables

Copy the `.env` file (already ships with working defaults for local development):

```bash
cp .env .env.local  # optional
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `AUTH_SECRET` | `vsync-local-dev-secret-...` | JWT/session signing key |
| `APP_URL` | `http://localhost:3000` | Frontend origin |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API URL (used by browser) |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |
| `PORT` | `3001` | API server port |
| `DATABASE_URL` | *(unset)* | PostgreSQL connection string. Omit for PGlite (in-memory) |
| `GOOGLE_CLIENT_ID` | *(unset)* | Google OAuth (optional) |
| `GOOGLE_CLIENT_SECRET` | *(unset)* | Google OAuth (optional) |
| `MS_CLIENT_ID` | *(unset)* | Microsoft OAuth (optional) |
| `MS_CLIENT_SECRET` | *(unset)* | Microsoft OAuth (optional) |
| `RESEND_API_KEY` | *(unset)* | Resend email service (optional, emails skip without it) |
| `E2E` | *(unset)* | Set to `"true"` to disable email verification in E2E tests |

**Production-only** (set via `fly secrets set` or hosting dashboard):

`DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_MASTER_KEY`, `GOOGLE_CLIENT_*`, `MS_CLIENT_*`, `RESEND_API_KEY`, `S3_*`

---

## Database

### Local Development (PGlite)

No setup required. When `DATABASE_URL` is unset, the API server starts an in-memory PGlite instance that auto-migrates on boot.

### PostgreSQL (Production)

```bash
# Set connection string
export DATABASE_URL="postgresql://user:pass@host:5432/vsync"

# Run pending migrations
pnpm --filter @vsync/db db:migrate

# Seed starter templates
pnpm --filter @vsync/db db:seed

# Generate new migration after schema changes
pnpm --filter @vsync/db db:generate
```

### Schema Overview

| Table | Purpose |
|-------|---------|
| `users`, `sessions`, `accounts` | Authentication (managed by better-auth) |
| `organizations`, `org_members` | Multi-tenant org management |
| `workflows` | Workflow definitions with public sharing fields |
| `workflow_versions` | Immutable version snapshots |
| `blocks` | Executable blocks within a version |
| `secrets` | Encrypted key-value pairs per workflow |
| `runs`, `artifacts` | Execution history and outputs |
| `devices` | Registered execution devices |
| `keys`, `key_audit_log` | Cryptographic key lifecycle |
| `chats`, `messages` | AI assistant conversation history |
| `cache` | General-purpose cache entries |

### SQLite (Desktop)

The desktop app uses a local SQLite database with a mirrored schema (`packages/db/src/schema/sqlite.ts`). A sync queue table enables offline-first operation with later cloud sync.

---

## Testing

### Unit Tests (Vitest)

```bash
pnpm test                           # All packages
pnpm test --filter=@vsync/engine    # Single package
```

- Test files: `**/*.test.ts`
- Coverage provider: v8
- Coverage threshold: 70% (statements, branches, functions, lines)
- **No mocks** — use `throw new Error("Not implemented")` instead

### E2E Tests (Playwright)

```bash
# Must build first
pnpm build

# Run E2E tests
pnpm test:e2e

# Run with UI
pnpm exec playwright test --ui

# Run a specific test file
pnpm exec playwright test e2e/tests/workflows.spec.ts
```

**E2E architecture:**
- Spins up a real API server (PGlite in-memory, `E2E=true` bypasses email verification)
- Spins up a real Next.js web server
- Tests run sequentially (shared database state)
- 3 browser engines: Chromium, Firefox, WebKit
- Auth setup creates a test user and saves session state to `e2e/.auth/user.json`

**Test suites:**

| File | Coverage |
|------|----------|
| `auth.spec.ts` | Login, signup, session persistence |
| `workflows.spec.ts` | CRUD, search, navigation |
| `workflow-builder.spec.ts` | Toolbar, canvas, AI panel, save |
| `runs.spec.ts` | Run list, filters, WebSocket updates |
| `settings.spec.ts` | Tabs, org editing, member invites |

### Installing Browsers

```bash
pnpm exec playwright install --with-deps
```

---

## Building

### Full Monorepo Build

```bash
pnpm build    # Builds all 11 packages + 1 web app via Turborepo
```

### Docker (API Only)

```bash
# Build the container
docker build -t vsync-api .

# Run locally
docker run -p 3001:3001 \
  -e AUTH_SECRET=your-secret \
  -e DATABASE_URL=postgresql://... \
  vsync-api

# Verify
curl http://localhost:3001/api/v1/health
```

The Dockerfile uses a multi-stage build:
1. **Builder stage**: Installs all deps, builds with Turbo, prunes to production deps via `pnpm deploy`
2. **Runner stage**: Minimal Alpine image with `dumb-init` for proper signal handling

### Clean Build

```bash
pnpm clean    # Removes all dist/, .next/, node_modules
pnpm install  # Reinstall
pnpm build    # Fresh build
```

---

## Deployment

### API (Fly.io)

| Environment | Trigger | URL |
|-------------|---------|-----|
| Staging | Push to `main` | `https://vsync-api-staging.fly.dev` |
| Production | Push tag `v*` | `https://vsync-api.fly.dev` |

Deployments build a Docker image, push to GitHub Container Registry (`ghcr.io`), and deploy to Fly.io. Migrations run automatically via `release_command` before the new version starts.

### Web (Vercel)

| Environment | Trigger | URL |
|-------------|---------|-----|
| Preview | Pull request | Auto-generated preview URL |
| Staging | Push to `main` | Vercel staging URL |
| Production | Push tag `v*` | Production domain |

Preview URLs are automatically posted as PR comments.

### Desktop (GitHub Releases)

| Platform | Trigger | Artifacts |
|----------|---------|-----------|
| macOS | Push tag `v*` | `.dmg`, `.zip` |
| Windows | Push tag `v*` | `.exe` |
| Linux | Push tag `v*` | `.AppImage`, `.deb` |

Artifacts are uploaded to GitHub Releases. The Electron auto-updater checks for new releases on app launch.

### Mobile (EAS Build)

| Platform | Trigger | Distribution |
|----------|---------|-------------|
| iOS | Push tag `v*` | TestFlight |
| Android | Push tag `v*` | Google Play (internal track) |

---

## CI/CD Pipelines

### Pipeline Overview

```
PR opened ──────> ci.yml (typecheck, lint, test, build, E2E)
                  deploy-web.yml (preview deployment)

Push to main ───> ci.yml
                  deploy-api.yml (staging)
                  deploy-web.yml (staging)

Push tag v* ────> deploy-api.yml (production)
                  deploy-web.yml (production)
                  build-desktop.yml (macOS, Windows, Linux)
                  build-mobile.yml (iOS, Android)
```

### Required GitHub Secrets

| Secret | Used By | Purpose |
|--------|---------|---------|
| `TURBO_TOKEN` | All workflows | Turborepo remote cache |
| `TURBO_TEAM` | All workflows | Turborepo team |
| `FLY_API_TOKEN` | deploy-api | Fly.io deployment |
| `VERCEL_TOKEN` | deploy-web | Vercel deployment |
| `VERCEL_ORG_ID` | deploy-web | Vercel organization |
| `VERCEL_PROJECT_ID` | deploy-web | Vercel project |
| `EXPO_TOKEN` | build-mobile | EAS Build |
| `CSC_LINK` | build-desktop | macOS code signing certificate |
| `CSC_KEY_PASSWORD` | build-desktop | Certificate password |
| `APPLE_ID` | build-desktop | macOS notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | build-desktop | macOS notarization |
| `APPLE_TEAM_ID` | build-desktop | Apple Team ID |

---

## Git Workflow

### Branching Strategy

```
main                    # Stable, deploys to staging automatically
├── feature/XYZ-123     # Feature branches (from main)
├── fix/XYZ-456         # Bug fixes
└── v1.2.3              # Release tags trigger production deploys
```

**Branch naming:** `<type>/<ticket-id>-<short-description>`

| Prefix | Purpose |
|--------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Code restructuring |
| `chore/` | Tooling, deps, config |
| `docs/` | Documentation |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build, tooling, or dependency changes |
| `perf` | Performance improvement |
| `style` | Formatting, missing semicolons, etc. |

**Scopes:** Use the package name without the `@vsync/` prefix.

```bash
# Examples
feat(engine): add loop iteration limit
fix(auth): handle expired OAuth refresh tokens
refactor(db): consolidate repository interfaces
test(api): add workflow CRUD endpoint tests
chore(web): upgrade Next.js to 15.5
docs: add deployment section to README
```

### Release Process

```bash
# 1. Create a release tag
git tag v1.2.3
git push origin v1.2.3

# This automatically triggers:
#   - API production deploy (Fly.io)
#   - Web production deploy (Vercel)
#   - Desktop builds (macOS, Windows, Linux → GitHub Releases)
#   - Mobile builds (iOS → TestFlight, Android → Play Store)
```

### Pull Request Workflow

1. Create a feature branch from `main`
2. Make changes and commit with conventional commit messages
3. Push and open a PR
4. CI runs automatically: typecheck, lint, test, build, E2E
5. Web preview URL is posted as a PR comment
6. Get review and approval
7. Merge to `main` (triggers staging deploys)

---

## Code Conventions

### TypeScript

- **Strict mode everywhere** — no `any`, no `@ts-ignore`, no `as` casts (unless unavoidable with a comment explaining why)
- All imports use `@vsync/` workspace aliases:
  ```typescript
  import { Block } from "@vsync/shared-types";
  import { validateBlock } from "@vsync/blocks";
  ```
- ESM only — all packages use `"type": "module"` with `.js` extensions in imports

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Variables, functions | camelCase | `getUserById`, `isActive` |
| Types, interfaces, classes | PascalCase | `WorkflowVersion`, `BlockType` |
| Files | kebab-case | `workflow-builder.tsx`, `key-manager.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `API_URL` |

### Comments

Comments explain **why**, not **what**:

```typescript
// Good: explains the reasoning
// PGlite doesn't support advisory locks, so we use a simple mutex
const lock = new Mutex();

// Bad: restates the code
// Create a new mutex
const lock = new Mutex();
```

### Block Properties

All block properties must be prefixed with `<block_type>_`:

```typescript
// Correct
{ fetch_url: "...", fetch_method: "GET", fetch_bind_value: "result" }

// Wrong
{ url: "...", method: "GET", bind_value: "result" }
```

### API Responses

Every API endpoint returns:

```typescript
{
  data: T | null,        // Payload
  error?: {              // Present on failure
    code: string,
    message: string,
    details?: unknown
  },
  meta?: {               // Pagination info
    page: number,
    pageSize: number,
    total: number
  }
}
```

### Testing

- **Never mock** — use real implementations or throw:
  ```typescript
  // Good
  const db = createPgliteClient(new PGlite());

  // Bad
  const db = jest.mock("../db");
  ```
- Build before testing: `pnpm build && pnpm test`
- Tests live next to source: `packages/engine/src/core/interpreter.test.ts`

### CSS / Styling

- Tailwind CSS with HSL CSS variable tokens:
  ```tsx
  <div className="bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border-[hsl(var(--border))]">
  ```
- No framer-motion — use Tailwind animation utilities or CSS keyframes
- Responsive breakpoints: `sm` (640px), `lg` (1024px)

---

## Architecture

### System Overview

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Mobile   │  │   Web    │  │ Desktop  │
│  (Expo)   │  │(Next.js) │  │(Electron)│
└─────┬─────┘  └────┬─────┘  └────┬─────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
              ┌──────┴──────┐
              │   API       │
              │  (Hono)     │
              │  port 3001  │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────┴────┐ ┌────┴────┐ ┌───┴────┐
    │ Auth    │ │ Engine  │ │  DB    │
    │(better- │ │(block   │ │(Drizzle│
    │ auth)   │ │executor)│ │  ORM)  │
    └─────────┘ └─────────┘ └───┬────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
               ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
               │PostgreSQL│ │ PGlite │ │ SQLite  │
               │  (prod)  │ │ (dev)  │ │(desktop)│
               └──────────┘ └────────┘ └─────────┘
```

### Block Types

The workflow engine supports 21 block types in 5 categories:

| Category | Blocks |
|----------|--------|
| **Data** | `object`, `string`, `array`, `math`, `date`, `normalize` |
| **Flow** | `goto`, `sleep`, `code`, `validation` |
| **Integration** | `fetch`, `agent`, `location`, `ftp` |
| **UI** | `ui_camera`, `ui_form`, `ui_table`, `ui_details` |
| **Platform** | `image`, `filesystem`, `video` |

### Trigger Types

| Type | How it starts |
|------|---------------|
| `interactive` | User clicks "Run" on a device |
| `api` | External HTTP request |
| `schedule` | Cron expression (e.g., `0 9 * * *`) |
| `hook` | Webhook with secret validation |
| `vision` | AI vision model trigger |

### Database Adapters

| Adapter | Used In | When |
|---------|---------|------|
| **PostgreSQL** (postgres.js) | API server | Production / staging |
| **PGlite** (@electric-sql/pglite) | API server | Local dev, E2E tests (in-memory) |
| **SQLite** (better-sqlite3) | Desktop app | Offline-first local storage |

---

## Troubleshooting

### "Module not found" errors

Build all packages first — Next.js resolves workspace imports from `dist/`:

```bash
pnpm build
```

### PGlite crashing on startup

Ensure Node.js >= 22. PGlite requires modern V8 features.

### Playwright tests fail locally

1. Install browsers: `pnpm exec playwright install --with-deps`
2. Ensure packages are built: `pnpm build`
3. Check ports 3000 and 3001 are free

### "pnpm: command not found"

Enable corepack (ships with Node.js):

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

### Turbo cache issues

Clear the cache and rebuild:

```bash
rm -rf .turbo node_modules/.cache
pnpm build
```

### Desktop app won't start

The desktop app needs workspace packages built:

```bash
pnpm build
pnpm --filter @vsync/desktop dev
```

### Type errors after pulling latest

Dependencies or types may have changed:

```bash
pnpm install
pnpm build
pnpm typecheck
```
