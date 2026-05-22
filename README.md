# AI Interview Coach — Backend

NestJS REST API for the [AI Interview Coach](https://github.com/Asif-Zaman-Suvo/ai-interview-coach) frontend. Handles auth, interview sessions, admin content, billing sandbox, and user settings. Data is stored in MongoDB.

**Living API / integration contract:** [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)

---

## Features

| Area | Description |
|------|-------------|
| **Authentication** | Email/password via Better Auth; app profiles with `user` vs `admin` roles |
| **Interview practice** | Start sessions by job role and difficulty; questions from an admin-managed bank; rule-based scoring and feedback per answer and on completion |
| **Session limits** | Plans / quotas for how many interviews a learner can start (admins bypass) |
| **Roles & content admin** | CRUD for job roles and the question bank; view and manage user interviews |
| **Billing (dev/sandbox)** | Dummy purchase flow to upgrade interview packs (optional via env) |
| **Admin notifications** | In-app notifications for events such as pack purchases (read/unread) |
| **Marketing** | Anonymous dashboard-style preview stats from completed sessions (no PII) |
| **Testimonials** | Public list of published quotes; signed-in users can submit/update their own |
| **Settings** | User settings API (preferences stored per profile) |

---

## Stack

- **Node.js** v18+ (LTS recommended)
- **NestJS** 11 (Express)
- **MongoDB** with **Mongoose**
- **Better Auth** (Mongo adapter) + `@thallesp/nestjs-better-auth`
- **class-validator** / **class-transformer**
- **dotenv** for configuration

---

## Prerequisites

- Node.js 18+ and npm
- MongoDB running locally or a remote instance (Atlas, etc.)

---

## Local setup

### 1. Clone and install

```bash
git clone git@github.com:Asif-Zaman-Suvo/ai-interview-coach-backend.git
cd ai-interview-coach-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API port (default `3333`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `BETTER_AUTH_SECRET` | Yes | Long random string for session signing |
| `BETTER_AUTH_URL` | Yes | Public URL of this API (e.g. `http://localhost:3333`) |
| `FRONTEND_URL` | Yes | Next.js origin for CORS + cookies (e.g. `http://localhost:3000`) |
| `MONGODB_DB` | No | Override DB name if not in URI |
| `DUMMY_PAYMENT_ENABLED` | No | Set `false` in production to block sandbox billing |
| `MONGO_TRANSACTIONS` | No | Enable only with a replica set deployment |

### 3. Start the server

```bash
npm run start:dev
```

The API listens on `http://localhost:3333` by default.

Health check: `GET /health`

### 4. Seed data (optional)

Seed default job roles:

```bash
npx ts-node src/seeds/roles.seed.ts
```

Register a user via the frontend or Better Auth, then promote to admin:

```bash
npx ts-node src/seeds/admin.seed.ts you@example.com
```

Add question bank entries through the admin UI or `POST /api/admin/questions` so learners can start interviews.

---

## Running with the frontend

1. Start this backend on port `3333`.
2. In the [frontend repo](https://github.com/Asif-Zaman-Suvo/ai-interview-coach), set `NEXT_PUBLIC_API_URL=http://localhost:3333` in `.env.local`.
3. Ensure `FRONTEND_URL` here matches the Next.js origin (`http://localhost:3000`).

Auth uses cookie-based sessions. The frontend calls the API with `credentials: 'include'`, so CORS origin and cookie domain must align.

---

## API overview

All REST routes are prefixed with `/api` except legacy auth paths (`/auth/me`, `/auth/register`) and `/health`.

| Prefix | Auth | Description |
|--------|------|-------------|
| `/api/sessions` | User | Start, answer, complete, list, and delete interview sessions |
| `/api/roles` | Public / user | List job roles for interview setup |
| `/api/admin/*` | Admin | Users, roles, question bank, stats, interviews, notifications |
| `/api/billing/dummy-purchase` | User | Sandbox pack upgrade (when enabled) |
| `/api/marketing/dashboard-preview` | Public | Anonymous aggregate stats |
| `/api/testimonials` | Mixed | Public list; authenticated submit/update |
| `/api/settings` | User | Preferences and account deletion |
| Better Auth routes | — | Sign-in, sign-up, session management under `/api/auth/*` |

See controllers under `src/` for full route list and DTOs.

---

## Project structure

```text
src/
  admin/           Admin CRUD, stats, notifications
  answers/         Answer persistence and scoring
  auth/            Better Auth integration + profile endpoints
  billing/         Dummy purchase / quota upgrades
  common/          Pipes, guards, env helpers
  database/        Mongoose connection module
  marketing/       Public aggregate endpoints
  notifications/   Admin notification schema/service
  questions/       Question bank schema
  roles/           Job role schema and public listing
  sessions/        Interview session lifecycle
  settings/        User preferences
  testimonials/    Public and user testimonials
  users/           User/profile schema
  seeds/           CLI seed scripts
docs/
  PROJECT_SPEC.md  Living integration contract
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with watch mode |
| `npm run start:debug` | Dev server with debugger |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run compiled app |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Jest) |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:cov` | Coverage report |

---

## Production notes

- Set strong values for `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `FRONTEND_URL`.
- Set `DUMMY_PAYMENT_ENABLED=false` (or omit) to disable sandbox billing.
- Deploy behind HTTPS; Better Auth session cookies require secure origins in production.
- If the API is mounted at `/api` behind a reverse proxy, the frontend's `NEXT_PUBLIC_API_URL` can include `/api` — the client normalizes this automatically.

---

## Related repos

- **Frontend:** [ai-interview-coach](https://github.com/Asif-Zaman-Suvo/ai-interview-coach)
- **Frontend spec:** [ai-interview-coach/docs/PROJECT_SPEC.md](https://github.com/Asif-Zaman-Suvo/ai-interview-coach/blob/main/docs/PROJECT_SPEC.md)
