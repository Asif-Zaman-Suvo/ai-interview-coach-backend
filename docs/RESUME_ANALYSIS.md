# Resume upload and reviewed candidate profiles

The interview setup now offers optional resume upload first, professional profile review/correction, independent target-role/difficulty selection, and confirmation. Questions still come from the existing role/difficulty question bank. No personalized question generation is implemented.

## Configuration and packages

No new environment variables. Reuse server-only `GROQ_API_KEY`, `LLM_PROVIDER=groq`, `LLM_MODEL` (default `openai/gpt-oss-20b`), `LLM_TIMEOUT_MS` (default 15000), and `LLM_MAX_RETRIES` (0 or 1, default 1). Compose reads the root `.env`; a locally started backend reads its own `.env`. Never add these to `NEXT_PUBLIC_*`.

Added runtime packages: `pdf-parse` v2, `mammoth`, `adm-zip`. Added development types: `@types/adm-zip`, `@types/multer`. PDF and DOCX parsing runs on the backend. Mammoth raw text extraction is used, not HTML conversion. Uploaded binaries are held in memory and discarded after extraction.

Limits: 5 MiB upload; PDF/DOCX only; extension, MIME, signature checks; PDF at most 50 pages; DOCX at most 1,000 ZIP entries and 20 MiB declared expanded size, required document entries, no macro binaries or traversal-like entries; at least 20 readable characters; at most 30,000 normalized extracted characters. Image-only/scanned and encrypted PDFs are unsupported. No OCR.

## API

All endpoints require the existing authentication guard. Every record lookup/update includes the authenticated `userId`. Another user's record produces 404. Upload and analysis use existing Redis rate limiting (five requests/minute each, same fail-open philosophy as existing interview endpoints).

- `POST /api/resumes`: multipart with exactly one `file`, no additional form fields. Extracts and saves text; returns id/status/format, null profile initially.
- `POST /api/resumes/:id/analyze`: builds context from private persisted text, calls `LlmProvider.generateStructured`, validates strict local schema and saves original analysis. Existing successful analysis is reused; concurrent calls in one instance are coalesced. Failed analysis can be retried on the same ID.
- `GET /api/resumes/:id`: returns safe profile view for its owner.
- `PATCH /api/resumes/:id/confirm`: `{ profile, targetRoleId, difficulty }`. Validates corrections and that target role exists. Keeps original analysis separately from the reviewed profile. The suggested role is a freely editable string; the target is an existing Role ID and can differ.
- `POST /api/sessions/start`: existing role/difficulty fields plus optional `resumeId`. Validates ownership, confirmed status, and matching confirmed target/difficulty, then stores only the resume reference. Does not accept/use frontend resume text as analysis context.

Public resume view contains only `id`, `status`, `format`, `profile` (reviewed profile if present, otherwise original analysis), `targetRoleId`, `difficulty`. No raw text, error/provider metadata, model identifiers, prompts, binaries or credentials. Session payloads remain unchanged and never embed resume data.

Failures: unsupported/mismatched types 415; oversized upload 413; extraction failure, unreadable content, document/text limits 422; invalid reviewed profile/settings 400; analysis timeout 504 (`ANALYSIS_TIMEOUT`); malformed/invalid output 502 (`ANALYSIS_INVALID_OUTPUT`); unavailable provider 503 (`ANALYSIS_UNAVAILABLE`). User errors are sanitized. Analysis does not fall back to interview heuristics. Extracted text remains available for retry. The UI retains the resume ID during the current setup flow; refreshing the page resets setup UI state.

The system prompt treats resume content as untrusted data and excludes protected attributes, candidate contact details, and sensitive personal characteristics. Exact allowed properties, enums, numeric ranges, lengths and nested arrays are validated before persistence. This reduces prompt-injection risk; schema validation cannot guarantee every model interpretation is correct, so candidate review remains essential.

## MongoDB data

Collection `resumes`:

- `_id`, `userId` (indexed Better Auth user ID), `createdAt`, `updatedAt`.
- `extractedText`: normalized document text, once per uploaded resume. May contain personal information present in the CV. Excluded from default Mongoose selection; explicitly selected only for analysis. Not returned by APIs or logged.
- `format`: `pdf`/`docx`; `sizeBytes`: original upload size. No binary file or original filename is stored.
- `status`: `extracted`, `analysis_failed`, `analyzed`, `confirmed`.
- `analysis`: validated AI-detected professional profile.
- `reviewedProfile`: validated candidate-confirmed corrections, separate from the original analysis.
- `targetRoleId`: chosen existing Role ID; `difficulty`: Easy/Medium/Hard.
- `errorCode`: sanitized internal analysis failure category, cleared on success.

Collection `sessions`: new optional `resumeId` string references `resumes._id`; existing `roleId` and `difficulty` remain the interview settings. No resume text duplication. Existing answer/session evaluation protections are unchanged. Account deletion also deletes owned resumes, including uploads never linked to sessions. Abandoned uploads currently remain until account deletion; automatic retention cleanup and resuming setup after refresh are future enhancements.

## Exact manual test steps (Docker)

From the full-stack root directory:

```sh
docker compose up -d --build backend frontend
docker compose ps
```

