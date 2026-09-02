# Puppy Record API

A Cloudflare Worker + D1 backend for `index.html`. Optional — the guide works
fully offline without it. Deploy this only if you want the same record on more
than one device, or a read-only copy you can hand to a sitter.

## What it does

One record per dog. Each record has two bearer tokens:

| Token | Can do | Give it to |
|---|---|---|
| `ownerToken` | read + write | nobody — this is yours |
| `viewToken` | read only | a sitter, kennel, family member |

Writes use compare-and-set on `updatedAt`. If two devices edit at once, the
stale write gets a `409` plus the current server copy, and the app merges
instead of silently clobbering.

## Endpoints

```
POST   /v1/records          create a record, returns both tokens (once)
GET    /v1/records/:id      read   — owner or view token
PUT    /v1/records/:id      write  — owner token only
DELETE /v1/records/:id      delete — owner token only
GET    /v1/health           liveness
```

Auth is `Authorization: Bearer <token>`. `GET` also accepts `?token=` so a
read-only link can be opened directly.

## Deploy

You need Node 18+ and a Cloudflare account. From this folder:

```bash
npm install

# 1. create the database — this prints a database_id
npx wrangler d1 create puppy-record

# 2. paste that id into wrangler.jsonc, replacing
#    PASTE_YOUR_D1_DATABASE_ID_HERE

# 3. create the table
npm run db:init

# 4. ship it
npm run deploy
```

Deploy prints your Worker URL, something like
`https://puppy-record-api.<your-subdomain>.workers.dev`.

## Connect the guide to it

1. Open `index.html`, tap **Backup** in the header.
2. Paste the Worker URL into **API base URL**.
3. Tap **Create a new record**. It uploads whatever is currently in the guide
   and fills in the record id and owner token for you.
4. A prompt shows the **view token**. Save it somewhere — it's the read-only
   one for sitters, and it isn't shown again.

On a second device, open the same file, enter the URL, the same record id, and
the owner token. To give someone read-only access, give them the URL, the record
id, and the **view** token instead.

## Lock down CORS

While testing, `ALLOWED_ORIGINS` is `*`. Once the guide lives at a fixed URL
(GitHub Pages, say), set it in `wrangler.jsonc` and redeploy:

```jsonc
"vars": { "ALLOWED_ORIGINS": "https://layerdstamp.github.io" }
```

Multiple origins are comma-separated. This does not protect the API on its own —
the tokens do that — but it stops other websites making requests with a token
that leaked into a browser.

## Tests

```bash
node test.mjs
```

17 cases against a stubbed D1: token roles, 401/403/404/405/409/413, CORS
preflight, and the stale-write conflict path. No network or Cloudflare account
needed.

## Costs

D1 and Workers both have free tiers far larger than one dog's records will ever
need. Expect this to cost nothing.
