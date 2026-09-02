# Deploying the optional API

The site itself needs no deploying — GitHub Pages publishes `index.html`
straight from the `main` branch on every push.

This document is only about `api/`, the Cloudflare Worker that gives you one
shared record across devices and a read-only link for a sitter. Skip it
entirely if you're happy with the record living on one phone.

You need to be logged into Cloudflare (`npx wrangler login`).

## Already done

The D1 database exists and the `records` table is created. **Do not run
`db:init`** — it is there for setting this up somewhere new.

    Database: puppy-record
    ID:       24bbaf67-27b8-4ad6-ae90-68f626353c3a   (already in wrangler.jsonc)

## 1. Check the CORS allowlist

`api/wrangler.jsonc` must name the origin the page is served from, or the
browser blocks every call. It should already read:

    "ALLOWED_ORIGINS": "https://layerdstamp.github.io,https://her-book.pages.dev"

An origin is scheme + host, no path and no trailing slash — so it is
`https://layerdstamp.github.io`, not `.../her-book/`.

## 2. Deploy

    cd api
    npm install
    npm run deploy

Save the Worker URL it prints. It looks like
`https://puppy-record-api.<subdomain>.workers.dev`.

## 3. Create the record

Open the site, tap **Backup**, paste the Worker URL into *API base URL*, then
tap **Create a record**. It stores the id and owner token on that device and
shows you the view token once — save it, that's the sitter's.

To do it by hand instead:

    curl -X POST <WORKER_URL>/v1/records -H "content-type: application/json" -d "{}"

Returns `id`, `ownerToken` and `viewToken`. Save all three.

## 4. Connect your other devices

On each device: **Backup** → enter the Worker URL, the record id, and the
**ownerToken** → Save → Sync now.

Give a sitter the same URL and id but the **viewToken**. They can read
everything and add entries; they cannot delete.

## Tokens

The page is public, so the tokens are the only thing protecting the record.
Keep the ownerToken private. They are stored per device and never travel
inside the shared document, so handing someone the record does not leak them.

To rotate: create a new record, import your exported backup into it, and stop
using the old id.
