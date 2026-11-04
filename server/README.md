# Source Jar — Backend

Backend API for Source Jar. Node.js 22+ / TypeScript, Fastify, SQLite via `better-sqlite3`
(no ORM). `index.html` (the frontend) is untouched by this backend.

## Setup

```bash
cd server
npm install
cp .env.example .env
npm run seed    # parses index.html's JARS array into SQLite
npm run dev     # starts the API on http://localhost:8787 (watch mode)
```

## Scripts

| Script          | Purpose                                                              |
|------------------|-----------------------------------------------------------------------|
| `npm run dev`    | Start the API in watch mode (tsx)                                     |
| `npm run build`  | Compile TypeScript to `dist/`                                         |
| `npm start`      | Run the compiled server (`dist/src/server.js`)                        |
| `npm test`       | Run the vitest suite                                                   |
| `npm run seed`   | Parse `../index.html`'s `JARS` array and upsert jars + tools           |
| `npm run sync`   | Enrich tools with GitHub stars / last commit date (needs `GITHUB_TOKEN`) |

## Environment variables

See `.env.example`:

- `PORT` — API port (default `8787`)
- `CORS_ORIGIN` — an additional allowed CORS origin, besides `http://localhost:5173`
- `ADMIN_TOKEN` — bearer token required on `/api/admin/*` routes
- `GITHUB_TOKEN` — optional GitHub token used by `npm run sync` to raise rate limits and fetch
  private-ish metadata; without it, `npm run sync` logs a message and does nothing
- `DB_PATH` — path to the SQLite file (default `./data/sourcejar.db`; `.env`/`data/` are gitignored)

## Data model

- **jars**: `id, name, kind, color, dark, light, lid, sort_order`
- **tools**: `slug (unique), name, short_label, jar_id, license, license_family, description, url, repo_url, stars, last_commit_at, seed_order, created_at, updated_at`
- **suggestions**: `id, name, url, repo_url, jar_id, description, license, submitter_note, status, created_at`

`license_family` is derived from the raw `license` string, checked in this order: contains
`"GPL"` → `GPL family`; starts with `"MIT"` → `MIT`; contains `"Apache"` → `Apache-2.0`; contains
`"BSD"` → `BSD family`; contains `"MPL"` → `MPL-2.0`; otherwise → `Other`.

`seed_order` preserves each tool's original position within its jar's `tools` array from
`index.html`, so `GET /api/jars/:id/tools` returns a stable order for the frontend's
12-at-a-time bread layout.

## Seeding

`npm run seed` finds the `const JARS = [ ... ];` block in `../index.html` by bracket-matching
(not a full JS parse — only that array literal is evaluated), then upserts all 5 jars and 60
tools by primary key (`jars.id`, `tools.slug`), so running it repeatedly is idempotent and never
duplicates rows.

## GitHub enrichment

`npm run sync` fills in `repo_url`, `stars`, and `last_commit_at` for every tool:

- If a tool's `url` is already a `github.com/<owner>/<repo>` link, that's used directly.
- Otherwise it looks up the tool's slug in the hand-maintained map at `src/repo-map.ts`.
- **Debian** is intentionally left out of that map — it has no single canonical GitHub repo to
  attach stars/commits to (its packages are mirrored from Salsa across many separate source
  packages). Everything else in all 5 jars is mapped.
- A handful of the mapped repos (e.g. Inkscape, Thunderbird) are best-effort GitHub *mirrors* of
  projects whose primary development happens elsewhere (GitLab, Mercurial, etc.); if GitHub
  returns a 404 for one of these, that tool is just skipped and counted — the run doesn't fail.
- Without `GITHUB_TOKEN` set, the script logs a message and exits without making any requests.
- If GitHub starts rate-limiting (403 + `x-ratelimit-remaining: 0`), the script stops cleanly and
  reports how many tools it managed to update before stopping.

## API

All routes are JSON, under `/api`. See the task spec / frontend contract for the full shape;
in short:

- `GET /api/health`
- `GET /api/jars`
- `GET /api/jars/:id/tools`
- `GET /api/tools` (`q`, `jar`, `licenseFamily`, `sort`, `page`, `limit`)
- `GET /api/tools/:slug`
- `GET /api/licenses`
- `GET /api/stats`
- `POST /api/suggestions` (rate-limited to 5/IP/hour)
- `GET /api/admin/suggestions?status=pending` — requires `Authorization: Bearer <ADMIN_TOKEN>`
- `POST /api/admin/suggestions/:id/approve` — requires admin auth
- `POST /api/admin/suggestions/:id/reject` — requires admin auth

Errors are always `{ "error": "..." }` (validation errors on `POST /api/suggestions` also include
a `fields` map), with no stack traces ever sent to the client.

## Tests

```bash
npm test
```

Covers: seed parsing (5 jars / 60 tools, idempotent reseed, stable per-jar order), the
`license_family` classification rules (including rule priority), search/filter/sort/pagination
on `/api/tools`, suggestion validation + duplicate-URL rejection + rate limiting, and admin auth
+ the approve/reject workflow.
