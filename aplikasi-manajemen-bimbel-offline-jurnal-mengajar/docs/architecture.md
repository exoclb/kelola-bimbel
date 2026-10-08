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

The global theme owns two primitive ramps: brand green (`--brand-50` … `--brand-900`, where `--brand-500` is `#83B520`) and neutral slate (`--slate-50` … `--slate-900`). Both are absolute values shared by every theme and are exposed to Tailwind as `bg-brand-*`, `text-slate-*`, `border-slate-*`, and gradient steps. The light canvas is the slate-50 `#F8FAFC` mapped onto `--background`; dark mode re-points the semantic tokens (`--background`, `--card`, `--border`, `--muted-foreground`) at darker slate steps rather than redefining the ramps, and sets `color-scheme` so native controls follow. `--muted-foreground` is chosen per theme so secondary text keeps at least 4.5:1 against the canvas, card, and muted surfaces (slate-600 in light, slate-300 in dark). The brand ramp also drives the action colour: `--primary` points at `--brand-700` in light and `--brand-500` in dark, with `--primary-foreground` picking the matching label colour (white on light, slate-900 on dark), so `bg-primary` buttons and the `bg-primary/10 … text-primary` status pills stay above 4.5:1 in both themes. Destructive actions use `--destructive` with `--destructive-foreground`. Choose the brand step per theme when you need brand-coloured text instead of using the mid scale blindly.

The type scale is declared in full in `globals.css` so every page shares one set of steps: `--text-3xs` (10.5px, bottom tab labels), `--text-2xs` (11px, dense captions) through `--text-6xl`, with `xs`/`sm`/`base` for body copy. Pages follow the same roles — page titles use `text-3xl font-semibold tracking-tight sm:text-4xl` (30px, 36px from `sm`), page lead paragraphs use `text-base text-muted-foreground`, section headings use `text-xl`, and dense UI labels use `text-xs` or `text-2xs`. Avoid arbitrary sizes such as `text-[11px]`; add a scale step instead. The marketing landing page is the only place that may step up to the display sizes.

Spacing follows one rhythm: `--spacing` is 4px, so every Tailwind step (`p-1`, `gap-2`, `mt-4`, …) is a multiple of it across both the staff area and the portal. The radius tokens carry the design roles rather than raw values — `rounded-lg` is the 12px control/CTA radius and `rounded-xl` is the 16px card radius.

Control boundaries use their own `--input` token (slate-500 in light, slate-400 in dark) instead of the lighter `--border` kept for card dividers, so form outlines clear the 3:1 non-text contrast rule (4.76:1 and 3.33:1 measured against their own backgrounds).

Focus is part of the token system: `*:focus-visible` in `globals.css` draws a 2px `--primary` outline with a 2px offset for links and any element without its own ring, while the shadcn primitives keep their 3px ring in the (solid) `ring` colour. Both stay at or above 3:1 against the light and dark canvas, so keyboard focus is always visible, and the skip link grows to a 48px target when it receives focus.

