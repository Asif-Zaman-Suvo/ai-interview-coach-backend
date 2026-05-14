# AI Interview Coach — Backend

NestJS API for an interview practice product: **authenticated users** run role/difficulty **sessions** backed by a **MongoDB question bank**, submit answers, and receive **rule-based scoring, feedback, and session summaries** (no external LLM required). **Administrators** manage roles, users, and the question bank.

**Marketing / growth:** anonymous **landing dashboard preview** aggregates (completed-session stats + recent rows, no user IDs) and a **testimonials** API (public list + per-user upsert).

## Stack

- **Runtime:** Node.js 18+
- **Framework:** [NestJS](https://nestjs.com/) 11, Express
- **Database:** MongoDB ([Mongoose](https://mongoosejs.com/) + [Better Auth Mongo adapter](https://www.better-auth.com/))
- **Auth:** [Better Auth](https://www.better-auth.com/) via [`@thallesp/nestjs-better-auth`](https://github.com/thallesp/nestjs-better-auth)
- **Validation:** `class-validator` / `class-transformer`

## Prerequisites

- MongoDB instance reachable via `MONGODB_URI`
- npm (or compatible package manager)

## Quick start

```bash
cp .env.example .env
# Edit .env: set MONGODB_URI, BETTER_AUTH_SECRET, URLs as needed.

npm install
npm run start:dev
```

- **API base:** `http://localhost:<PORT>/api` (default port **3333**)
- **Health:** `GET /health` (no `/api` prefix — see [Routing](#routing))
- **Better Auth:** mounted at `/api/auth/*` (sign-in, session cookies, etc.)

### Initial data

1. Seed job roles (if you use bundled seeds):

   ```bash
   npx ts-node src/seeds/roles.seed.ts
   ```

2. Register a user through your client (or Better Auth email flow).

3. Promote a user to **admin** (updates `user_profiles.role`):

   ```bash
   npx ts-node src/seeds/admin.seed.ts user@example.com
   ```

4. Use **Admin APIs** or the admin UI to add **question bank** entries per role and difficulty. Sessions **fail fast** with a structured error if the bank is empty for the chosen role/difficulty (`code: QUESTION_BANK_EMPTY`).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB` | No | Database name if not set in the URI |
| `BETTER_AUTH_SECRET` | Yes | Signing secret for Better Auth |
| `BETTER_AUTH_URL` | No | Public backend URL (default: `http://localhost:<PORT>`) |
| `FRONTEND_URL` | No | Allowed CORS origin + trusted origin for auth (default: `http://localhost:3000`) |
| `PORT` | No | HTTP port (default: `3333`) |
| `MONGO_TRANSACTIONS` | No | Set to `true` only with a **replica set** |

Optional **admin seed** only:

- `BETTER_AUTH_USER_COLLECTION` — Better Auth user collection name if not default `user`.

Copy from `.env.example` and adjust for each environment. **Do not commit real secrets.**

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Dev server with watch |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run `node dist/main` |
| `npm run lint` | ESLint (with autofix where configured) |
| `npm run test` | Unit tests (Jest) |
| `npm run test:e2e` | E2E tests |

## Routing

Global prefix **`api`** applies to most routes. These are **excluded** and live at the root of the host:

- `GET /health`
- `GET /auth/me`
- `POST /auth/register`

So a typical protected resource is: `GET /api/sessions`, not `/api/api/sessions`.

CORS allows `FRONTEND_URL` with **`credentials: true`** (cookie-based sessions).

## API overview

Routes under `/api` use the global prefix unless [noted above](#routing). **`@AllowAnonymous()`** endpoints still live under `/api/...` but skip the auth guard.

### Public (anonymous)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/testimonials/public` | Published testimonials; optional query `limit` (default 12) |
| `GET` | `/api/marketing/dashboard-preview` | Landing-page safe stats: totals + recent completed sessions (no user ids); optional `recentLimit` (1–10, default 3) |

### Sessions (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions/difficulties` | `Easy` \| `Medium` \| `Hard` |
| `GET` | `/api/sessions/me/stats` | User stats (e.g. best role, aggregates) |
| `GET` | `/api/sessions/recent` | Recent sessions with duration/score for lists |
| `GET` | `/api/sessions/score-trend` | Points for charts |
| `GET` | `/api/sessions` | Paginated history (`page`, `limit`) |
| `GET` | `/api/sessions/:id` | Full detail: questions, answers, feedback, **`duration`**, timestamps |
| `POST` | `/api/sessions/start` | Body: `roleId`, `difficulty`; optional `resumeText` (ignored for bank sampling). Up to **5** bank questions; uses `scheduledBankQuestionIds` |
| `POST` | `/api/sessions/:id/answer` | Body: `questionId`, `transcript` |
| `POST` | `/api/sessions/:id/complete` | Computes final score + **rule-based** summary/`topImprovements` |
| `DELETE` | `/api/sessions/:id` | Deletes session and related answers/questions copies where applicable |

When the question bank has no items for the selected role and difficulty, `POST /api/sessions/start` returns **400** with `message`, `code: QUESTION_BANK_EMPTY`, `roleId`, and `difficulty`.

### Testimonials (authenticated, except public list)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/testimonials/me` | Current user’s testimonial (or `null`) |
| `POST` | `/api/testimonials` | Create/update testimonial for the current user (validated DTO) |

Published rows are served from `GET /api/testimonials/public` (see [marketing](#public-anonymous)).

### Roles (catalog)

- `GET /api/roles` — list job roles for the UI

### Auth (custom + Better Auth)

- `POST /auth/register` — app registration DTO (`SignUpDto`, strong password policy)
- `GET /auth/me` — session + merged `user_profiles` **role** (`user` \| `admin`)

Better Auth core routes (sign-in, sign-out, etc.): **`/api/auth/*`**.

### Admin (`AuthGuard` + `AdminGuard`)

- `GET /api/admin/stats`, `GET /api/admin/users`, `PUT /api/admin/users/:id/role`, `DELETE /api/admin/users/:id`
- Question bank: `GET/POST/PUT/DELETE /api/admin/questions/...`, `GET /api/admin/questions/bank`
- Roles: `POST/PUT/DELETE /api/admin/roles/...`

## Data model (high level)

- **Better Auth** — `user`, `session`, `account`, `verification` (Mongo collections; names depend on adapter config)
- **`user_profiles`** — app profile + **`role`** (`user` \| `admin`), keyed by email; merged in `/auth/me`
- **`roles`** — job roles (name, icon, description)
- **Question bank** — reusable questions with `roleId`, difficulty, type, ideal answer
- **`sessions`** — user attempts; bank-backed sessions store **`scheduledBankQuestionIds`** (references bank ids; avoids duplicating bank docs in `questions` per session where this path is used)
- **`answers`** — per-question transcript, score, feedback, strengths, improvements
- **`testimonials`** — one doc per user (`userId` unique): rating, quote, author fields, **`published`** flag for public list

## Project layout

```
src/
  auth/             # Better Auth factory, guards, register, /auth/me
  admin/            # Admin HTTP API
  marketing/        # Public landing dashboard preview
  testimonials/     # Public list + authenticated CRUD for user’s testimonial
  sessions/         # Sessions, list mappers, interview evaluation (rule-based)
  questions/        # Bank + session-linked question access
  answers/
  roles/
  users/            # user_profiles (Mongoose)
  database/         # Mongo connection config
  common/           # validation, pipes, utilities
  seeds/            # roles.seed, admin.seed
```

## Security notes

- Keep `BETTER_AUTH_SECRET` long and random; rotate if compromised.
- Use HTTPS in production; tighten `FRONTEND_URL` / `BETTER_AUTH_URL` to real origins.
- Admin routes require `user_profiles.role === 'admin'`.
- Marketing and public testimonial endpoints are aggregated / redacted for anonymous use; do not expose raw user identifiers there.

## More documentation

For step-by-step setup and extra endpoint examples, see **`SETUP_GUIDE.md`**.

## License

`UNLICENSED` (private project) — see `package.json`.
