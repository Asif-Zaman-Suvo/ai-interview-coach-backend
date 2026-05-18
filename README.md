# AI Interview Coach — Backend

## Features we’re building

- **Authentication** — Email/password via Better Auth; app profiles with **user** vs **admin** roles.
- **Interview practice** — Start sessions by **job role** and **difficulty**; questions come from an **admin-managed bank**; learners submit answers (transcript text); **rule-based scoring and feedback** per answer and on session completion.
- **Session limits** — **Plans / quotas** for how many interviews a learner can start (admins can bypass).
- **Roles & content admin** — CRUD for **job roles** and the **question bank**; view and manage user interviews.
- **Billing (dev/sandbox)** — **Dummy purchase** flow to upgrade interview packs (optional via env).
- **Admin notifications** — In-app notifications for events such as **pack purchases** (read/unread).
- **Marketing** — Anonymous **dashboard-style preview** stats from completed sessions (no PII).
- **Testimonials** — Public list of published quotes; signed-in users can submit/update their own.
- **Settings** — User **settings** API (preferences stored per profile).

## Stack

- **Node.js** (use **v18+**; LTS recommended)
- **NestJS** 11 (Express)
- **MongoDB** with **Mongoose**
- **Better Auth** (Mongo adapter) + **`@thallesp/nestjs-better-auth`**
- **class-validator** / **class-transformer**
- **dotenv** for configuration

## Local setup

1. Install and run **MongoDB** locally (or point `MONGODB_URI` at a remote instance).

2. From this directory:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least **`MONGODB_URI`**, **`BETTER_AUTH_SECRET`**, **`BETTER_AUTH_URL`**, and **`FRONTEND_URL`** (see `.env.example` for optional flags).

3. Install dependencies and start in watch mode:

   ```bash
   npm install
   npm run start:dev
   ```

4. **Optional — seed data**

   ```bash
   npx ts-node src/seeds/roles.seed.ts
   ```

   After you register a user (via your app or Better Auth), you can promote them to admin:

   ```bash
   npx ts-node src/seeds/admin.seed.ts you@example.com
   ```

   Add **question bank** entries through the **admin** APIs or UI so learners can start interviews for each role/difficulty.
