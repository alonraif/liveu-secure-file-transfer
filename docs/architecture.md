# LiveU Secure File Transfer Architecture

## Stack choices

- Web: Next.js 14 with the App Router and TypeScript
- API: Next.js route handlers and server actions, keeping the HTTP boundary in one deployable service
- Database: PostgreSQL 16
- ORM: Prisma
- Auth: local credential authentication with database-backed sessions and HttpOnly cookies
- Password hashing: Argon2 via `@node-rs/argon2`
- Storage: S3-compatible abstraction, using MinIO locally and AWS S3-compatible providers in production
- Email: SMTP abstraction via Nodemailer, with Mailpit locally
- Jobs: dedicated worker service for cleanup, delivery retries, and Caddy certificate polling
- Reverse proxy: Caddy, with separate development and production configuration

## Service boundaries

- `web`: UI, authenticated admin and user flows, recipient pages, API endpoints, auth/session handling
- `worker`: background jobs, retention cleanup, email retries, orphan cleanup, operational polling
- `db`: PostgreSQL for application state, sessions, settings, audit logs, job runs
- `minio`: local S3-compatible object storage
- `minio-init`: bucket bootstrap for local development
- `mailpit`: local SMTP sink and message inspection UI
- `caddy`: ingress, HTTPS termination, certificate automation in production

## Auth/session approach

- Local username or email plus password login
- Password hashes stored with Argon2
- Session records stored in PostgreSQL with hashed opaque tokens
- HttpOnly, Secure cookies in production, strict same-site by default
- Forced password reset flag evaluated at login
- Failed login counters and temporary lockout windows tracked per user
- CSRF tokens enforced for state-changing browser requests

## Domain entities

- `User`: identity, role, status, password state, lockout state, last login
- `Session`: authenticated sessions and reset flows
- `Share`: sender-owned secure delivery with expiration and download policy
- `ShareRecipient`: recipient-level tracking and delivery state
- `ShareFile`: file metadata and storage object linkage
- `ShareAccessEvent`: open/download allow-deny trail
- `PlatformSetting`: singleton operational and branding configuration
- `SslCertificateStatus`: current hostname and certificate status mirror
- `EmailDelivery`: outbound email attempts and provider responses
- `AuditLog`: immutable security and operational event log
- `JobRun`: background worker execution history

## Docker topology

- Local development is fully containerized with `docker compose up`
- Source code is bind-mounted into `web` and `worker` containers for iterative development
- Dependencies live in a named volume to avoid host Node requirements
- `docker compose --profile ops run --rm migrate` applies schema state
- `docker compose --profile ops run --rm seed` creates the default admin and baseline settings
- Production uses the same service layout with the production Compose override and standalone app images

## Folder structure

```text
apps/
  web/        Next.js UI and API surface
  worker/     Background jobs and operational endpoints
packages/
  config/     Shared typed environment parsing
prisma/       Prisma schema and seed scripts
caddy/        Development and production reverse proxy config
docs/         Architecture and operational notes
```
