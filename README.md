# Her Book

A lifelong care record for one Giant Schnauzer — vaccine checklist, weight and
feeding logs, health log, a sitter care sheet, and the whole of her breeder's
book written up and sourced.

**Open it: https://layerdstamp.github.io/her-book/**

Everything lives in this repository. The page is `index.html`, the record is
[`data/record.json`](data/record.json), and GitHub is the only thing it talks
to — no server, no database, no third party.

## What's in it

| Tab | |
|---|---|
| **Home** | Current life stage, weight log, settling-in checklist |
| **Vaccines** | Everything the kennel gave, what's still due, and a checklist that runs to 24 months |
| **Feeding** | Her current plan, a feeding log, and how much to feed by age |
| **Log** | Health log by category and concern level — copies out formatted for a vet |
| **Care** | The sitter handoff sheet. Fill in once, then copy or print it |
| **Guide** | The breeder's book, cited, plus grooming, growth plates, breed health and the AKC standard |

A **Bloat** button sits on every screen. It is the emergency this breed dies
of, and it is one tap away on purpose.

## How saving works

`data/record.json` is the shared copy. The page reads it on load, when you come
back to the tab, and on a timer, then merges it with whatever is in the browser.

**Reading needs nothing.** The repository is public, so anyone you send the
link to sees the current record immediately, with no account and no setup.

**Writing needs either a shared phrase or a token.**

The quick way, once someone has set it up: open the site, tap **Backup**, enter
the phrase, done. That device can now save permanently. No GitHub account, no
setup. Give someone the link only and they can read but not change anything —
which is exactly what a sitter should have.

The phrase works because the write token is encrypted under it and the
ciphertext is committed as `data/auth.json`. A static page has nowhere to keep
a secret, so the secret is published in a form only the phrase opens. The
phrase is generated rather than chosen — 80 bits, and PBKDF2 at 600,000
iterations on top — because a phrase someone invented would be guessable
offline against a public file.

To set that up you first need a token of your own, once per device:

1. On GitHub go to **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Point it at **`Layerdstamp/her-book` only**.
3. Give it exactly one permission: **Repository permissions → Contents →
   Read and write**.
4. Open the site, tap **Backup**, paste it in, tap **Save token**.

The token is kept in that browser's `localStorage` and is never written into
the record, so sharing the link never shares your token. A device without one
still works — it just shows a read-only bar and keeps your entries local.

Reads go through the GitHub API rather than `raw.githubusercontent.com`,
because raw serves a five-minute cache and would show a sitter stale entries.
That costs budget: 5,000 calls an hour with a token, 60 per address without
one. So the page polls every 45 seconds when it can write and every 90 when it
can't, which is also the minimum gap between automatic reads. If a network does
run out, it falls back to the cached copy and says so in the bar at the top.

Once you have a token, **Backup → Create a phrase** generates one and publishes
your token sealed under it. Treat the phrase like a key: anyone who has it can
edit her record, and replacing it does not lock out someone who already used
the old one on their device.

Each save is a commit, so the page waits about six seconds after you stop
typing before writing. Two people editing at once is handled by the Contents
API's compare-and-set: a write carries the blob sha it was based on, GitHub
refuses a stale one, and the page pulls, merges and writes again.

Underneath that, conflicts resolve per field rather than per document, so two
people editing different things never overwrite each other. Scalars carry a
timestamp, list items merge by id, and deletes are tombstones so a merge can't
resurrect them.

## Read-only is the sitter mode

Whoever has the link can read everything and type into the page, but without a
token nothing they add leaves their browser. If you want a sitter's notes to
come back to you, they need a token of their own — which means write access,
so only give one to someone you'd trust with the repository.

## Privacy

**This repository is public, and so is the record.** Her vet, your phone
numbers, the health log and anything else typed into the app are readable by
anyone, and every version stays in the commit history even after you delete
it. Treat the whole record as published. `.gitignore` blocks exported backup
files from being committed by accident.

## Running it locally

```bash
start index.html
```

Opened as a file it can't work out which repository to use, so the Backup
sheet grows an owner/repository/branch box. Fill that in and it syncs from
there too.

## Layout

```
index.html          the whole app — no build step, no dependencies
data/record.json    the record; the page reads and writes this
data/symptoms.json  the symptom index — 127 conditions, every one sourced
data/auth.json      the write token, sealed under the shared phrase (created on demand)
.nojekyll           stops GitHub Pages running the files through Jekyll
```
