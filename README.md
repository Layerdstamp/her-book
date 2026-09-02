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

`data/record.json` is the shared copy. The page reads it on load and every 45
seconds, and merges it with whatever is in the browser.

**Reading needs nothing.** The repository is public, so anyone you send the
link to sees the current record immediately, with no account and no setup.

**Writing needs a token**, once per device:

1. On GitHub go to **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Point it at **`Layerdstamp/her-book` only**.
3. Give it exactly one permission: **Repository permissions → Contents →
   Read and write**.
4. Open the site, tap **Backup**, paste it in, tap **Save token**.

The token is kept in that browser's `localStorage` and is never written into
the record, so sharing the link never shares your token. A device without one
still works — it just shows a read-only bar and keeps your entries local.

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
.nojekyll           stops GitHub Pages running the files through Jekyll
```
