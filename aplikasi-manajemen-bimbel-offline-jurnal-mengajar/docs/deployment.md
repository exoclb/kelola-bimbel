# Hosting the PostgreSQL starter

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
```

Keep provider-required TLS settings. Do not disable certificate verification. The example credentials are placeholders, not defaults.

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

The app listens on `PORT` (default `3000`) and `HOSTNAME` (default `0.0.0.0`), and runs as the unprivileged `node` user. The `HEALTHCHECK` requests a static asset, so it reports liveness only: a database outage will not restart a healthy process. Add your own readiness probe if your platform needs one that checks PostgreSQL.

Rebuild the image for each release. The image holds no data, so scale it horizontally and keep the connection-pool guidance below in mind. Set `ARG NODE_VERSION` to pin a specific Node.js tag.

## Connection pooling

The app uses a shared node-postgres pool with at most five connections per process and a connection timeout. Development hot reloads reuse that pool. Multiple instances multiply the connection count: use your database provider's recommended pooler and tune the pool size to the deployment. Verify your host supports Node.js and TCP PostgreSQL connections. No Edge-specific driver is included.

## Local Docker versus hosted data

`compose.dev.yaml` is a local convenience. It publishes PostgreSQL on loopback only and stores data in a named volume. `npm run db:down` keeps that volume. Do not delete volumes containing data you need.

Use PostgreSQL backups or your provider's backup service and test restoration. Docker volumes are persistence, not backups. On hosted services, setup does not provision a database or purchase resources; supply an existing connection.

Account emails are not verified by the base. Add an email provider for verification and password recovery when needed. Reassess shared auth rate limiting when scaling to multiple app instances.

References: [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql), [node-postgres pooling](https://node-postgres.com/features/pooling), [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [PostgreSQL Docker image](https://hub.docker.com/_/postgres).

Perubahan aturan penempatan murid (multi-kelas) beserta migrasinya dirangkum di `docs/penempatan-murid.md`.
