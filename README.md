# Fin

An offline expense tracker in an npm workspaces monorepo. Requires Node.js 22+.

- `apps/mobile`: Expo / React Native app, Drizzle + Expo SQLite, and the sync engine.
- `apps/server`: Hono API on Node.js, Drizzle + SQLite (`better-sqlite3`).
- `packages/shared`: shared Zod entity schemas and sync protocol.

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
matching outgoing Google Pay/Wallet notification, Fin posts an **Add payment**
notification action. Tap it, review the prefilled amount/date, choose a category,
and save. Pending payments also appear on the main screen and can be dismissed.
Closing a draft leaves it pending. Disabling reminders deletes pending drafts.

This uses Android notification access, not a Google transaction-history API.
Only Google Pay/Wallet packages are processed. Matching alerts stay on-device;
other apps' notification contents are not stored. Detection currently supports
English/German outgoing-payment wording and EUR/USD/GBP/INR amounts. Payments
without a readable matching notification cannot be detected. Failed payments,
refunds, requests, offers and alerts containing multiple amounts are skipped.
Currencies are preserved and totals are shown separately by currency; older
expenses without a currency retain their separate total.

Verification on an Android device:

1. Create a category, enable reminders and grant both permissions.
2. Make a Google Pay payment that issues a matching Wallet notification.
3. Tap **Add payment** with Fin closed, then repeat with Fin open; check the
   amount/date/currency, category selection and persistence after restarting.
4. Check that dismissing or saving removes the pending reminder, and that a
   repeated notification update does not create another expense.
5. Disable reminders and confirm further payments do not create Fin reminders.

Parser unit tests: after `npx expo prebuild --platform android`, run
`cd apps/mobile/android && ./gradlew :fin-google-pay:testDebugUnitTest`.
