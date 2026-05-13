# Graph Report - ai-interview-coach-backend  (2026-05-13)

## Corpus Check
- 28 files · ~1,783 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 100 nodes · 141 edges · 15 communities (9 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `91edb4c6`
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

## God Nodes (most connected - your core abstractions)
1. `requireEnv()` - 10 edges
2. `AppController` - 6 edges
3. `UsersService` - 6 edges
4. `AppService` - 5 edges
5. `loadDatabaseConfig()` - 5 edges
6. `AuthService` - 5 edges
7. `createBetterAuthRootOptions()` - 5 edges
8. `loadBetterAuthEnvConfig()` - 4 edges
9. `loadAuthConfig()` - 4 edges
10. `loadAuthEnvConfig()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `loadAuthEnvConfig()` --calls--> `requireEnv()`  [EXTRACTED]
  src/auth/config/auth.env.ts → src/common/env.ts
- `bootstrap()` --calls--> `createAppValidationPipe()`  [EXTRACTED]
  src/main.ts → src/common/pipes/validation.pipe.ts
- `loadDatabaseConfig()` --calls--> `requireEnv()`  [EXTRACTED]
  src/database/database.config.ts → src/common/env.ts
- `createBetterAuthRootOptions()` --calls--> `loadDatabaseConfig()`  [EXTRACTED]
  src/auth/better-auth.factory.ts → src/database/database.config.ts
- `loadBetterAuthEnvConfig()` --calls--> `requireEnv()`  [EXTRACTED]
  src/auth/better-auth.config.ts → src/common/env.ts

## Communities (15 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.25
Nodes (10): AuthConfig, loadAuthConfig(), BetterAuthEnvConfig, loadBetterAuthEnvConfig(), createBetterAuthRootOptions(), requireEnv(), DatabaseConfig, loadDatabaseConfig() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.23
Nodes (4): AppController, AppModule, AppService, UsersModule

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (13): code:bash ($ npm install), code:bash (# development), code:bash (# unit tests), code:bash ($ npm install -g @nestjs/mau), Compile and run the project, Deployment, Description, License (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (4): AuthController, AuthModule, AuthService, AuthUser

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (4): User, UserDocument, UserSchema, UsersService

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (7): auth, AuthenticationModule, client, dbName, port, secret, uri

### Community 6 - "Community 6"
Cohesion: 0.6
Nodes (3): AuthEnvConfig, loadAuthEnvConfig(), createBetterAuthRootOptions()

## Knowledge Gaps
- **25 isolated node(s):** `DatabaseConfig`, `cfg`, `BetterAuthEnvConfig`, `AuthUser`, `SignUpDto` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `DatabaseConfig`, `cfg`, `BetterAuthEnvConfig` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._