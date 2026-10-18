# Fin

An offline expense tracker in an npm workspaces monorepo. Requires Node.js 22+.

- `apps/mobile`: Expo / React Native app, Drizzle + Expo SQLite, and the sync engine.
- `apps/server`: Hono API on Node.js, Drizzle + SQLite (`better-sqlite3`).
- `packages/shared`: shared Zod entity schemas and sync protocol.

## Code layout

- `apps/mobile/app/index.tsx` composes the three screens. The pager gesture
  lives in `hooks/use-screen-pager.ts`.
- `screens/main.tsx` owns expense, category, and payment actions. Its display
  sections live in `components/main-sections.tsx`, and sheet gestures live in
  `hooks/use-expense-sheet.ts`.
- `utils/analytics-summary.ts` calculates the period totals and chart data
  shown by `screens/analytics.tsx`.
- `data/db/repository.ts` owns local transactions and the outbox. The sync
  service schedules requests; the sync engine exchanges one batch with the server.
- `apps/server/src/app.ts` handles HTTP validation and authentication, while
  `store.ts` applies sync batches and serves paginated changes.

Run `npm run typecheck`, `npm test`, and `npm run lint` from the repository root
when changing shared data or screen behavior.

## Run locally

```sh
npm install
npm start                # Expo
npm run web              # Expo web dev server
npm run android          # Native Android development build
npm run ios              # Native iOS development build
```

The app stores expenses and categories locally without needing a server. On first
launch it migrates both historical AsyncStorage formats to SQLite, retaining the
original values as a recovery backup. Invalid historical data produces a load
error rather than being overwritten.

## Install on Android

Run `npx eas-cli@latest login` once, then `npm run build:android` from the
repository root. This runs EAS Build from `apps/mobile`, using its `eas.json`
preview profile to produce a standalone APK. Allow EAS to generate an Android
signing key if prompted. Open the finished build's installation link on your
phone, download the APK, and allow installation from your browser when Android
asks. The installed app does not require a development server.

Run other EAS commands from `apps/mobile`, not the repository root. To check
JavaScript bundling locally before a build, run
`npm exec --workspace @fin/mobile -- expo export --platform android`.

## Import and export

In **Settings → Your data**, export a versioned Fin JSON backup containing all
active expenses and categories, including currencies and payment reminder IDs.
Web downloads the file; Android and iOS open the system share sheet to save or
share it. Rebuild native apps after installing the new file picker/sharing modules.

Import a Fin backup (up to 20 MB) to add missing records. Existing records and
deletions are preserved, and duplicate IDs or payment reminders are skipped.
Invalid files are rejected before writing; both collections and their sync
operations commit together. Imported data refreshes the UI and participates in
normal sync. Backups contain your financial data in plain text; connection tokens
and pending Google Pay reminders are not included.

## Start the Hono sync backend

```sh
cp .env.example apps/server/.env
openssl rand -hex 32
```

Put the generated secret in `SYNC_TOKEN` in `apps/server/.env`, then run:

```sh
npm run sync:server
```

In **Settings → Offline & sync**, connect to `http://localhost:3001` with that
secret. Android emulators use `http://10.0.2.2:3001` (set `HOST=0.0.0.0` for emulator
access). Physical devices need an HTTPS endpoint reachable from the device.
Set `SYNC_ALLOWED_ORIGIN` to the actual browser origin for cross-origin web sync.

This backend serves **one private dataset**. Every device with its bearer token
shares that data; it is not a multi-user account service. Use HTTPS outside local
development and keep the secret on the server and in the app's connection panel.
Native tokens use SecureStore; web tokens use local browser storage.

`POST /sync` accepts `{ cursor, operations }` and returns
`{ cursor, acknowledged, changes, hasMore }`. `GET /health` reports health.
Requests are authenticated, size limited, and validated using shared schemas.
Keep the SQLite file on persistent disk and back it up together with its receipts
and deletion tombstones. Default location is `apps/server/server-data/fin.db`.
Changing/restoring a server database may require disconnecting and reconnecting.
Disconnecting leaves all local data intact; connecting merges local data into the
selected server, including existing deletion tombstones.

## Offline and sync behavior

Each local edit and its outbox operation commit in the same SQLite transaction.
The UI reads the local database, so network errors never block saving. Sync runs
on launch, local edits, connectivity restoration, app foregrounding, and a timer.
Failures retry with exponential backoff (up to 60 seconds); manual sync is available
in Settings. Sync runs while the app is active; suspended native apps resume it
when opened again.

The server accepts operations idempotently and returns ordered, paginated changes.
Concurrent edits to the same record use **server acceptance order**: the last
accepted edit wins, without relying on device clocks. Edits made during an
in-flight request remain visible and queued. Deletions retain tombstones and old
operation receipts prevent retries from restoring deleted data. A later explicit
edit can restore a record. The server retains receipts and tombstones indefinitely.

## Production web / offline reloads

```sh
npm run build:web
```

