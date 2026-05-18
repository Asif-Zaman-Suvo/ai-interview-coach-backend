# Spec: AI Interview Coach (Nest backend)

Living product overview and setup: [README.md](../README.md)

**Frontend contract:** [ai-interview-coach/docs/PROJECT_SPEC.md](../../ai-interview-coach/docs/PROJECT_SPEC.md) — relative path when this repo and `ai-interview-coach` share the same parent directory (e.g. `ai-interview-coach-full-stack/`).

---

## Objective

Expose **REST + Better Auth** for the Next.js app: sign-in, interviews (sessions, answers, completion), admin CRUD, billing sandbox, marketing aggregates, testimonials, and settings. Persist in **MongoDB** via Mongoose.

---

## Integration with the frontend

- **Origin:** Next app uses `NEXT_PUBLIC_API_URL` (default `http://localhost:3333` in frontend `.env.example`).
- **Cookies / CORS:** `FRONTEND_URL` must match the browser origin serving the Next app so session cookies and CORS preflights align with how the frontend calls `credentials: 'include'`.
- **Auth:** Better Auth routes and session validation are implemented in this codebase; the frontend uses `better-auth` client against the same base URL.

---

## Commands

```bash
npm install
npm run start:dev    # watch
npm run build && npm run start:prod
```

Seeding and env variables are documented in [README.md](../README.md).

---

## Module map (high level)

| Area | Responsibility |
|------|------------------|
| Auth | Better Auth + profiles/roles |
| Interview | Sessions, question bank, scoring/evaluation |
| Admin | Roles, users, content, interview review |
| Billing | Dummy purchase / packs (optional) |
| Marketing / testimonials / settings | Public and user-scoped APIs |

When the API contract changes, update shared types or calls in the frontend (`lib/types.ts`, `lib/api.ts`, hooks) in the same change wave when possible.