Motion stays within 150–200ms (Tailwind's default transition duration) and covers colour, shadow, and transform props rather than layout ones. `prefers-reduced-motion: reduce` collapses every CSS animation and transition through one rule in `globals.css`, and JS animation follows `MotionConfig reducedMotion="user"` in `src/components/providers.tsx`.

The portal shell is the only place that opts into `viewport-fit=cover` (its own `viewport` metadata in `src/app/portal/layout.tsx`), which is what makes `env(safe-area-inset-*)` report the device insets. The bottom tab bar adds `env(safe-area-inset-bottom)` to its padding and the content adds the same value to its bottom padding, while the sticky header uses `env(safe-area-inset-top)`, so nothing sits under the home indicator or a notch. Other routes keep the default viewport.

The core content column is `--lebar-konten-portal` (480px) in `globals.css`; the header, the page content, and the tabs' inner row all use it with `mx-auto`, so they stay perfectly aligned and centred from 768px upward while filling the screen on phones.

Every portal screen starts with `LayarPortal` (`src/components/layar-portal.tsx`): the "Portal Wali" label, the page title, a short description, and a `role="status"` line that announces what changed, plus an optional slot above the title. Screens add only their own content below it.

The portal component sizes and the payment-status pastels are tokens in `globals.css` too (`--tinggi-bilah-tab`, `--ukuran-ikon-tab`, `--radius-kartu-portal`, `--tinggi-aksi-portal`, `--radius-aksi-portal`, `--target-sentuh-portal`, `--tinggi-progres-portal`, and `--status-lunas|belum|terlambat-latar|garis|teks`). The paid pill keeps a darker brand step for its label in light mode (brand-800) and the lighter one in dark (brand-500), so the label clears 4.5:1 against its own pastel. The status colours are `color-mix` blends over `--card`/`--primary`/`--muted`, so they follow light and dark automatically and keep at least 4.5:1 for their label text; change the component metrics here rather than in each screen.

Portal content sits in `KartuPortal` (`src/components/kartu-portal.tsx`): a section named after its title, so screen readers can jump between the cards as regions, with the 16px radius token, the shared padding, an optional `h2` title with icon and badge — the badge sits beside the heading, not inside it, so headings stay short — and an optional description. `ringkas` tightens the inner spacing for single-figure cards. The staff area keeps using the shadcn `Card`.

A screen's main action goes in `TombolAksiLengket` (`src/components/tombol-aksi-lengket.tsx`) with `<Button size="aksi">`: a strip pinned just above the tab bar that stays visible on short and long pages alike and reserves its own height at the end of the content, so it never hides the last card. The `aksi` button size is the 48px / 12px-radius token pair.

Beranda greets the wali by name (the page title is the greeting), then summarises the chosen child in one card: name, class, linked wali, the nearest invoice status, and compact figures for attendance, teacher notes, and the unpaid total. Below it sit a shortcut card of three 96px tiles (Jadwal, Tagihan, Progres, each carrying the child in the `anak` query parameter) and the attendance, nearest-invoice, and progress-highlight detail cards. The child picker sits directly under the title and swaps every card in place (local state, no URL round-trip); the other screens keep the chosen child in `?anak=`. The "Baru" badge from `jejak_baca_portal` marks attendance on the card header, the nearest invoice next to its amount, and only the newest development note, so the wali sees exactly what arrived since the last visit.

Every portal read is scoped by the `wali_murid` link: the server pages load the signed-in wali's children only and the portal endpoints filter the link in SQL, so an `?anak=` id that is not linked shows an empty state (and 404 from the API) instead of another family's data. The e2e suite covers that isolation both ways between two wali accounts.

The five portal screens are `/portal` (Beranda), `/portal/jadwal`, `/portal/tagihan`, `/portal/perkembangan` (Progres), and `/portal/akun`, each using `LayarPortal` and `KartuPortal`. Jadwal reads the child's class schedules through `listJadwalAnak()` in `src/services/portal.service.ts` and lists today's sessions first, marked with the brand accent so the running day stands out ("Hari ini · <hari>", with an explicit "no sessions today" line plus the next session in the week when empty) followed by the remaining days of the week — each card carrying that day's date within the running week — so today is never buried in the weekly list. Every session panel spells out the time with its duration ("1 jam 30 menit"), the class, the room (the branch), and the teacher; today's sessions also carry a pastel pill — "Berlangsung" while the session is running, "Berikutnya" for the nearest one that has not started yet — driven by the device clock so a server in another timezone cannot mislabel them. Sessions whose schedule was added since the start of the running week carry a "Baru" badge — the `schedules` table has no change history, so a newly added schedule is the change signal available; real change tracking would need an audit column. The day comes from the device clock (`useTanggalPerangkat`), with the server's date only used for the first paint so a UTC server cannot shift "today" for users in Indonesia; Akun opens with an identity card that reuses the shared user chip (initials, name, email, role badge); the portal header keeps only the initials so the bimbel name is never clipped on narrow phones, then the linked children and the display preference (which reports the theme actually in use, following the device when set to "ikut perangkat"), and keeps the sign-out action in the bottom strip; Tagihan opens with `RingkasanTagihanAnak` (`src/components/ringkasan-tagihan-anak.tsx`) — total, paid, unpaid, and the latest status for the chosen child — above the monthly invoice cards, and wraps that block (`#bukti-tagihan-anak`) in a sticky action strip: "Cetak / simpan PDF" prints the block from the browser, while "Unduh bukti tagihan" is a link to `GET /api/portal/tagihan/bukti?anak=…`, which streams the same details as a standalone HTML document with the bimbel letterhead. The portal header, tab bar, action strip, child picker, and screen-only notes are all `print:hidden` on the Tagihan screen, so printing a proof leaves the summary and the invoice list alone. When the account has no linked child, or the `?anak=` id is not linked to it, the screen shows an empty-state card instead — with a button back to the linked child — and no proof action, so nothing is exported for an empty list.

All small badges — the payment pill, the "Baru" badge, the session-state pill, and neutral captions like the attitude tag — share one base (`KELAS_PIL` / `PilPortal` in `src/components/pil-portal.tsx`), so every pill in the portal has the same padding, radius, and text size.

`PenandaStatus` (`src/components/penanda-status.tsx`) renders the pastel payment pills for `lunas`, `belum`, and `terlambat`, styled only from the `--status-*` tokens and always carrying the status word next to its icon. `statusPembayaran()` in `src/lib/tagihan.ts` decides which of the three applies to an invoice: paid, unpaid within the running period, or unpaid past its period.

`student_invoices` has no due-date column, so `jatuhTempoTagihan()` in the same module derives it as the last day of the invoice's period — exactly the boundary `menunggak()` already uses — and the portal prints "Jatuh tempo …" for unpaid invoices and "Dibayar …" for settled ones. A real due-date column would replace that helper.

`BarProgres` (`src/components/bar-progres.tsx`) draws the 8px progress bar (`--tinggi-progres-portal`) with its percentage always spelled out, and exposes the value through `role="progressbar"`; values outside 0–100 are clamped. The Progres screen uses it for attendance (sessions attended) and the average score, each paired with its figure; below those figures it charts the last six scores as bars with their percentages — and a single empty-state card (instead of both sections) when the child has no evaluations yet — lists each teacher evaluation as a card grouped by month, with that month's count and average in the group heading (score, attitude, date, teacher, note, newest first) and then the per-session attendance recap.

Form fields keep the label above the control through `IsianTeks`, `IsianTeksPanjang`, and `IsianPilih` (`src/components/isian-form.tsx`). The portal passes `ukuran="sentuh"`, which lifts the control to the 48px touch target (`--target-sentuh-portal`) and keeps its text at 16px on every width so phones do not zoom when a field is focused; without it the staff forms keep their current 36px controls.

Every portal control — tab, action strip, card action, form field, and header link — is at least 48px tall, and the screens were checked in both themes for horizontal overflow, contrast, and tap size from 320px (below the 360px target, to catch narrow phones) up to 1024px. The staff journal form (`JurnalForm`, schedule picker, attendance list, and material picker) follows the same 48px sizing so teachers can fill it from a phone; its attendance checkbox keeps the 24px minimum with a 48px row label around it. The teacher attendance screens (`presensi-guru` list, session detail, and history) use the same sizes for the per-session actions and the save button, and so do the journal confirmation card and the journal history screen (`daftar-riwayat-jurnal`, including its class and date filters). The class and student management screens (`/app/kelas`, `/app/murid`, the shared `KolomPencarian`, and the placement panel they embed) follow the same rule: 48px buttons and fields, with the schedule-delete icon keeping a 24px mark but a 44px hit area so the schedule chips stay compact.

The Akun screen's display preference stores `portal-tema` (`sistem`, `terang`, or `gelap`) in the browser through `src/lib/tema-portal.ts`. A small inline script in the portal layout applies the stored choice before the first paint, `TemaPortal` keeps `sistem` in step with the device and clears `dark` when the visitor leaves the portal, so the staff area keeps its current appearance.

The base's welcome and blank app pages are replaceable. Reuse auth, setup, database, and UI when adding dashboard or chatbot features. Do not put feature conditionals throughout the base: create a derivative and implement that app directly.

## Dependency compatibility

TypeScript 5.9 and ESLint 9 are pinned to the versions accepted by the Next.js lint plugins. shadcn/ui's current CLI uses the `cn` utility package; `src/lib/utils.ts` exposes that same helper to application code. The `@esbuild-kit/core-utils` override updates Drizzle Kit's legacy nested esbuild dependency to the patched 0.25.12 release. Verify migration generation and setup whenever changing that override.
