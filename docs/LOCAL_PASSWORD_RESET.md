# Reset an existing local admin password

The installed Better Auth version is 1.6.11. The application uses the MongoDB
adapter and `better-auth/crypto` hashing with the shared 12–64 character policy.
There is no production reset-email handler. `setPassword` cannot replace an
existing password. This standalone CLI uses Better Auth's supported
`requestPasswordReset` and `resetPassword` APIs with a local token callback.
It does not change application auth configuration or manually write passwords.

From the repository root, using the Docker stack:

```sh
docker compose up -d --build backend
docker compose exec backend node dist/seeds/reset-password.js --local-dev your-admin-email@example.com
```

Replace the email with your existing admin email. Use an interactive terminal;
do not add `-T`. Enter the new password twice when prompted. Input is hidden.
The password must be 12–64 characters with uppercase, lowercase, number and symbol.
No password/token is accepted as a command argument, persisted as plaintext, or logged.

For a backend running directly on your host:

```sh
cd ai-interview-coach-backend
npm run build
node dist/seeds/reset-password.js --local-dev your-admin-email@example.com
```

The CLI reads `MONGODB_URI`, optional `MONGODB_DB`, and `BETTER_AUTH_SECRET` from
backend `.env` on the host or the backend container environment in Docker.
It requires explicit `--local-dev` and permits only MongoDB addresses
`localhost`, `127.0.0.1`, `::1`, or the Compose `mongo` service. It refuses remote
URIs, missing admin profiles, and accounts without exactly one existing credential.
It preserves identity, profile, admin role, sessions, interview data and other
account records. A short-lived reset token is generated and consumed by Better Auth.

After success, sign in at http://localhost/login/admin with the existing email
and new password. This tool is intended only for your local development database.

Verification performed: backend build, TypeScript and targeted lint checks;
isolated MongoDB fixture with interactive terminal input, supported API reset,
Better Auth hash verification, token consumption and related-record preservation.
The fixture database was removed; no existing account was reset during testing.
