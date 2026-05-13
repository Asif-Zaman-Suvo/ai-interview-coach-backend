# Graph Report - ai-interview-coach-backend  (2026-05-13)

## Corpus Check
- 28 files · ~2,049 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 106 nodes · 157 edges · 12 communities (8 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e466f5f6`
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

## God Nodes (most connected - your core abstractions)
1. `requireEnv()` - 10 edges
2. `AuthService` - 9 edges
3. `UsersService` - 8 edges
4. `AppController` - 6 edges
5. `AppService` - 5 edges
6. `loadDatabaseConfig()` - 5 edges
7. `AuthController` - 5 edges
8. `createBetterAuthRootOptions()` - 5 edges
9. `loadBetterAuthEnvConfig()` - 4 edges
10. `loadAuthConfig()` - 4 edges

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

## Communities (12 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (6): AuthController, AuthModule, AuthService, AuthUser, SignUpDto, UsersModule

### Community 1 - "Community 1"
Cohesion: 0.19
Nodes (13): AuthConfig, loadAuthConfig(), BetterAuthEnvConfig, loadBetterAuthEnvConfig(), createBetterAuthRootOptions(), requireEnv(), AuthEnvConfig, loadAuthEnvConfig() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.2
Nodes (5): createAppValidationPipe(), AppController, AppModule, AppService, bootstrap()

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (13): code:bash ($ npm install), code:bash (# development), code:bash (# unit tests), code:bash ($ npm install -g @nestjs/mau), Compile and run the project, Deployment, Description, License (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.26
Nodes (4): User, UserDocument, UserSchema, UsersService

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (7): auth, AuthenticationModule, client, dbName, port, secret, uri

## Knowledge Gaps
- **24 isolated node(s):** `DatabaseConfig`, `cfg`, `BetterAuthEnvConfig`, `AuthUser`, `SignInDto` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `UsersService` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `DatabaseConfig`, `cfg`, `BetterAuthEnvConfig` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._