Deploy `apps/mobile/dist` over HTTPS. The build generates a service worker that
precaches the app shell, JS worker, fonts, and SQLite WASM, allowing offline reloads
after the first successful online visit and cache installation. Development builds
do not install the service worker. SQLite persists in the browser's private file
storage; clearing site data removes it. Service worker updates activate after old
tabs close, keeping the running app and its cached assets on the same version.

The hosting server must send:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

The build includes a `_headers` file for hosts that support that format. Expo's
Metro development server also sends these headers. To serve the exported web UI
through Hono, set `WEB_DIST=../mobile/dist` in `apps/server/.env` and restart the
backend; Hono sends the required headers. The web build currently assumes hosting
at the origin root (`/`). Sync API requests are never cached by the service worker.

## Validation and schema changes

```sh
npm run typecheck
npm run lint
npm test
npm run build:web
```

Tests use real SQLite databases and the production repository, HTTP exchange, and
Hono handler to cover restarts, legacy migration, offline/reconnect, idempotent
retries, concurrent edits, tombstones, pagination, validation, and authentication.
A pinned `expo-sqlite@57.0.4` patch in `patches/` fixes the web worker result
length encoding and replaces its CPU-iteration timeout with an elapsed-time
timeout. `npm install` applies it automatically; a regression test checks the
length fix. Reassess this patch when upgrading Expo SQLite.

Native hardware verification is still needed after rebuilding with the SQLite,
network, and SecureStore dependencies.

Local schema is in `apps/mobile/data/db/schema.ts`; ordered runtime migrations
are in `apps/mobile/data/db/migrations.ts`. Append a migration when changing the
schema. `npm run db:generate` generates Drizzle SQL for review; port that SQL into
a new runtime migration before shipping. Backend schema and migrations live in `apps/server/src/schema.ts` and
`apps/server/src/migrations.ts`. Backend SQL can be generated with
`npm run db:generate -w @fin/server`. Never change an already applied migration.

## Google Pay payment reminders (Android)

Build and install with `npm run android` (Android SDK and JDK required). The local
Expo module in `apps/mobile/modules/google-pay` is autolinked into native Android builds;
it cannot run in Expo Go, iOS or web.

In the app's Settings page, enable Google Pay reminders, allow Fin notifications,
and grant notification access to **Fin Google Pay payment reminders**. After a
matching outgoing Google Pay/Wallet notification, Fin saves a pending payment and
posts a **Review payment** notification action. Tap it, review the prefilled
amount/date, choose a category, and save. Pending payments also appear on the main
screen and can be dismissed. Closing a draft leaves it pending. Disabling reminders
keeps pending drafts. Drafts remain until saved or explicitly dismissed, without a
queue-size expiry.

This uses Android notification access, not a Google transaction-history API. Google
Pay/Wallet packages and Wallet-identified or payment-channel notifications delivered
by Google Play services are processed. Matching alerts stay on-device; other apps' notification
contents are not stored. Detection supports English/German/Russian/French outgoing payment wording,
amount-at-merchant alerts, and merchant-title/amount-body alerts. ISO currency codes
(including CHF and PLN) and €, $, £, ₹, ₽ and ₴ are recognized. Three-decimal
currencies such as KWD retain their fractional amounts.
Payments without a readable matching notification cannot be detected. Failed
payments, refunds, requests, offers and alerts containing different amounts or
currencies are skipped. Repeated occurrences of the same amount/currency are accepted. Currencies are preserved and totals are shown separately by currency; older
expenses without a currency retain their separate total.

Verification on an Android device:

1. Create a category, enable reminders and grant both permissions.
2. Make a Google Pay payment that issues a matching Wallet notification.
3. Tap **Review payment** with Fin closed, then repeat with Fin open; check the
   amount/date/currency, category selection and persistence after restarting.
4. Check that dismissing or saving removes the pending reminder, and that a
   repeated notification update does not create another expense.
5. Disable reminders and confirm existing drafts remain and further payments do not create Fin reminders.
6. Deny Fin notification permission, make a payment, and confirm the draft persists. Restore permission and reopen Fin to check the reminder is retried.

The listener scans still-active Wallet alerts after reconnecting. Enable purchase
notifications in Google Wallet; Fin cannot detect a payment if Wallet never issues a
readable alert. Fin Settings also checks whether the payment notification channel is
blocked. It shows READY only when notification access, Fin notifications and the
live listener connection are all available. SETUP, BLOCKED and WAITING explain
incomplete setup, notification permissions and a disconnected listener. Use
Reconnect reminders to request a connection again.

Settings shows the last Google alert's time and capture outcome, last saved payment
time, and last reminder-posting outcome. Diagnostics store only timestamps and
outcome codes; rejected notification contents are not retained. If a payment is
saved but its reminder is blocked, restore notification permission and reopen Fin
or wait for a repeated alert to retry. Android accepting a reminder does not prove
that it displayed a banner or played a sound.

These changes include native Kotlin code: build and install an updated Android APK;
reloading JavaScript alone will not update capture behavior.

Android capture, persistence and parser tests: after
`npx expo prebuild --platform android`, run
`cd apps/mobile/android && ./gradlew :fin-google-pay:testDebugUnitTest`.
