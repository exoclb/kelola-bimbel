# Architecture

One app, one package, one PostgreSQL database. A monorepo or shared package layer is unnecessary for the base; derivatives begin as independent copies.

```text
src/
  app/
    page.tsx                    starter welcome and first prompt
    (auth)/                     sign-in and sign-up pages
    (protected)/app/page.tsx     blank, authenticated application
    api/auth/[...all]/route.ts   Better Auth's HTTP endpoints
    api/notes/route.ts           authenticated list/create example
    api/notes/[id]/route.ts      authenticated read/update/delete example
  components/
    ui/                         shadcn/ui source, owned by this project
    auth-form.tsx               interactive signin/signup form
    providers.tsx               reduced-motion configuration
  config/site.ts                shared identity and app path
  db/
    schema/
      index.ts                  shared export entrypoint for all tables
      user.ts                   Better Auth user table
      session.ts                Better Auth session table
      account.ts                Better Auth provider/password table
      verification.ts           Better Auth verification table
      notes.ts                  example user-owned application table
    index.ts                    server-only PostgreSQL/Drizzle pool
  services/notes.service.ts     application rules and all Notes queries
  validators/notes.ts           strict request validation and input types
  lib/
    api.ts                      API session, origin, JSON, and error helpers
    auth.ts                     server-side Better Auth configuration
    auth-client.ts              same-origin browser client
    session.ts                  real session validation
    env.ts                      validated server settings
drizzle/                        SQL migrations and migration metadata
scripts/                        setup, diagnosis, migrations, safe copying
.agents/skills/                 workflows for coding assistants
```

## Request flow

The browser form calls Better Auth through `/api/auth`. Better Auth validates credentials, hashes passwords, writes through Drizzle, and manages session cookies. The browser redirects to `/app`. The protected layout and page read the session through Better Auth before displaying user information. Signout revokes the session through the same library.

`getSession()` is React-request-cached, not persistently cached between users. `requireSession()` redirects anonymous visitors to `/sign-in`. The base does not implement a second token system, middleware cookie-only authorization, or a custom password hasher.

Authentication at a layout is a UI gate. New actions and APIs must authenticate independently and filter user-owned rows by `session.user.id`. Return 401 from APIs for missing sessions; do not redirect an API client to an HTML signin page. Return a not-found result for a row the user does not own.

Application requests follow **API route → session/validation → service → Drizzle**. The [backend guide](backend.md) defines the HTTP contract and a complete CRUD example. Services receive a verified user ID and enforce ownership in their queries. The API layer owns request parsing, responses, mutation origin checks, and JSON errors. Database queries stay out of routes and components. Notes is a reference backend; its UI is left for feature work.

## Data and configuration

`.env.local` is ignored by Git. DATABASE_URL configures runtime PostgreSQL. MIGRATION_DATABASE_URL optionally supplies a direct connection for migrations. Process environment takes priority, followed by Next.js environment-file precedence. Setup appends only missing settings; external connections are preserved.

The application uses a node-postgres pool with five connections per process, timeouts, and an idle-error handler. Development hot reloads reuse the pool. Drizzle's pgTable schema uses PostgreSQL boolean and timestamptz types. Queries are asynchronous. Better Auth uses the pg adapter provider; the cookie prefix includes starter identity to coexist with other local apps.

With no supplied URL, setup creates random private credentials and a unique Compose project name, starts PostgreSQL 17 on an available loopback port, and waits for its healthcheck. A named Docker volume retains records across restarts. For a hosted database, setup skips Docker. Test commands always provision their own disposable PostgreSQL server with a random port; neither DATABASE_URL nor MIGRATION_DATABASE_URL from the app is used by tests.

Schema updates use `db:generate` then `db:migrate`. SQL and metadata must travel together. Startup does not run `db:push`, erase tables, or seed an account. Auth tables and migrations are part of the base's public maintenance contract.

## UI and future features

Server Components are the default. Client components are small interactive boundaries. Tailwind v4 tokens live in `globals.css`; shadcn components are normal editable source files. Motion respects reduced-motion preferences. The primary typeface is Plus Jakarta Sans, loaded through `next/font/google` in the root layout as the `--font-jakarta` variable and consumed by the `--font-sans` token, so the browser requests no external font host.

The global theme owns two primitive ramps: brand green (`--brand-50` … `--brand-900`, where `--brand-500` is `#83B520`) and neutral slate (`--slate-50` … `--slate-900`). Both are absolute values shared by every theme and are exposed to Tailwind as `bg-brand-*`, `text-slate-*`, `border-slate-*`, and gradient steps. The light canvas is the slate-50 `#F8FAFC` mapped onto `--background`; dark mode re-points the semantic tokens (`--background`, `--card`, `--border`, `--muted-foreground`) at darker slate steps rather than redefining the ramps, and sets `color-scheme` so native controls follow. `--muted-foreground` is chosen per theme so secondary text keeps at least 4.5:1 against the canvas, card, and muted surfaces (slate-600 in light, slate-300 in dark). The brand ramp also drives the action colour: `--primary` points at `--brand-700` in light and `--brand-500` in dark, with `--primary-foreground` picking the matching label colour (white on light, slate-900 on dark), so `bg-primary` buttons and the `bg-primary/10 … text-primary` status pills stay above 4.5:1 in both themes. Choose the brand step per theme when you need brand-coloured text instead of using the mid scale blindly.

