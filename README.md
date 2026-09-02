# Her Book

A lifelong care record for one Giant Schnauzer — vaccine checklist, weight and
feeding logs, health log, a sitter care sheet, and the whole of her breeder's
book written up and sourced.

**Live: https://layerdstamp.github.io/her-book/**

It is one self-contained HTML file. No build step, no framework, no bundler.
Open `index.html` from anywhere — a phone, a laptop, a USB stick — and it works
exactly the same as the hosted copy.

## What's in it

| Tab | |
|---|---|
| **Home** | Current life stage, weight log, settling-in checklist |
| **Vaccines** | Everything the kennel gave, what's still due, and a checklist that runs to 24 months |
| **Feeding** | Her current plan, a feeding log, and how much to feed by age |
| **Log** | Health log by category and concern level — copies out formatted for a vet |
| **Care** | The sitter handoff sheet. Fill in once, then copy or print it |
| **Guide** | The breeder's book, cited, plus grooming, growth plates, breed health and the AKC standard |

A **Bloat** button sits on every screen. It is the emergency this breed dies of,
and it is one tap away on purpose.

## Where the data goes

Nothing leaves the browser unless you connect the optional API.

1. **`window.storage`** — used when the file runs somewhere that provides it.
   Everyone opening the record reads and writes the same copy.
2. **`localStorage`** — the fallback, and what the GitHub Pages site uses.
   Saved on that device, in that browser, only.
3. **Memory** — last resort. The app puts a warning bar at the top telling you
   to export a backup before closing the tab.

Conflicts resolve per field rather than per document, so two people editing
different things never overwrite each other. Scalars carry a timestamp, list
items merge by id, and deletes are tombstones so a merge can't resurrect them.

**Because Pages hosting falls back to `localStorage`, the record does not
follow you between phones on its own.** Two ways to move it:

- **Export / Import** in the Backup sheet. Import *merges* rather than
  replaces, so restoring an old file can't wipe someone else's entries.
- **Deploy the API** in [`api/`](api/) and connect it. That gives you one
  shared record across devices plus a read-only link for a sitter.

## Running it locally

Just open the file:

```bash
start index.html
```

Or serve it, if you want a real origin:

```bash
npx serve .
```

## The optional API

[`api/`](api/) is a Cloudflare Worker backed by D1. It is not needed for the
app to work and GitHub Pages cannot host it — it deploys separately. See
[`api/README.md`](api/README.md) for the endpoints and
[`DEPLOY.md`](DEPLOY.md) for the steps.

One thing to know: the Worker's CORS allowlist has to name this site's origin
or the browser will block every call. It is already set in
`api/wrangler.jsonc`:

```
"ALLOWED_ORIGINS": "https://layerdstamp.github.io,https://her-book.pages.dev"
```

An origin is scheme + host with no path, so it is
`https://layerdstamp.github.io` even though the site lives at
`/her-book/`. Redeploy the Worker after changing it.

## Layout

```
index.html          the whole app
.nojekyll           stops GitHub Pages running the file through Jekyll
DEPLOY.md           deploying the optional API
api/                Cloudflare Worker + D1 (optional)
  src/worker.js     the API
  schema.sql        one table, two indexes
  wrangler.jsonc    bindings and the CORS allowlist
  test.mjs          endpoint tests
```

## A note on privacy

The page is public and so is this repository. Her date of birth and microchip
number are written into `index.html`, and anything typed into the app on a
device stays in that browser — but anything committed here is visible to
everyone. Don't commit an exported backup.
