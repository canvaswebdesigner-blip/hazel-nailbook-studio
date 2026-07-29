# Database development

## Current boundary

The repository contains the local Supabase contract, ordered SQL migrations,
RLS/grants, reviewed public read functions, narrow admin content/schedule
mutations, the public availability/booking transaction, hashed appointment
access sessions, customer cancellation/rescheduling transactions, storage
buckets, the idempotent public contact-submission boundary, registered admin
access sessions, password-recovery sessions, safe admin dashboard/appointment
read projections, and pgTAP tests.

These files are not evidence that a hosted database has already been migrated.
Before production:

1. Identify the exact Supabase project.
2. Verify its PostgreSQL major version, existing schemas, Auth users, storage
   buckets, extensions, and migration history.
3. Take and verify a recoverable backup.
4. Run the migrations in an isolated staging project first.
5. Run the database CI job and inspect every warning.
6. Apply to production only after an explicit release decision.

Do not make undocumented schema or RLS changes in the dashboard.

## Local commands

Docker must be running.

```sh
bun install --frozen-lockfile
bun run db:start
bun run db:reset
bun run db:lint
bun run db:test
bun run db:stop
```

`db:reset` rebuilds the database from `supabase/migrations` without loading
business seed data. `db:test` executes the pgTAP contracts under
`supabase/tests/database`.

## Migration rules

- Add a new ordered migration; do not edit an already-applied production
  migration.
- Keep schema/data seeds separate.
- Test every migration against a clean local database and staging.
- Destructive changes require a backup, rollback notes, and explicit approval.
- Regenerate checked-in TypeScript database types after the migration is
  applied to the authoritative schema.
- Never place real customer data in seeds, previews, or test fixtures.

## Security model

The Data API exposes only `public` and `graphql_public`. Internal state lives in
`private`, which is not API-exposed and has no API-role schema usage.

Application tables do not grant direct broad access:

- Public content is read through explicit projection functions.
- Safe business/content admin reads require an authenticated, registered and
  active AAL2 admin session and remain server-side.
- Authenticated admin writes use individually named RPCs that repeat role and
  active-session/AAL2 checks, enforce row versions, and write audit records.
- Public availability, booking, rate-limit, appointment-session, cancellation,
  and rescheduling operations use reviewed service-role-only RPC entry points.
- Contact submission uses its own service-role-only, idempotent RPC boundary;
  direct table writes remain forbidden.
- Appointment/customer admin reads use bounded safe projection RPCs; never
  return token hashes, consent HMACs, or unrelated private fields to a route.

See [grant-matrix.md](grant-matrix.md).

## Admin bootstrap

Admin identity creation is an owner-controlled production action. Follow
[admin-bootstrap.md](admin-bootstrap.md) only after Hazel's verified email and
the target Auth project are confirmed.
