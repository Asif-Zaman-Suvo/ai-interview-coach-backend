# AI Interview Coach — Backend

NestJS REST API for the [AI Interview Coach](https://github.com/Asif-Zaman-Suvo/ai-interview-coach) frontend. Handles auth, interview sessions, admin content, billing sandbox, and user settings.

**Living API / integration contract:** [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)

If you are in the **monorepo** (`ai-interview-coach-full-stack`), prefer the root [README](../README.md) for Docker Compose (Mongo + Redis + Nest + Next + Nginx).

---

## Features

| Area | Description |
|------|-------------|
| **Authentication** | Email/password via Better Auth; app profiles with `user` vs `admin` roles |
| **Interview practice** | Start sessions by job role and difficulty; questions from an admin-managed bank; rule-based scoring and feedback |
| **Session limits** | Plans / quotas for how many interviews a learner can start (admins bypass) |
| **Roles & content admin** | CRUD for job roles and the question bank; view and manage user interviews |
| **Billing (dev/sandbox)** | Dummy purchase flow to upgrade interview packs (optional via env) |
| **Admin notifications** | In-app notifications for events such as pack purchases |
| **Marketing** | Anonymous dashboard-style preview stats from completed sessions (no PII) |
| **Testimonials** | Public list of published quotes; signed-in users can submit/update their own |
| **Settings** | User settings API (preferences stored per profile) |
| **Redis (optional)** | Shared cache + rate limiting for multi-instance Nest behind a load balancer |

---

## Stack

- **Node.js** v18+ (LTS recommended; Docker images use Node 22)
- **NestJS** 11 (Express)
- **MongoDB** with **Mongoose** (source of truth)
- **Redis** via **ioredis** (optional — cache + rate limits)
- **Better Auth** (Mongo adapter) + `@thallesp/nestjs-better-auth`
- **class-validator** / **class-transformer**
- **dotenv** for configuration
- **Docker** (optional) — see monorepo root `docker-compose.yml`

---

## Prerequisites

- Node.js 18+ and npm
- MongoDB (local, Docker, or Atlas)
- Redis **optional** for local single-instance; **recommended** when scaling Nest to 2+ replicas

---

## Local setup (host)

### 1. Install

```bash
cd ai-interview-coach-backend   # or clone the backend repo
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API port (default `3333`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `BETTER_AUTH_SECRET` | Yes | Long random string for session signing |
| `BETTER_AUTH_URL` | Yes | Public URL of this API (e.g. `http://localhost:3333`) |
| `FRONTEND_URL` | Yes | Next.js origin(s) for CORS + trusted origins. Comma-separated allowed (e.g. `http://localhost:3000` or `https://app.vercel.app`) |
| `REDIS_URL` | No | e.g. `redis://localhost:6379`. **If unset, Redis is disabled** (cache/rate-limit fail-open). Do not leave a bad URL like `redis://localhost` on Render without Redis. |
| `AUTH_RATE_LIMIT` | No | Max auth attempts per IP per window (default `20`) |
| `AUTH_RATE_WINDOW_SECONDS` | No | Window length (default `60`) |
| `AUTH_RATE_LIMIT_FAIL_CLOSED` | No | Default `false`. Set `true` **only** when Redis is provisioned; otherwise login/register can 503 |
| `MONGODB_DB` | No | Override DB name if not in URI |
| `DUMMY_PAYMENT_ENABLED` | No | Set `false` in production to block sandbox billing |
| `MONGO_TRANSACTIONS` | No | Enable only with a replica set |
| `INSTANCE_ID` | No | Optional stable id for `X-Instance-Id` (defaults to hostname+pid) |

### 3. Infra (Mongo + Redis)

**Option A — Docker (from monorepo root):**

```bash
docker compose up mongo redis
```

**Option B — local installs** of MongoDB and Redis matching `.env`.

### 4. Start

```bash
npm run start:dev
```

API: `http://localhost:3333`  
Health: `GET /health` → `{ status, mongo, redis, instanceId, ... }`

Every response includes `X-Instance-Id` (useful behind Nginx load balancing).

### 5. Seed (optional)

```bash
npx ts-node src/seeds/roles.seed.ts
npx ts-node src/seeds/admin.seed.ts you@example.com
```

---

## Docker (full stack)

From the **monorepo root** (`ai-interview-coach-full-stack`):

```bash
cp .env.example .env
# set BETTER_AUTH_SECRET

docker compose up --build --scale backend=2
```

- App: http://localhost (Nginx → Next + Nest)
- Health: http://localhost/health
- Nest listens on `3333` inside the network; Redis at `redis://redis:6379`

Hot-reload Nest/Next in containers:

```bash
docker compose -f docker-compose.dev.yml up
```

Backend image: `ai-interview-coach-backend/Dockerfile` (multi-stage → `node dist/main.js`).

---

## Redis: what it does

| Use | Behavior |
|-----|----------|
| **Cache** | Questions bank, public testimonials, marketing preview, settings, roles. Keys: `aic:{entity}:…`. **Fail-open** if Redis is down (serve from Mongo). |
| **Rate limit** | Better Auth sign-in/sign-up + `/auth/register`; session answer route. Default **fail-open** without Redis. |
| **Multi-instance** | Shared state across Nest replicas behind Nginx — do not rely on in-process memory for cache/limits. |

MongoDB remains the system of record (including Better Auth sessions). Redis is never the primary store.

---

## Running with the frontend

1. Backend on `3333` (or Docker via Nginx on port `80`).
2. Frontend: `NEXT_PUBLIC_API_URL=http://localhost:3333` (or `http://localhost` behind Compose Nginx).
3. `FRONTEND_URL` must match the browser origin.

Auth uses cookie sessions (`credentials: 'include'`). Align CORS / Better Auth trusted origins with the Vercel (or local) origin.

---

## Production (e.g. Render + Vercel)

| Key | Example |
|-----|---------|
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `BETTER_AUTH_URL` | `https://your-api.onrender.com` |
| `BETTER_AUTH_SECRET` | strong secret |
| `MONGODB_URI` | Atlas URI |
| `REDIS_URL` | **leave unset** until you add Redis |
| `AUTH_RATE_LIMIT_FAIL_CLOSED` | `false` (or omit) |

When you add Redis (Render Redis / Upstash / etc.):

1. Set `REDIS_URL`
2. Optionally set `AUTH_RATE_LIMIT_FAIL_CLOSED=true`

**Do not** set `REDIS_URL=redis://localhost…` on Render — that makes Redis look “configured” but unreachable and can break auth if fail-closed is on.

Also: HTTPS, strong secrets, `DUMMY_PAYMENT_ENABLED=false` in real prod.

---

## API overview

REST under `/api` except `/auth/me`, `/auth/register`, and `/health`.

| Prefix | Auth | Description |
|--------|------|-------------|
| `/api/sessions` | User | Start, answer, complete, list sessions |
| `/api/roles` | Public / user | Job roles |
| `/api/admin/*` | Admin | Users, roles, question bank, stats |
| `/api/billing/dummy-purchase` | User | Sandbox pack upgrade |
| `/api/marketing/dashboard-preview` | Public | Aggregate stats |
| `/api/testimonials` | Mixed | Public list; authenticated submit |
| `/api/settings` | User | Preferences / account delete |
| `/api/auth/*` | — | Better Auth sign-in / sign-up / session |
| `/health` | Public | Liveness + mongo/redis |

---

## Project structure

```text
src/
  admin/           Admin CRUD, stats, notifications
  answers/         Answer persistence and scoring
  auth/            Better Auth + profile endpoints
  billing/         Dummy purchase / quota upgrades
  common/          Pipes, env helpers, instance id
  database/        Mongoose connection
  marketing/       Public aggregate endpoints
  notifications/   Admin notifications
  questions/       Question bank
  redis/           Redis client, cache keys, rate limits
  roles/           Job roles
  sessions/        Interview lifecycle
  settings/        User preferences
  testimonials/    Public and user testimonials
  users/           Profiles
  seeds/           CLI seeds
Dockerfile         Production image
docs/PROJECT_SPEC.md
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with watch |
| `npm run start:debug` | Dev + debugger |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run compiled app |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `npm run test:e2e` | E2E tests |
| `npm run test:cov` | Coverage |

---

## Related

- **Frontend:** [ai-interview-coach](https://github.com/Asif-Zaman-Suvo/ai-interview-coach)
- **Monorepo Docker:** root `docker-compose.yml` + `nginx/nginx.conf`
