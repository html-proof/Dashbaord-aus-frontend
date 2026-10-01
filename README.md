# Storeboard — custom Shopify analytics dashboard

Users sign in (Google, Apple, email via **Firebase Auth**), connect one or more
**Shopify** stores, and build their own dashboards by **dragging and dropping** charts.
Data is stored in **PostgreSQL**. The dashboard **adapts automatically** to what the merchant
enables in Shopify: for example, entering "Cost per item" unlocks Profit/Margin widgets live.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · react-grid-layout 2 · Recharts 3 ·
Zustand · TanStack Query · Firebase Auth · PostgreSQL + Drizzle ORM · optional Upstash Redis.

## How it fits together

```
Browser ── Firebase sign-in ──► POST /api/session ──► httpOnly session cookie
   │                                                  (verified by firebase-admin)
   ├─ Builder (drag/drop grid) ── PATCH /api/dashboards/:id   (autosave)
   ├─ Widgets ─────────────────── POST  /api/query            (ids only, never SQL)
   └─ EventSource ─────────────── GET   /api/stream           (live updates, SSE)
                                         ▲
Shopify ── webhooks ──► /api/webhooks/shopify ──► upsert data ──► detectCapabilities()
        ◄─ GraphQL ─── sync (install, manual, hourly cron)          │ changed?
                                                                   ├► invalidate cache
                                                                   ├► auto-add widgets (opt-in)
                                                                   └► NOTIFY → SSE → browser
```

| Area | Where |
|---|---|
| DB schema (14 tables) | `src/db/schema.ts`, migration in `drizzle/` |
| Auth (Firebase → session cookie) | `src/lib/firebase-*.ts`, `src/lib/session.ts`, `src/app/api/session`, `src/proxy.ts` |
| Shopify OAuth / client credentials | `src/lib/shopify/oauth.ts`, `src/app/api/shopify/*` |
| Sync + webhooks | `src/lib/shopify/sync.ts`, `src/app/api/webhooks/shopify` |
| **Dynamic capabilities** | `src/metrics/capabilities.ts`, `src/lib/shopify/capabilities.ts` |
| Metrics + query engine | `src/metrics/registry.ts`, `src/lib/query.ts` |
| Widgets + templates | `src/widgets/types.ts`, `src/widgets/WidgetView.tsx` |
| Drag-and-drop builder | `src/builder/*` |
| Real-time events | `src/lib/events.ts` (Postgres LISTEN/NOTIFY), `src/app/api/stream` |

### Dynamic dashboard (the "enable profit later" case)

1. Every metric declares what it needs, e.g. `gross_profit` requires `data:product_cost`.
2. `detectCapabilities()` computes each store's capabilities from granted scopes and synced data,
   and stores them in `store_capabilities`.
3. It runs after every relevant webhook (`inventory_items/update` is where "Cost per item" arrives;
   also orders, products, `app/scopes_update`), after every sync, and hourly via cron.
4. When something changes, it invalidates cached queries, pushes `capabilities.changed` over SSE,
   and (if the user enabled it in Settings) auto-adds the matching widgets.
5. In the browser, locked metrics show a "how to enable" card with a link into Shopify admin or a
   "Grant access" button. They unlock in place with no reload. Profit is computed from current
   costs, so history is filled in immediately.

## Setup

### 1. PostgreSQL
Any Postgres 14+ (local, Neon, Supabase, Cloud SQL). Put its URL in `DATABASE_URL`.

### 2. Firebase (Firebase console)
1. Create a project → **Authentication → Sign-in method**: enable **Google**, **Apple**, and
   **Email/Password**.
   - Apple needs an Apple Developer account: create a Services ID + key, and add the Firebase
     callback URL shown in the console.
2. **Project settings → Your apps → Web app** → copy the config into the `NEXT_PUBLIC_FIREBASE_*` vars.
3. Set `FIREBASE_PROJECT_ID`. A service account key is **optional**: sign-in verifies Google-signed
   ID tokens with the project ID alone and uses its own signed session cookie (`SESSION_SECRET`).
   Add `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` only if you want sign-out to revoke tokens on all devices.
4. **Authentication → Settings → Authorized domains**: add your production domain.

### 3. Shopify app (Dev Dashboard / Partner dashboard)
1. Create an app. Copy **Client ID** → `SHOPIFY_CLIENT_ID` and **Client secret** → `SHOPIFY_CLIENT_SECRET`.
2. Allowed redirection URL: `{APP_URL}/api/shopify/callback`.
3. Compliance webhooks (set in the app configuration, all pointing to `{APP_URL}/api/webhooks/shopify`):
   `customers/data_request`, `customers/redact`, `shop/redact`.
4. For customer metrics, request **protected customer data** access. For orders older than
   60 days, request the `read_all_orders` scope and add it to `SHOPIFY_SCOPES`.

Connecting a store (Stores page):
- **Install app**: works for any merchant. It uses the OAuth flow with client ID, client secret, and shop domain.
- **Direct**: for stores in the same Shopify organization as the app. It uses the client-credentials
  grant (client ID + secret + shop domain, no install screen). Tokens refresh automatically.

### 4. Run
```bash
cp .env.example .env.local   # then fill it in
npm install
npm run db:migrate
npm run dev
```
Shopify must reach your webhooks and OAuth callback, so for local testing expose port 3000 with a
tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and use that URL as `APP_URL`.

### 5. Deploy (Vercel)
Set the same env vars in the project, run `npm run db:migrate` against the production DB, and deploy.
`vercel.json` schedules `/api/cron/sync` hourly (set `CRON_SECRET`).

## Tests
```bash
npm test                                              # unit tests
TEST_DATABASE_URL=postgres://… npm test               # + Postgres integration test of the
                                                      #   "cost entered → profit unlocks" flow
```

## Known limits / next steps
- Sync runs in `after()` inside the request (up to 300 s). For very large stores, move backfill to
  Shopify Bulk Operations + a queue (Vercel Queues).
- Metrics are aggregated on the fly from indexed tables and cached for 5 minutes (Redis if
  configured). Add rollup tables if stores grow to millions of orders.
- Workspaces support owner/editor/viewer roles in the schema. An invite UI is not built yet.
- Money values use the shop's currency. Multi-currency conversion is not implemented.
