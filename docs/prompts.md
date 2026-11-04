# Build prompts

Two prompts for splitting Source Jar into a backend and a frontend. Both share the same API contract so they connect without guesswork.

1. Run the **backend** prompt first (local Claude). Start its server with `npm run dev` in `/server`.
2. Then run the **frontend** prompt (Terra 6.1). It can also run in parallel: the frontend falls back to bundled data when the API isn't up.
3. Each commits to its own branch (`backend`, `frontend`) and waits for review before pushing.

Both start from what's already on `main`: `index.html` (the working site, which holds the 60 tools in its `JARS` array) and `README.md`.

---

## Prompt 1: Backend (local Claude)

```text
You're working in my repo EmperorKaido99/Source-Jar. Right now it's a single static
index.html: a website called Source Jar that shows open source software tools. The
visitor spreads a jar on a slice of bread and the tools appear in the spread. The
60 tools are hardcoded in a `JARS` array inside index.html's <script>.

Your job: build the BACKEND ONLY. Do not touch the visual design or the canvas code.
Another developer is building the frontend against the API contract below, so follow
it exactly.

## Stack and layout
- Node.js 22 + TypeScript, Fastify, SQLite via better-sqlite3. No ORM.
- Put everything in /server. Leave index.html where it is.
- Scripts: `npm run dev` (watch mode), `npm run build`, `npm start`, `npm test`,
  `npm run seed`, `npm run sync`.
- Port from the PORT env var, default 8787. Enable CORS for http://localhost:5173 and
  for the origin in the CORS_ORIGIN env var.
- Add /server/.env.example and a /server/README.md that explains setup.

## Data model
Table `jars`: id (text, e.g. "pb", "jam", "mustard", "guac", "cocoa"), name, kind,
color, dark, light, lid, sort_order.

Table `tools`: slug (unique, kebab-case), name, short_label (nullable, a short name
for the bread), jar_id, license (SPDX-style string as given), license_family (one of
MIT | Apache-2.0 | GPL family | BSD family | MPL-2.0 | Other), description (one line),
url, repo_url (nullable), stars (nullable int), last_commit_at (nullable),
created_at, updated_at.

Table `suggestions`: id, name, url, repo_url, jar_id, description, license,
submitter_note, status (pending | approved | rejected), created_at.

license_family rules, applied in this order: contains "GPL" → GPL family; starts with
"MIT" → MIT; contains "Apache" → Apache-2.0; contains "BSD" → BSD family;
contains "MPL" → MPL-2.0; anything else → Other.

## Seed
`npm run seed` parses the JARS array out of ../index.html (find the
`const JARS = [` ... `];` block and evaluate only that block), then upserts all 5 jars and
60 tools. Field mapping: n → name, s → short_label, lic → license, d → description,
url → url. Running it twice must not create duplicates.

## GitHub enrichment
`npm run sync` uses GITHUB_TOKEN (optional) to fill repo_url, stars and
last_commit_at. If the tool's url is a github.com repo, use it. Otherwise use a
hand-maintained map in /server/src/repo-map.ts (fill it in for all 60 tools, e.g.
linux → torvalds/linux, python → python/cpython). Handle rate limits by stopping
cleanly and saying how many were updated. With no token, skip and log a message.

## API contract (all JSON, all under /api)
GET  /api/health → { ok: true }

GET  /api/jars → [{ id, name, kind, color, dark, light, lid, toolCount }] in sort order

GET  /api/tools → paginated list
     query: q (search over name, description, license), jar, licenseFamily,
            sort = name | stars | recent (default name), page (default 1),
            limit (default 24, max 100)
     → { items: Tool[], page, limit, total }

GET  /api/tools/:slug → Tool, or 404 { error: "Tool not found" }

GET  /api/jars/:id/tools → Tool[] for that jar, in the original seed order
     (the frontend lays them out on the bread 12 at a time, so order must be stable)

GET  /api/licenses → [{ family, count }] across all tools

GET  /api/stats → { tools, jars, licenses: [{ family, count }], updatedAt }

POST /api/suggestions → body { name, url, jarId, description, license?, repoUrl?, note? }
     Validate: name 1–60 chars, url must be https, jarId must exist,
     description 10–140 chars. Reject a duplicate url that already matches a tool.
     → 201 { id, status: "pending" } or 400 { error, fields: { [field]: message } }
     Rate limit: 5 per IP per hour.

Admin routes need the header `Authorization: Bearer <ADMIN_TOKEN>`:
GET  /api/admin/suggestions?status=pending
POST /api/admin/suggestions/:id/approve → creates the tool and returns it
POST /api/admin/suggestions/:id/reject

Tool JSON shape (camelCase):
{ slug, name, shortLabel, jarId, license, licenseFamily, description, url,
  repoUrl, stars, lastCommitAt }

## Quality bar
- Validate every input with a schema (zod or Fastify JSON schema).
- Errors are always { error: string } with a correct status code. Never leak stack
  traces.
- Tests with vitest for: seed parsing (60 tools, 5 jars), license_family rules,
  search and filters, pagination, suggestion validation, and admin auth.
- No secrets in the repo. .env is gitignored.

When you're done, run the tests and the seed, start the server and curl each GET
endpoint once to show it works. Then summarize what you built and anything you
couldn't do. Commit on a branch called `backend` and don't push until I say so.
```