The type scale is declared in full in `globals.css` so every page shares one set of steps: `--text-3xs` (10.5px, bottom tab labels), `--text-2xs` (11px, dense captions) through `--text-6xl`, with `xs`/`sm`/`base` for body copy. Pages follow the same roles — page titles use `text-3xl font-semibold tracking-tight sm:text-4xl` (30px, 36px from `sm`), page lead paragraphs use `text-base text-muted-foreground`, section headings use `text-xl`, and dense UI labels use `text-xs` or `text-2xs`. Avoid arbitrary sizes such as `text-[11px]`; add a scale step instead. The marketing landing page is the only place that may step up to the display sizes.

Spacing follows one rhythm: `--spacing` is 4px, so every Tailwind step (`p-1`, `gap-2`, `mt-4`, …) is a multiple of it across both the staff area and the portal. The radius tokens carry the design roles rather than raw values — `rounded-lg` is the 12px control/CTA radius and `rounded-xl` is the 16px card radius.

Focus is part of the token system: `*:focus-visible` in `globals.css` draws a 2px `--primary` outline with a 2px offset for links and any element without its own ring, while the shadcn primitives keep their 3px ring in the (solid) `ring` colour. Both stay at or above 3:1 against the light and dark canvas, so keyboard focus is always visible.

The portal shell is the only place that opts into `viewport-fit=cover` (its own `viewport` metadata in `src/app/portal/layout.tsx`), which is what makes `env(safe-area-inset-*)` report the device insets. The bottom tab bar adds `env(safe-area-inset-bottom)` to its padding and the content adds the same value to its bottom padding, while the sticky header uses `env(safe-area-inset-top)`, so nothing sits under the home indicator or a notch. Other routes keep the default viewport.

The core content column is `--lebar-konten-portal` (480px) in `globals.css`; the header, the page content, and the tabs' inner row all use it with `mx-auto`, so they stay perfectly aligned and centred from 768px upward while filling the screen on phones.

Every portal screen starts with `LayarPortal` (`src/components/layar-portal.tsx`): the "Portal Wali" label, the page title, a short description, and a `role="status"` line that announces what changed, plus an optional slot above the title. Screens add only their own content below it.

The portal component sizes and the payment-status pastels are tokens in `globals.css` too (`--tinggi-bilah-tab`, `--ukuran-ikon-tab`, `--radius-kartu-portal`, `--tinggi-aksi-portal`, `--radius-aksi-portal`, `--target-sentuh-portal`, `--tinggi-progres-portal`, and `--status-lunas|belum|terlambat-latar|garis|teks`). The status colours are `color-mix` blends over `--card`/`--primary`/`--muted`, so they follow light and dark automatically and keep at least 4.5:1 for their label text; change the component metrics here rather than in each screen.

Portal content sits in `KartuPortal` (`src/components/kartu-portal.tsx`): a section with the 16px radius token, the shared padding, an optional `h2` title with icon and badge, and an optional description. `ringkas` tightens the inner spacing for single-figure cards. The staff area keeps using the shadcn `Card`.

A screen's main action goes in `TombolAksiLengket` (`src/components/tombol-aksi-lengket.tsx`) with `<Button size="aksi">`: a sticky strip that floats just above the tab bar while the page scrolls and settles above the shell's bottom padding at the end, so it never hides content permanently. The `aksi` button size is the 48px / 12px-radius token pair.

`PenandaStatus` (`src/components/penanda-status.tsx`) renders the pastel payment pills for `lunas`, `belum`, and `terlambat`, styled only from the `--status-*` tokens and always carrying the status word next to its icon. `statusPembayaran()` in `src/lib/tagihan.ts` decides which of the three applies to an invoice: paid, unpaid within the running period, or unpaid past its period.

`BarProgres` (`src/components/bar-progres.tsx`) draws the 8px progress bar (`--tinggi-progres-portal`) with its percentage always spelled out, and exposes the value through `role="progressbar"`; values outside 0–100 are clamped.

Form fields keep the label above the control through `IsianTeks`, `IsianTeksPanjang`, and `IsianPilih` (`src/components/isian-form.tsx`). The portal passes `ukuran="sentuh"`, which lifts the control to the 48px touch target (`--target-sentuh-portal`) and keeps its text at 16px on every width so phones do not zoom when a field is focused; without it the staff forms keep their current 36px controls.

The base's welcome and blank app pages are replaceable. Reuse auth, setup, database, and UI when adding dashboard or chatbot features. Do not put feature conditionals throughout the base: create a derivative and implement that app directly.

## Dependency compatibility

TypeScript 5.9 and ESLint 9 are pinned to the versions accepted by the Next.js lint plugins. shadcn/ui's current CLI uses the `cn` utility package; `src/lib/utils.ts` exposes that same helper to application code. The `@esbuild-kit/core-utils` override updates Drizzle Kit's legacy nested esbuild dependency to the patched 0.25.12 release. Verify migration generation and setup whenever changing that override.
