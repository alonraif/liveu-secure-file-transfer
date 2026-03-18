# LiveU Secure File Transfer

Production-oriented, Docker-first platform for securely sending files from authenticated internal users to external recipients through expiring, auditable download links.

## Current milestone

Phase 1 and Phase 2 are in place:

- Dockerized multi-service scaffold
- Next.js web app shell
- Dedicated worker service shell
- PostgreSQL, MinIO, Mailpit, and Caddy wired into Compose
- Prisma schema for the core domain
- Environment templates and seed script

## Architecture summary

- `web`: Next.js app router, UI, API routes, auth boundary
- `worker`: background jobs and cleanup orchestration
- `db`: PostgreSQL
- `minio`: local S3-compatible storage
- `mailpit`: local SMTP capture
- `caddy`: reverse proxy and production TLS automation

Detailed decisions live in [docs/architecture.md](/Users/alonrliveu.tv/Dev/liveu-secure-file-transfer/docs/architecture.md).

## Quick start

1. Create an environment file:

```bash
cp .env.example .env
```

2. Build and start the stack:

```bash
docker compose up --build
```

3. In a separate shell, initialize the database schema:

```bash
docker compose --profile ops run --rm migrate
```

4. Seed the initial admin user:

```bash
docker compose --profile ops run --rm seed
```

## Local endpoints

- App via Caddy: `http://localhost`
- Web container direct: `http://localhost:3000` is intentionally not exposed
- Mailpit UI: `http://localhost:8025`
- MinIO API: internal only for now

## Default seeded admin

- Email: value of `DEFAULT_ADMIN_EMAIL` in `.env`
- Username: value of `DEFAULT_ADMIN_USERNAME` in `.env`
- Password: value of `DEFAULT_ADMIN_PASSWORD` in `.env`

The seeded admin is forced to reset the password on first real login once auth is implemented.

## Notes

- Phase 3 adds the implemented backend services, migrations, auth, validation, and protected API routes.
- Phase 4 adds the full admin, user, and recipient UI flows.
- Phase 5 adds audit logging, rate limiting, secure downloads, cleanup jobs, and email delivery logic.
- Phase 6 adds Caddy operational integration, health and readiness detail, MinIO provisioning polish, and deployment documentation.
- Phase 7 adds tests and final hardening.
