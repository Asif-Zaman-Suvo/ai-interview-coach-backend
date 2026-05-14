# Graph Report - ai-interview-coach-backend  (2026-05-14)

## Corpus Check
- 54 files · ~8,522 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 343 nodes · 558 edges · 24 communities (14 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `74539437`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]

## God Nodes (most connected - your core abstractions)
1. `SessionsService` - 16 edges
2. `Interview Coach Backend - Setup Guide` - 16 edges
3. `AdminService` - 15 edges
4. `QuestionsService` - 15 edges
5. `AdminController` - 14 edges
6. `SessionsController` - 14 edges
7. `RolesService` - 11 edges
8. `UsersService` - 11 edges
9. `AiService` - 11 edges
10. `AnswersService` - 10 edges

## Surprising Connections (you probably didn't know these)
- `bootstrap()` --calls--> `createAppValidationPipe()`  [EXTRACTED]
  src/main.ts → src/common/pipes/validation.pipe.ts
- `loadDatabaseConfig()` --calls--> `requireEnv()`  [EXTRACTED]
  src/database/database.config.ts → src/common/env.ts
- `createBetterAuthRootOptions()` --calls--> `loadDatabaseConfig()`  [EXTRACTED]
  src/auth/better-auth.factory.ts → src/database/database.config.ts
- `loadBetterAuthEnvConfig()` --calls--> `requireEnv()`  [EXTRACTED]
  src/auth/better-auth.config.ts → src/common/env.ts
- `createBetterAuthRootOptions()` --calls--> `loadBetterAuthEnvConfig()`  [EXTRACTED]
  src/auth/better-auth.factory.ts → src/auth/better-auth.config.ts

## Communities (24 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (40): 🤖 AI Features, Answer Evaluation, API Model Configuration, Application Collections, 🔒 Authentication & Authorization, Auto-Fallback on API Failures, code:typescript (@Post('start')), code:bash (# 1. Install dependencies) (+32 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (22): AdminModule, AiModule, QUESTION_BANK_SESSION_IDS, Difficulty, Question, QuestionDocument, QuestionSchema, QuestionType (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (21): AuthConfig, loadAuthConfig(), AuthModule, auth, AuthenticationModule, client, dbName, port (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (11): asDate(), InterviewEvaluationService, normalizeWords(), STOPWORDS, AuthenticatedRequest, canonicalUserId(), SessionsController, shuffleInPlace() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (3): AdminController, AdminGuard, UsersService

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (9): AiService, AnswerEvaluation, asStringArray(), errMessage(), GeneratedQuestion, isQuotaOrRateLimitError(), parseEvaluationPayload(), parseSummaryPayload() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (4): AuthController, AuthService, AuthUser, SignUpDto

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (5): Role, RoleDocument, RoleSchema, RolesController, RolesService

### Community 8 - "Community 8"
Cohesion: 0.2
Nodes (5): Answer, AnswerDocument, AnswerSchema, AnswersModule, AnswersService

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (13): code:bash ($ npm install), code:bash (# development), code:bash (# unit tests), code:bash ($ npm install -g @nestjs/mau), Compile and run the project, Deployment, Description, License (+5 more)

### Community 13 - "Community 13"
Cohesion: 0.2
Nodes (10): 1. Environment Variables, 2. Database Setup, 3. Seed Initial Data, 4. Start the Server, code:env (PORT=3333), code:bash (# If using local MongoDB), code:bash (npx ts-node src/seeds/roles.seed.ts), code:bash (# First, register a user through your frontend) (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (8): Admin Endpoints (Admin + Auth Required), 📋 API Endpoints, Authentication Endpoints (Better Auth), code:json ({), code:json ({), code:json ({), Dashboard Endpoints (Auth Required), Interview Session Endpoints (Auth Required)

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (4): escapeRegExp(), seedAdmin(), User, UserSchema

## Knowledge Gaps
- **71 isolated node(s):** `DatabaseConfig`, `cfg`, `BetterAuthEnvConfig`, `AuthUser`, `SignInDto` (+66 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SessionsService` connect `Community 9` to `Community 1`, `Community 3`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `AdminController` connect `Community 4` to `Community 1`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `AdminService` connect `Community 11` to `Community 1`, `Community 4`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `DatabaseConfig`, `cfg`, `BetterAuthEnvConfig` to the rest of the system?**
  _71 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._