---

## Prompt 2: Frontend (Terra 6.1)

```text
You're working in my repo EmperorKaido99/Source-Jar. It's a website called
Source Jar for discovering open source software. Right now it's one file,
index.html. The page shows a slice of bread on a plate on a gingham tablecloth. The
visitor picks one of five jars (Peanut Butter, Strawberry Jam, Mustard, Guacamole,
Cocoa Hazelnut), drags a butter knife across the bread, and tool names appear in the
spread. Each tool they uncover gets a card below with its description, license and
link. A "Spread Facts" panel styled like a nutrition label counts the tools found by
license.

A backend is being built separately in /server. Your job: build the FRONTEND ONLY,
in a new /web folder, using that backend's API. Do not edit anything in /server.

## Keep the existing experience
The current index.html is the design reference. Keep its look and feel exactly: the
gingham background, the plate, the canvas bread and spreading, the knife, the jar shelf,
the Spread Facts label, the cards, the fonts (Bagel Fat One, Bricolage Grotesque,
JetBrains Mono), the color tokens, light and dark mode, and the reduced-motion
handling. Move its canvas code into modules rather than rewriting it from scratch.

## Stack
- Vite + vanilla TypeScript. No UI framework is needed; the canvas does the heavy
  lifting.
- `npm run dev` on port 5173. Read the API base URL from VITE_API_URL (default
  http://localhost:8787).
- Split into modules: api.ts (typed client), bread.ts (canvas drawing and spreading),
  knife.ts, shelf.ts, cards.ts, facts.ts, pantry.ts, suggest.ts, state.ts.

## API (already defined. Use exactly these.)
GET  /api/jars → [{ id, name, kind, color, dark, light, lid, toolCount }]
GET  /api/jars/:id/tools → Tool[] in stable order
GET  /api/tools?q=&jar=&licenseFamily=&sort=name|stars|recent&page=&limit=
     → { items: Tool[], page, limit, total }
GET  /api/tools/:slug → Tool
GET  /api/licenses → [{ family, count }]
GET  /api/stats → { tools, jars, licenses, updatedAt }
POST /api/suggestions body { name, url, jarId, description, license?, repoUrl?, note? }
     → 201 { id, status } or 400 { error, fields: { [field]: message } }

Tool = { slug, name, shortLabel, jarId, license, licenseFamily, description, url,
         repoUrl, stars, lastCommitAt }

## What to build
1. The sandwich (home view). Load jars from the API. The bread fits 12 tools (3 per row,
   4 rows), so a jar with more than 12 tools is split into slices. Add "Next slice" and
   "Previous slice" controls with a "Slice 2 of 4" label. Use shortLabel on the bread
   when it exists, and name otherwise. Cards show stars and the repo link when the API
   provides them.
2. Progress. Remember which tools the visitor has found in localStorage, keyed by slug,
   and wrap every read and write in try/catch. Spread Facts totals use
   found / total from /api/stats.
3. The Pantry: a second view at #pantry that lists every tool with a search box, jar
   and license filters, sort, and pagination, using /api/tools. Found tools show a small
   "on your sandwich" mark. Keep the same visual language: jars as filter chips, cards
   as in the home view.
4. Suggest a tool: a form (in a dialog or at #suggest) that posts to /api/suggestions.
   Show the field errors from the 400 response next to each field, and a clear success
   message: "Thanks. Your suggestion is waiting for review."
5. States. Show a loading state while jars and tools load, a friendly error with a
   Retry button if the API is down, and an empty state when a search finds nothing.
   If the API can't be reached on first load, fall back to a bundled copy of the
   original 60 tools (web/src/fallback-data.ts, taken from the current index.html) so
   the sandwich still works offline.

## Quality bar
- Works at 360px wide with no horizontal scrolling, and on desktop.
- Keyboard accessible: jars are buttons, the canvas has Enter or Space to
  "Spread the whole slice", visible focus rings, and an aria-live region announces
  "Found <tool>".
- Light and dark themes both look right.
- No API keys or secrets in the frontend.
- `npm run build` outputs static files to /web/dist that can be deployed to
  GitHub Pages.

When you're done, run the build, start the dev server against the backend, and
check the home view, the pantry, and the suggest form. Summarize what you built and
anything that doesn't work yet. Commit on a branch called `frontend` and don't push
until I say so.
```
