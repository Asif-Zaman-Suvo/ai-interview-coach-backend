# AI Interview Coach — Backend

NestJS REST API for the [AI Interview Coach](https://github.com/Asif-Zaman-Suvo/ai-interview-coach) frontend. Handles auth, interview sessions, LLM answer evaluation and session summaries, resume extraction and profile analysis, admin content, billing sandbox, and user settings.

**Living API / integration contract:** [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)

If you are in the **monorepo** (`ai-interview-coach-full-stack`), prefer the root [README](../README.md) for Docker Compose (Mongo + Redis + Nest + Next + Nginx).

---

## Features

| Area                      | Description                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**        | Email/password via Better Auth; app profiles with `user` vs `admin` roles                                                                   |
| **Interview practice**    | Start sessions by job role and difficulty; questions from an admin-managed bank; validated LLM scoring and feedback with heuristic fallback |
| **Session summaries**     | Personalized LLM summary and up to three prioritized improvements from persisted evaluations; deterministic fallback                        |
| **Resume analysis**       | PDF/DOCX text extraction → structured LLM profile → candidate review/correction → independent target role/difficulty confirmation           |
| **Session limits**        | Plans / quotas for how many interviews a learner can start (admins bypass)                                                                  |
| **Roles & content admin** | CRUD for job roles and the question bank; view and manage user interviews                                                                   |
| **Billing (dev/sandbox)** | Dummy purchase flow to upgrade interview packs (optional via env)                                                                           |
| **Admin notifications**   | In-app notifications for events such as pack purchases                                                                                      |
| **Marketing**             | Anonymous dashboard-style preview stats from completed sessions (no PII)                                                                    |
| **Testimonials**          | Public list of published quotes; signed-in users can submit/update their own                                                                |
| **Settings**              | User settings API (preferences stored per profile)                                                                                          |
| **Redis (optional)**      | Shared cache + rate limiting for multi-instance Nest behind a load balancer                                                                 |

---

## Stack

- **Node.js 22 LTS** (Docker images use Node 22; Node 18 is unsupported by the PDF parser)
- **NestJS** 11 (Express)
- **MongoDB** with **Mongoose** (source of truth)
- **Redis** via **ioredis** (optional — cache + rate limits)
- **Better Auth** (Mongo adapter) + `@thallesp/nestjs-better-auth`
- **class-validator** / **class-transformer**
- **Groq** through a provider-independent `LlmProvider` interface; native server-side `fetch`
- **pdf-parse**, **mammoth**, **adm-zip** for PDF/DOCX extraction and archive checks
- **dotenv** for configuration
- **Docker** (optional) — see monorepo root `docker-compose.yml`

---

## Prerequisites

- Node.js 22 LTS and npm
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

| Variable                      | Required         | Description                                                                                                                                                           |
| ----------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                        | No               | API port (default `3333`)                                                                                                                                             |
| `MONGODB_URI`                 | Yes              | MongoDB connection string                                                                                                                                             |
| `BETTER_AUTH_SECRET`          | Yes              | Long random string for session signing                                                                                                                                |
| `BETTER_AUTH_URL`             | Yes              | Public URL of this API (e.g. `http://localhost:3333`)                                                                                                                 |
| `FRONTEND_URL`                | Yes              | Next.js origin(s) for CORS + trusted origins. Comma-separated allowed (e.g. `http://localhost:3000` or `https://app.vercel.app`)                                      |
| `REDIS_URL`                   | No               | e.g. `redis://localhost:6379`. **If unset, Redis is disabled** (cache/rate-limit fail-open). Do not leave a bad URL like `redis://localhost` on Render without Redis. |
| `AUTH_RATE_LIMIT`             | No               | Max auth attempts per IP per window (default `20`)                                                                                                                    |
| `AUTH_RATE_WINDOW_SECONDS`    | No               | Window length (default `60`)                                                                                                                                          |
| `AUTH_RATE_LIMIT_FAIL_CLOSED` | No               | Default `false`. Set `true` **only** when Redis is provisioned; otherwise login/register can 503                                                                      |
| `MONGODB_DB`                  | No               | Override DB name if not in URI                                                                                                                                        |
| `DUMMY_PAYMENT_ENABLED`       | No               | Set `false` in production to block sandbox billing                                                                                                                    |
| `MONGO_TRANSACTIONS`          | No               | Enable only with a replica set                                                                                                                                        |
| `INSTANCE_ID`                 | No               | Optional stable id for `X-Instance-Id` (defaults to hostname+pid)                                                                                                     |
| `LLM_PROVIDER`                | No               | `groq` (default); currently the only registered adapter                                                                                                               |
| `GROQ_API_KEY`                | For LLM features | Private Groq API key. Missing key uses answer/summary fallback; resume analysis returns an unavailable error                                                          |
| `LLM_MODEL`                   | No               | Default `openai/gpt-oss-20b`; must support strict JSON Schema output                                                                                                  |
| `LLM_TIMEOUT_MS`              | No               | Overall call timeout including retries; default `15000` milliseconds                                                                                                  |
| `LLM_MAX_RETRIES`             | No               | `0` or `1`; default `1`. Retry only transient network/HTTP failures                                                                                                   |

All LLM settings belong on the backend. Never put the API key in frontend `NEXT_PUBLIC_*` variables. Host development reads this repo's `.env`; Docker Compose reads the full-stack root `.env`. CVs and candidate answer context are sent to the configured LLM provider for analysis.

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
# configure database/auth values and GROQ_API_KEY in the root .env

docker compose up -d --build
```

- App: http://localhost (Nginx → Next + Nest)
- Health: http://localhost/health
- Nest listens on `3333` inside the network; Redis at `redis://redis:6379`

Hot-reload Nest/Next in containers:

```bash
docker compose -f docker-compose.dev.yml up
```

Backend image: `ai-interview-coach-backend/Dockerfile` (multi-stage → `node dist/main.js`).

After updating code or dependencies, rebuild and recreate the services; building an image alone does not update a running container:

```bash
docker compose up -d --build backend frontend
```

For an environment-only backend change: `docker compose up -d --force-recreate backend`. To run multiple backend instances, optionally add `--scale backend=2`.

---

## Redis: what it does

| Use                | Behavior                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cache**          | Questions bank, public testimonials, marketing preview, settings, roles. Keys: `aic:{entity}:…`. **Fail-open** if Redis is down (serve from Mongo). |
| **Rate limit**     | Better Auth sign-in/sign-up + `/auth/register`; session answer and resume upload/analysis routes. Default **fail-open** without Redis.              |
| **Multi-instance** | Shared state across Nest replicas behind Nginx — do not rely on in-process memory for cache/limits.                                                 |

MongoDB remains the system of record (including Better Auth sessions). Redis is never the primary store.

---

## Running with the frontend

1. Backend on `3333` (or Docker via Nginx on port `80`).
2. Frontend: `NEXT_PUBLIC_API_URL=http://localhost:3333` (or `http://localhost` behind Compose Nginx).
3. `FRONTEND_URL` must match the browser origin.

Auth uses cookie sessions (`credentials: 'include'`). Align CORS / Better Auth trusted origins with the Vercel (or local) origin.

---

## Production (e.g. Render + Vercel)

| Key                           | Example                                     |
| ----------------------------- | ------------------------------------------- |
| `FRONTEND_URL`                | `https://your-app.vercel.app`               |
| `BETTER_AUTH_URL`             | `https://your-api.onrender.com`             |
| `BETTER_AUTH_SECRET`          | strong secret                               |
| `MONGODB_URI`                 | Atlas URI                                   |
| `REDIS_URL`                   | **leave unset** until you add Redis         |
| `AUTH_RATE_LIMIT_FAIL_CLOSED` | `false` (or omit)                           |
| `LLM_PROVIDER`                | `groq`                                      |
| `GROQ_API_KEY`                | Your private key, configured only on Render |
| `LLM_MODEL`                   | `openai/gpt-oss-20b`                        |
| `LLM_TIMEOUT_MS`              | `15000`                                     |
| `LLM_MAX_RETRIES`             | `1`                                         |

On Render, configure these values under the backend service's **Environment** settings, then **Save, rebuild, and deploy**. Local `.env` files are not automatically applied to Render. Push the latest backend source and package lockfile to the service's connected Git branch before deploying. See [Render environment-variable documentation](https://render.com/docs/configure-environment-variables).

On Vercel, `NEXT_PUBLIC_API_URL` must be the public Render origin. No Groq credentials or model configuration belong in the frontend.

When you add Redis (Render Redis / Upstash / etc.):

1. Set `REDIS_URL`
2. Optionally set `AUTH_RATE_LIMIT_FAIL_CLOSED=true`

**Do not** set `REDIS_URL=redis://localhost…` on Render — that makes Redis look “configured” but unreachable and can break auth if fail-closed is on.

Also: HTTPS, strong secrets, `DUMMY_PAYMENT_ENABLED=false` in real prod.

---

## API overview

REST under `/api` except `/auth/me`, `/auth/register`, and `/health`.

| Prefix                             | Auth          | Description                                                               |
| ---------------------------------- | ------------- | ------------------------------------------------------------------------- |
| `/api/sessions`                    | User          | Start, answer, complete, list sessions                                    |
| `/api/resumes`                     | User          | Upload/extract, analyze/retry, review and confirm an owned resume profile |
| `/api/roles`                       | Public / user | Job roles                                                                 |
| `/api/admin/*`                     | Admin         | Users, roles, question bank, stats                                        |
| `/api/billing/dummy-purchase`      | User          | Sandbox pack upgrade                                                      |
| `/api/marketing/dashboard-preview` | Public        | Aggregate stats                                                           |
| `/api/testimonials`                | Mixed         | Public list; authenticated submit                                         |
| `/api/settings`                    | User          | Preferences / account delete                                              |
| `/api/auth/*`                      | —             | Better Auth sign-in / sign-up / session                                   |
| `/health`                          | Public        | Liveness + mongo/redis                                                    |

---

## LLM architecture and interview flow

All LLM communication runs synchronously in NestJS through `LlmProvider.generateStructured`. `LlmModule` injects the Groq adapter; another provider can be added there without changing `InterviewEvaluationService`. OpenAI and Gemini adapters are not implemented yet. There are no LLM queues or background workers.

```text
Existing role/difficulty question bank
  → candidate speaks or types in the frontend
  → candidate reviews/edits transcript and explicitly submits
  → backend loads private question/ideal answer and interview context
  → LlmProvider → structured JSON → local validation
  → persist answer evaluation → return feedback
  → complete session → synthesize persisted evaluations → save summary
```

`POST /api/sessions/start` accepts `{ roleId, difficulty, resumeId? }`. The role/difficulty still select up to five existing bank questions. If a resume is attached, its ownership and confirmed settings must match. Client-supplied resume text is not used as analysis context.

`POST /api/sessions/:id/answer` accepts `{ questionId, transcript }`. The reviewed transcript must contain non-whitespace text and be at most 12,000 characters. Browser speech recognition is optional and handled by the frontend; this backend does not implement speech-to-text.

The public evaluation fields remain:

```ts
{
  score: number; // integer, 0–100
  feedback: string;
  strengths: string[];
  improvements: string[];
}
```

Evaluation context includes question text, private ideal answer, candidate transcript, role, difficulty and question type. Ideal answers are omitted from learner question/session responses. Untrusted context is treated as data, not instructions.

- Provider failure, timeout or invalid output uses the existing heuristic evaluator and includes a fallback notice in feedback.
- `answers.evaluationSource` internally records `llm` or `heuristic_fallback`; source/provider details are omitted from learner responses.
- A unique session/question index prevents duplicate answers from changing scoring. An identical trimmed transcript reuses the saved evaluation; a conflicting answer returns 409. Completed sessions reject answer submissions.
- Completion averages persisted answer scores and generates `{ summary, topImprovements }` from saved questions, transcripts and evaluations, without sending ideal answers to the summary model.
- `sessions.summary`, `topImprovements` and internal `summarySource` are persisted. Already-completed requests reuse the saved result. Completion still succeeds with a deterministic summary when LLM generation fails; no-answer sessions use a deterministic message.
- Overlapping completion requests are coalesced within one instance; atomic persistence preserves the first completed result across replicas. Concurrent answer requests can still make redundant provider calls before the unique index selects the saved answer.

Older databases with duplicate answers need the documented migration before the unique index can be created. See [LLM evaluation, summaries and migration](docs/LLM_EVALUATION.md).

## Resume extraction, analysis and review

CV upload is optional and happens inside **New Interview** setup. The frontend can correct detected professional information, then independently choose an existing target role and difficulty. The detected role does not lock the interview role.

| Endpoint                         | Purpose                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /api/resumes`              | Multipart upload with one `file` field; validate, extract and persist text                          |
| `POST /api/resumes/:id/analyze`  | Analyze persisted text; reuse successful analysis or retry a failed attempt without uploading again |
| `GET /api/resumes/:id`           | Return the owner's safe profile view                                                                |
| `PATCH /api/resumes/:id/confirm` | Validate and save `{ profile, targetRoleId, difficulty }`                                           |

The structured profile contains `suggestedRole`, `experienceLevel` (Junior/Mid/Senior/Lead), nullable estimated years, core/additional skills, work experience and projects. Protected/sensitive attributes and candidate contact details are excluded from the requested profile. Prompts treat resume content as untrusted data, and local validation rejects unexpected properties and invalid fields.

Limits and parsing:

- PDF and DOCX only; legacy `.doc` is unsupported. Extension, MIME and signature must match.
- Upload limit: 5 MiB. PDF limit: 50 pages. DOCX limits: 1,000 archive entries and 20 MiB declared expanded size, plus document-entry and unsafe-entry checks.
- `pdf-parse` extracts actual PDF text; Mammoth extracts DOCX raw text. At least 20 readable characters and at most 30,000 normalized characters are required.
- Scanned/image-only PDFs are unsupported; no OCR. Unreadable, encrypted or malformed documents return an extraction error.
- Uploaded binary files and original filenames are not stored permanently.

The `resumes` collection stores owner ID, private `extractedText`, format/size, status, original `analysis`, corrected `reviewedProfile`, confirmed `targetRoleId`/`difficulty`, safe `errorCode` and timestamps. Sessions store only `resumeId`, avoiding duplicate resume text. Account deletion removes owned resumes.

Public responses allowlist ID/status/format, the reviewed or detected profile, and target settings. Extracted text, provider metadata and credentials are never returned. Every record API checks ownership; another user's ID returns 404.

Resume analysis does **not** use interview heuristics as fallback. Unsupported types return 415; oversized uploads 413; extraction/unreadable/text-limit errors 422; timeout 504; malformed output 502; provider unavailable 503. Extracted text is retained for a safe retry.

See [resume API, storage, limits and manual testing](docs/RESUME_ANALYSIS.md).

## Verification and troubleshooting

From this backend repo:

```bash
NODE_OPTIONS=--experimental-vm-modules npm test -- --runInBand
npx tsc --noEmit
npm run build
# Read-only lint check; npm run lint also applies fixes.
npx eslint "{src,test}/**/*.ts"
```

The VM-modules flag supports Better Auth's ESM dependency in Jest. Provider requests are mocked by the tests; HTTP tests need permission to bind a temporary local port. Tests cover structured evaluation/summary/profile validation, failures/fallback, duplicate/completed-session protections, real PDF/DOCX fixtures, upload limits and ownership/privacy. Full-project lint currently includes unrelated existing errors; do not interpret that as LLM provider failure.

Manual smoke test:

1. Configure Groq and start both services. Log in; ensure the selected role/difficulty has bank questions with private ideal answers.
2. Upload a readable PDF or DOCX during setup, review/edit the profile, and confirm an independently chosen target role/difficulty. Inspect `resumes` for `status=confirmed` and the reviewed profile.
3. Submit a reviewed spoken or typed answer. Inspect `answers.evaluationSource=llm`. Complete and inspect `sessions.summarySource=llm`, `summary` and `topImprovements`.
4. For a **local development** failure test, temporarily set `LLM_TIMEOUT_MS=1`, restart/recreate the backend, and submit a new answer/session. Answer/summary generation should fall back; resume analysis should show a retryable error. Restore configuration and retry the saved resume analysis without re-uploading.

From the full-stack root, inspect safe evaluation warnings:

```bash
docker compose logs --since 5m backend | rg 'LLM (evaluation|session summary) unavailable'
```

Warnings include allowlisted codes such as `provider_timeout`, `provider_http_error:429` (rate limit), `provider_http_error:401`, `provider_output_limit`, `provider_invalid_response`, or local validation failure. Unknown errors log only `unknown_error`. No transcripts, ideal answers, keys, prompts or raw sensitive provider responses are logged by this diagnostic path. On Render, inspect the same warning lines in service logs.

If upload returns `Cannot POST /api/resumes`, verify the deployed backend includes the resumes module: redeploy the latest code, or recreate the local backend using `docker compose up -d --build backend`. A successful health check alone does not prove a new route is deployed. Saved fallback scores do not automatically change after configuration is repaired; test with a new answer/session.

## Current scope and limitations

- Personalized CV-based interview question generation and admin AI question generation are not implemented. Questions still come from the existing admin bank.
- Model feedback can be inaccurate; structured validation checks shape and limits, not factual correctness. Candidates review detected profiles before confirmation.
- Only Groq is currently registered; other provider adapters are future work.
- Resume setup state is held by the frontend and resets on page refresh. Abandoned extracted records remain until account deletion; automatic retention cleanup is not implemented.
- Future question generation can load the session's owned `resumeId`, reviewed profile and private resume text, then use session role/difficulty as the final target. Generation/persistence/scheduling still need implementation.

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
  llm/             Provider interface, Groq transport and reliability
  marketing/       Public aggregate endpoints
  notifications/   Admin notifications
  questions/       Question bank
  redis/           Redis client, cache keys, rate limits
  resumes/         Upload, PDF/DOCX extraction, analysis and confirmed profiles
  roles/           Job roles
  sessions/        Interview lifecycle, evaluation/summary contracts and fallback
  settings/        User preferences
  testimonials/    Public and user testimonials
  users/           Profiles
  seeds/           CLI seeds and local password reset
test/fixtures/     Synthetic PDF/DOCX documents and profile fixtures
Dockerfile         Production image
docs/PROJECT_SPEC.md
```

---

## Scripts

| Command               | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `npm run start:dev`   | Dev server with watch                                                |
| `npm run start:debug` | Dev + debugger                                                       |
| `npm run build`       | Compile to `dist/`                                                   |
| `npm run start:prod`  | Run compiled app                                                     |
| `npm run lint`        | ESLint with automatic fixes                                          |
| `npm test`            | Jest tests; full suite uses `NODE_OPTIONS=--experimental-vm-modules` |
| `npm run test:e2e`    | E2E tests                                                            |
| `npm run test:cov`    | Coverage                                                             |

---

## Related

- **LLM guide:** [Evaluation, session summaries and migration](docs/LLM_EVALUATION.md)
- **Resume guide:** [Upload, analysis, review and storage](docs/RESUME_ANALYSIS.md)
- **Local admin password reset:** [Supported Better Auth reset utility](docs/LOCAL_PASSWORD_RESET.md)
- **Frontend:** [ai-interview-coach](https://github.com/Asif-Zaman-Suvo/ai-interview-coach)
- **Monorepo Docker:** root `docker-compose.yml` + `nginx/nginx.conf`
