# Hosting Kelola Bimbel on a Node.js host

Run the app on a Node.js-compatible host connected to a persistent PostgreSQL service. The application's filesystem does not hold your database.

## Production environment

Set private values through your host:

```dotenv
DATABASE_URL=postgresql://user:password@database-host:5432/app
BETTER_AUTH_SECRET=your-random-secret-at-least-32-characters
BETTER_AUTH_URL=https://your-app.example
# Optional direct connection when the runtime URL uses a pooler:
MIGRATION_DATABASE_URL=postgresql://user:password@direct-host:5432/app
# Optional: mark this deployment as a release, which hides the starter showcase
# pages. Leave blank and NODE_ENV decides — a production build is a release.
MODE_RILIS=
# Optional: the app schedules backups itself using the schedule owners set in
# Settings -> Backup (stored in `backup_settings`). Set `nonaktif` to hand that
# job to an external cron job instead; see docs/deploy-coolify.md.
PENJADWAL_BACKUP=
# Optional: where backup copies live and which dump command produces them. The
# dump command must be reachable from the app container; the default image ships
# no `pg_dump`.
BACKUP_DIR=
BACKUP_COMMAND=
# Optional: the recovery test (Settings -> Backup -> Uji Pemulihan) restores a
# chosen copy into a throwaway database. Point these at that database only — the
# app refuses when the target name matches the database it is running on.
RESTORE_DATABASE_URL=
RESTORE_COMMAND=
# Optional: send password reset links through an SMTP provider. Leave them blank
# and the link is written to the server log instead, so local and test flows keep
# working. SMTP_PORT defaults to 587 (STARTTLS), SMTP_SECURE follows the port
# (465 means TLS from the start), and SMTP_FROM falls back to SMTP_USER. Keep
# SMTP_PASSWORD in your host's secret store only.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_FROM_NAME=
```

Keep provider-required TLS settings. Do not disable certificate verification. The example credentials are placeholders, not defaults.

Each optional group above switches a feature on: leave a group blank and the app starts without it. Password recovery is the one worth filling in early, because without SMTP the reset link only lands in the container log — set `SMTP_HOST` and the credentials, and `/lupa-password` starts sending email. The full list with categories, including the ones your host sets for you, is in `src/lib/variabel-lingkungan.ts` and is readable at runtime in Settings -> Environment (`/app/pengaturan/lingkungan`), which shows names and whether they are set, never values.

Leave `MODE_RILIS` blank in production: the release container runs with `NODE_ENV=production`, which already marks the deployment as a release. Release mode drops the starter showcase links from the menu and answers `/app/contoh-status` like a route that never existed, instead of redirecting a visitor to sign-in (`src/proxy.ts`). Set the variable only to override `NODE_ENV` — `true` to close the showcase in a local or review build, `false` to keep it reachable in a release build; a `false` left behind in production reopens those routes. `docs/deploy-coolify.md` documents the same switch for operators, in Indonesian.

`PENJADWAL_BACKUP` only decides whether the in-app scheduler runs; anything other than `nonaktif`/`off`/`false`/`0`/`tidak`/`no` leaves it on, so a typo never silences scheduled backups. Each scheduled run writes a row to `backup_runs` exactly like `npm run db:backup` and the manual **Run backup** button, and the app catches up a slot it missed while the container was down — so pick one scheduler, in-app or cron, not both. The due-time rules and the switch are tested in `tests/penjadwal-backup.test.mjs`.

```sh
npm ci
npm run db:migrate
npm run build
npm start
```

Apply migrations once per release. `MIGRATION_DATABASE_URL` takes precedence only for migration/Drizzle tooling; the app uses `DATABASE_URL`. Use a role with schema permissions for migrations and the permissions needed by your application at runtime. Auth migrations contain `public` tables and a Drizzle migration-history schema.

## Docker image

`Dockerfile` builds two targets from one `next build`. The default `runner` target ships `.next/standalone`: a minimal server, the traced runtime files, and nothing else. The `migrator` target adds `drizzle-orm` and the committed SQL so a release can migrate before the new app starts.

```sh
docker build -t my-app .
docker build --target migrator -t my-app-migrate .
```

`next build` reads `DATABASE_URL` and `BETTER_AUTH_SECRET` while collecting page data, so the builder stage sets throwaway placeholders on that single command. They are not stored in image metadata and are never used at runtime. Pass real values to the running container instead; do not put secrets in `--build-arg`, `ENV`, or the image.

```sh
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  my-app-migrate

docker run -d -p 3000:3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  -e BETTER_AUTH_URL="https://your-app.example" \
  my-app
```

`BETTER_AUTH_URL` must be the origin browsers actually use, including the port. Cookie-authenticated mutations reject any other origin. Behind a proxy or load balancer, set it to the public URL, not the container address.

Pass any optional setting from the block above the same way — `-e SMTP_HOST=...` to turn on password-reset email, `-e PENJADWAL_BACKUP=nonaktif` to hand backups to an external cron job, and so on. Nothing else has to be set for the app to start; a missing optional value only switches its feature off.

The app listens on `PORT` (default `3000`) and `HOSTNAME` (default `0.0.0.0`), and runs as the unprivileged `node` user. The `HEALTHCHECK` requests a static asset, so it reports liveness only: a database outage will not restart a healthy process. Add your own readiness probe if your platform needs one that checks PostgreSQL.

Rebuild the image for each release. The image holds no data, so scale it horizontally and keep the connection-pool guidance below in mind. Set `ARG NODE_VERSION` to pin a specific Node.js tag.

## Connection pooling

The app uses a shared node-postgres pool with at most five connections per process and a connection timeout. Development hot reloads reuse that pool. Multiple instances multiply the connection count: use your database provider's recommended pooler and tune the pool size to the deployment. Verify your host supports Node.js and TCP PostgreSQL connections. No Edge-specific driver is included.

## Local Docker versus hosted data

`compose.dev.yaml` is a local convenience. It publishes PostgreSQL on loopback only and stores data in a named volume. `npm run db:down` keeps that volume. Do not delete volumes containing data you need.

Use PostgreSQL backups or your provider's backup service and test restoration. Docker volumes are persistence, not backups. On hosted services, setup does not provision a database or purchase resources; supply an existing connection. Whatever runs the dump — the in-app scheduler, the **Run backup now** button, or `npm run db:backup` from cron — the app records the run in `backup_runs`, and **Settings -> Backup** reads it back: total runs by status, the last successful copy with its size and location, a freshness verdict against the configured schedule, and the 20 most recent runs with the failure reason attached. Check that page before digging into container logs. The app never deletes old copies: the retention setting only decides when the newest copy counts as stale, so file cleanup stays with your cron script or object storage. The in-app recovery test refuses to run against the app's own database (it compares database names and aborts), so a real restore stays a manual, deliberate operation: restore the dump into a fresh database, check the row counts against production, then repoint `DATABASE_URL` and redeploy — `docs/deploy-coolify.md` (Indonesian) walks through the order, including what a restored copy rolls back besides the data.

Password recovery already has its provider — `/lupa-password` sends the reset link through the `SMTP_*` settings above, and without them the app still writes that link to the server log, so a deployment that has no mail provider keeps a recovery path for its teachers. Account email addresses are still not verified by the base: add a verification provider if the deployment needs one. Reassess shared auth rate limiting when scaling to multiple app instances.

References: [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql), [node-postgres pooling](https://node-postgres.com/features/pooling), [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [PostgreSQL Docker image](https://hub.docker.com/_/postgres).

The multi-class student-placement rules and their migration are summarized in `docs/penempatan-murid.md` (Indonesian).
