# LLM interview evaluation

All provider calls run in NestJS. The injected `LlmProvider` handles transport;
`InterviewEvaluationService` builds context, validates output and selects the
heuristic fallback. Add a new adapter and register it in `LlmModule` to support
another provider. Session summaries reuse this provider and reliability configuration.

## Configuration

Set in backend `.env` (or root `.env` for Docker Compose):

```dotenv
LLM_PROVIDER=groq
GROQ_API_KEY=your-private-key
LLM_MODEL=openai/gpt-oss-20b
LLM_TIMEOUT_MS=15000
LLM_MAX_RETRIES=1
```

Only the key needs a real value; the others show defaults. Choose a Groq model
supporting strict JSON Schema output. A missing key deliberately uses fallback.
Timeout covers the entire call and optional retry. Retries must be 0 or 1.
Provider HTTP configuration errors, malformed output, refusals and timeouts use
fallback. No provider errors, credentials, prompts or transcripts are logged by
the evaluation layer. Frontend environment variables never include these values.

## Existing data

Back up MongoDB and stop every backend replica before applying migration:

```sh
cd ai-interview-coach-backend
node scripts/deduplicate-answers.cjs          # dry run
node scripts/deduplicate-answers.cjs --apply  # archive duplicates, recalculate scores, add index
```

The migration preserves the earliest answer for each session/question pair and
archives extras in `answer_duplicates_archive`. Existing session summaries remain
historical text. Restart after migration so cached dashboard aggregates expire.
New installations create the unique index at startup; startup fails if old
duplicates prevent creating it. The migration is not run automatically.

## Local manual test

1. From the repository root run `docker compose up -d mongo redis`.
2. Configure the existing database/auth values and Groq settings in backend `.env`.
   Start Nest with `npm run start:dev` from the backend directory.
3. Set frontend `NEXT_PUBLIC_API_URL=http://localhost:3333` in `.env.local`, then
   run `npm run dev` from the frontend directory. The existing auth setup requires
   browser acceptance of Secure cookies; use an HTTPS local setup if HTTP cookies
   are rejected.
4. Register and log in. Promote your account with the existing
   `npx ts-node src/seeds/admin.seed.ts your-email` script. Run the role seed if
   needed: `npx ts-node src/seeds/roles.seed.ts`. In admin UI create at least two
   questions for one role/difficulty, including their private ideal answers.
5. Start an interview and answer by voice in a supported browser. Network responses
   for start, detail and next question must not contain `idealAnswer`. Answer
   responses contain score, feedback, strengths and improvements, plus existing
   transcript/nextQuestion fields.
6. Check MongoDB `answers`: `evaluationSource` should be `llm`. It is intentionally
   absent from learner responses. Complete the interview and check the score is
   the average of one saved answer per question.
7. While a session is active, replay an answer request in browser DevTools. An
   identical trimmed transcript returns the saved evaluation; a changed transcript
   returns 409. The answer count stays unchanged. After completing the session,
   replaying either request returns 409.
8. Set `LLM_TIMEOUT_MS=1` or temporarily clear the key, restart Nest, and submit a
   new answer. The flow still returns feedback with a fallback notice and MongoDB
   records `evaluationSource=heuristic_fallback`. Restore configuration afterward.

## Verification

```sh
NODE_OPTIONS=--experimental-vm-modules npm test -- --runInBand
npx tsc --noEmit --incremental false
npm run build
```

The Node flag allows the existing Better Auth ESM dependency in the full Jest
suite. Focused evaluator/provider/answer/controller tests also run without it.
Tests mock provider requests; they do not spend API credits. Concurrent requests
may make redundant provider calls, but the unique index guarantees only one saved
answer per session/question. No queue or worker is involved.

## Personalized session summaries

Completion loads role, difficulty, question type/text and saved answer transcripts,
scores, feedback, strengths and improvements entirely on the backend. Reference
answers and internal evaluation metadata are excluded from the summary context.
Validated results are saved in `sessions.summary`, `sessions.topImprovements`
(up to three prioritized actions), and internal `sessions.summarySource`
(`llm` or `heuristic_fallback`). Overall scores remain rounded answer-score averages.
The results page displays saved summaries and priorities; learner APIs omit source
and provider metadata.

Completed sessions return their existing result without regeneration, including
legacy sessions. Concurrent requests within one backend share summary generation.
Separate replicas can make redundant calls, but an atomic active-to-completed
update preserves the first saved result. No queue or worker is involved.

### Test LLM summary

1. Set a valid `GROQ_API_KEY` in root `.env`; no new configuration is needed.
2. Run `docker compose up -d --build backend frontend` from the repository root.
3. Refresh http://localhost, start a new interview, answer its questions, and
   click **Complete Session**.
4. Verify the results page shows an overall summary and prioritized improvements.
5. Inspect that session in MongoDB: `status: completed`, `score`, `summary`,
   `topImprovements`, and `summarySource: llm`.
6. Replay `POST /api/sessions/<id>/complete` in browser DevTools. The response,
   source and session update timestamp should remain unchanged.

### Test summary fallback

1. Start another interview and save at least one answer while Groq is enabled.
   Keep the session active; do not complete it yet.
2. Temporarily clear `GROQ_API_KEY` in root `.env`, then run
   `docker compose up -d --force-recreate backend`.
3. Complete the active interview. Completion succeeds and shows a deterministic
   summary. Inspect `summarySource: heuristic_fallback`; saved answer scores
   remain unchanged.
4. Restore the key and recreate the backend. The completed fallback summary stays
   saved; start a new session to test LLM generation again.

Existing timeout/retry settings apply to summaries as well as answers. Empty
sessions receive an explicit no-answers summary without a provider call.
Historical completed summaries are not automatically regenerated.

Evaluation and session-summary fallback warnings include an allowlisted internal cause code. Examples: `provider_timeout`, `provider_http_error:429` (rate limit), `provider_http_error:401` (authentication), `provider_output_limit` (truncated generation), `provider_invalid_response`, and `invalid_evaluation`/`invalid_session_summary` (local validation). Unknown exceptions log only `unknown_error`. Raw errors, prompts, provider bodies and candidate/reference text are never logged by this diagnostic path. The learner response remains unchanged. Previously persisted fallback results are not re-evaluated by duplicate submissions.
