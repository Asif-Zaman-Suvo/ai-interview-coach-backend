# Graph Report - ai-interview-coach-backend  (2026-05-14)

## Corpus Check
- 53 files · ~9,708 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 309 nodes · 471 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51d16387`
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

## God Nodes (most connected - your core abstractions)
1. `Interview Coach Backend - Setup Guide` - 15 edges
2. `SessionsService` - 13 edges
3. `SessionsController` - 13 edges
4. `AdminService` - 11 edges
5. `AiService` - 11 edges
6. `UsersService` - 11 edges
7. `QuestionsService` - 11 edges
8. `AnswersService` - 10 edges
9. `AdminController` - 10 edges
10. `RolesService` - 10 edges

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

## Communities (21 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (36): 🤖 AI Features, Answer Evaluation, API Model Configuration, 🔒 Authentication & Authorization, Auto-Fallback on API Failures, code:typescript (@Post('start')), code:env (USE_MOCK_AI=true), code:env (GEMINI_MODEL=gemini-1.5-flash) (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (15): AdminModule, AdminService, AdminGuard, Difficulty, Question, QuestionDocument, QuestionSchema, QuestionType (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.1
Nodes (17): AiModule, AnswersModule, auth, AuthenticationModule, client, dbName, port, secret (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (7): AuthController, AuthService, AuthUser, SignUpDto, UserRole, UserDocument, UsersService

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (4): asDate(), QuestionsService, AuthenticatedRequest, SessionsController

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (14): AuthConfig, loadAuthConfig(), AuthModule, BetterAuthEnvConfig, loadBetterAuthEnvConfig(), createBetterAuthRootOptions(), requireEnv(), AuthEnvConfig (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (9): AiService, AnswerEvaluation, asStringArray(), errMessage(), GeneratedQuestion, isQuotaOrRateLimitError(), parseEvaluationPayload(), parseSummaryPayload() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (5): Role, RoleDocument, RoleSchema, RolesController, RolesService

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (4): Answer, AnswerDocument, AnswerSchema, AnswersService

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (13): code:bash ($ npm install), code:bash (# development), code:bash (# unit tests), code:bash ($ npm install -g @nestjs/mau), Compile and run the project, Deployment, Description, License (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.2
Nodes (10): 1. Environment Variables, 2. Database Setup, 3. Seed Initial Data, 4. Start the Server, code:env (# Google Gemini AI API Key (Get from https://makersuite.goog), code:bash (# If using local MongoDB), code:bash (npx ts-node src/seeds/roles.seed.ts), code:bash (# First, register a user through your frontend) (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (8): Admin Endpoints (Admin + Auth Required), 📋 API Endpoints, Authentication Endpoints (Better Auth), code:json ({), code:json ({), code:json ({), Dashboard Endpoints (Auth Required), Interview Session Endpoints (Auth Required)

### Community 14 - "Community 14"
Cohesion: 0.5
Nodes (4): escapeRegExp(), seedAdmin(), User, UserSchema

## Knowledge Gaps
- **70 isolated node(s):** `DatabaseConfig`, `cfg`, `BetterAuthEnvConfig`, `AuthUser`, `SignInDto` (+65 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SessionsController` connect `Community 4` to `Community 2`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `SessionsService` connect `Community 10` to `Community 1`, `Community 2`, `Community 4`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `QuestionsService` connect `Community 4` to `Community 1`, `Community 2`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `DatabaseConfig`, `cfg`, `BetterAuthEnvConfig` to the rest of the system?**
  _70 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._