1. Ensure both services are healthy, open `http://localhost`, sign in, and open `/interview/setup`.
2. PDF: select a text-based PDF under 5 MiB and click Continue. Wait for Resume analyzed. For a synthetic fixture, use `ai-interview-coach-backend/test/fixtures/resume.pdf`.
3. Review: change Detected role, Experience level, estimated years and comma-separated skills. Work experience and project fields are editable when detected. Click Continue. Choose an available target role that differs from detected role and select a different difficulty. Continue, inspect the summary, then Start Interview. Choose a role/difficulty with existing bank questions; an empty bank still prevents starting.
4. In MongoDB inspect the newest owned `resumes` record: status confirmed, original analysis versus reviewedProfile, targetRoleId/difficulty. The resulting session has matching roleId/difficulty and resumeId. Inspect Network responses: neither upload/analysis nor session APIs should contain extractedText, idealAnswer, provider credentials or internal model fields.
5. DOCX: start a new setup and repeat with a genuine DOCX (or `test/fixtures/resume.docx`). It must show actual professional text-derived fields, not binary gibberish.
6. Unsupported/empty: try `.doc`, a renamed fake PDF, a file over 5 MiB, and an image-only PDF (synthetic `test/fixtures/empty.pdf`). Expect a clear error and no AI profile. Scanned PDFs need a text-based replacement.
7. Provider failure without editing real credentials: temporarily set root `.env` `LLM_MODEL=invalid-local-test-model`, then `docker compose up -d --force-recreate backend`. Upload a new resume, Continue, and expect an analysis-unavailable error. The resume document remains analysis_failed with extractedText and a safe errorCode. Restore the original model setting and recreate backend again. Keep the setup browser tab open, click Continue again: Network shows another analyze request to the SAME ID, without another file upload. Analysis should succeed. This setting also affects other LLM features while enabled.
8. Timeout variant: temporarily set `LLM_TIMEOUT_MS=1`, recreate backend, repeat with a new upload and expect timeout handling. Restore the previous timeout and recreate backend, then Continue to retry without re-uploading. Five analysis attempts/minute rate limit may require waiting before retry.
9. Privacy: copy the resume ID, sign in as another candidate, and request `/api/resumes/ID`; it must return 404. Confirmation, analysis and session linking must also reject that ID. An unauthenticated request must be rejected.
10. Skip CV: start setup without a file, select role/difficulty and start; the session should have no resumeId.

## Verification commands

Backend directory:

```sh
NODE_OPTIONS=--experimental-vm-modules npm test -- --runInBand
npx tsc --noEmit
npx eslint src/resumes src/llm/llm-provider.interface.ts src/llm/groq.provider.ts src/sessions/sessions.controller.ts src/sessions/sessions.controller.spec.ts src/sessions/session.schema.ts src/sessions/sessions.service.ts src/sessions/sessions.module.ts src/settings/settings.module.ts src/settings/settings.service.ts test/fixtures/resume-profile.fixture.ts
npm run build
```

Frontend directory:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Backend HTTP tests need permission to bind a temporary local port. Next production build also needs local subprocess/port access. Full backend lint includes existing unrelated lint issues; modified files should pass independently.

## Next iteration

Implement a separate personalized-question contract/prompt/validator/service using the existing LlmProvider. Resolve the session's owned resumeId server-side, load reviewedProfile plus extractedText explicitly, and use session roleId/difficulty as the final target. Generate and persist session-specific questions, define scheduling/answer validation for generated questions, and keep reference answers private. Add reliability, ownership and generation idempotency tests. None of this generation behavior is enabled by the current resume flow.

## Files changed for this iteration

Backend additions:

- `src/resumes/resume.contract.ts`: structured profile types/schema, prompt and local validator.
- `src/resumes/resume.schema.ts`: private resume/profile persistence schema.
- `src/resumes/resume-extraction.service.ts`: PDF/DOCX validation, extraction and normalization.
- `src/resumes/resumes.service.ts`: owned upload, analysis/retry, safe views and confirmation.
- `src/resumes/resumes.controller.ts`: authenticated multipart/review endpoints and limits.
- `src/resumes/resumes.module.ts`: dependency wiring and provider reuse.
- `src/resumes/resume.contract.spec.ts`, `resume-extraction.service.spec.ts`, `resumes.service.spec.ts`, `resumes.controller.spec.ts`: contract, real extraction, failure/privacy/persistence and HTTP tests.
- `test/fixtures/resume.pdf`, `empty.pdf`, `resume.docx`, `resume-profile.fixture.ts`: synthetic documents and profile fixture.
- `docs/RESUME_ANALYSIS.md`: feature/storage/API/configuration/manual testing documentation.

Backend updates:

- `package.json`, `package-lock.json`: server parser packages and development types.
- `src/llm/llm-provider.interface.ts`: optional backend-controlled output token budget.
- `src/llm/groq.provider.ts`: respects the budget, sanitizes malformed JSON errors and body-read timeouts.
- `src/llm/groq.provider.spec.ts`: output-budget/schema-name and response-body error tests.
- `src/sessions/session.schema.ts`, `sessions.service.ts`: optional resumeId persistence.
- `src/sessions/sessions.module.ts`: import resumes module.
- `src/sessions/sessions.controller.ts`, `sessions.controller.spec.ts`: verify owned confirmed resume/settings before session creation and test linking rejection.
- `src/settings/settings.module.ts`, `settings.service.ts`: delete owned resume records during account deletion.

Frontend additions/updates:

- `lib/resumes.ts`: typed authenticated upload/analyze/confirm API client.
- `components/interview/ResumeProfileReview.tsx`: editable professional profile review.
- `components/interview/ResumeUpload.tsx`: PDF/DOCX only, retained selection, disabled processing state and accessible upload label.
- `components/interview/InterviewSummary.tsx`: accurate current question-bank behavior.
- `app/(dashboard)/interview/setup/page.tsx`: resume-first optional flow, retry, review, independent target selection and confirmation.
- `app/(dashboard)/interview/setup/page.test.tsx`: upload/retry, editing, target/difficulty changes, skip-CV and limit tests.
- `lib/types.ts`: InterviewSetup uses resumeId instead of client-supplied resumeText.
