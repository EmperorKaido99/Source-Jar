# Source Jar Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable Vite + vanilla TypeScript frontend in `web/` that preserves the Source Jar interaction while using the Source Jar API.

**Architecture:** `main.ts` owns hash routing and application composition. Typed `api.ts` and persistent `state.ts` provide data and discovery state to focused render modules; the original canvas algorithm is split between `bread.ts` and `knife.ts`, while page-specific DOM work lives in `shelf.ts`, `cards.ts`, `facts.ts`, `pantry.ts`, and `suggest.ts`.

**Tech Stack:** Vite, TypeScript, Vitest, browser Canvas 2D APIs, native DOM APIs.

**Spec:** `docs/superpowers/specs/2026-11-04-source-jar-frontend-design.md`

## Global Constraints

- Do not modify `server/`.
- Use `VITE_API_URL`, defaulting to `http://localhost:8787`.
- `npm run dev` must use port `5173`.
- Build static files to `web/dist`.
- Preserve the original page’s visual language, canvas interaction, color tokens, fonts, themes, and reduced-motion behavior.
- Keep all localStorage reads and writes in `try`/`catch`.
- Use the original 60 tools only as a first-load offline fallback.
- Support Home (`#`), Pantry (`#pantry`), and Suggest (`#suggest`) without horizontal scrolling at 360px.

---

### Task 1: Scaffold the web application and domain types

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/types.ts`
- Create: `web/src/style.css`
- Create: `web/src/main.ts`

**Interfaces:**
- Produces `Jar`, `Tool`, `LicenseCount`, `Stats`, `ToolPage`, and `SuggestionPayload` types used by every later module.
- Produces an empty app root and a Vite configuration with `server.port = 5173`.

- [ ] **Step 1: Create the Vite manifest and configuration**

```json
{
  "name": "source-jar-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Define API-shaped domain types**

```ts
export interface Tool {
  slug: string;
  name: string;
  shortLabel: string | null;
  jarId: string;
  license: string;
  licenseFamily: string;
  description: string;
  url: string;
  repoUrl: string | null;
  stars: number | null;
  lastCommitAt: string | null;
}
```

- [ ] **Step 3: Add the document shell and the migrated global design tokens**

Use the original Google font import, `:root` color tokens, dark theme overrides, body gingham background, focus rings, reduced-motion rules, and 360px-safe layout primitives.

- [ ] **Step 4: Add a temporary `main.ts` mount**

```ts
document.querySelector<HTMLDivElement>("#app")!.innerHTML =
  '<main class="wrap"><p>Loading Source Jar…</p></main>';
```

- [ ] **Step 5: Install dependencies and verify compilation**

Run: `npm install && npm run build` from `web`

Expected: Vite writes static files to `web/dist` with exit code 0.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "feat: scaffold Source Jar frontend"
```

### Task 2: Add API client, fallback data, and persistent discovery state

**Files:**
- Create: `web/src/api.ts`
- Create: `web/src/state.ts`
- Create: `web/src/fallback-data.ts`
- Create: `web/src/state.test.ts`
- Create: `web/src/api.test.ts`

**Interfaces:**
- Consumes: the types from `web/src/types.ts`.
- Produces `createApi(baseUrl)`, `ApiError`, `createAppState()`, and API-shaped fallback arrays.

- [ ] **Step 1: Write failing persistence tests**

```ts
it("retains a found slug when storage is available", () => {
  const state = createAppState();
  state.markFound("linux");
  expect(state.isFound("linux")).toBe(true);
});

it("continues in memory when localStorage throws", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const state = createAppState();
  state.markFound("linux");
  expect(state.isFound("linux")).toBe(true);
});
```

- [ ] **Step 2: Implement `state.ts` with guarded persistence**

```ts
const STORAGE_KEY = "source-jar-found-slugs";

function readFoundSlugs(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
```

Wrap the paired `setItem` call in `try`/`catch`, persist only slug strings, and notify registered subscribers after changes.

- [ ] **Step 3: Write failing typed API tests**

```ts
it("uses the configured base URL and encodes tool query parameters", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    items: [], page: 1, limit: 12, total: 0,
  })));
  await createApi("http://api.test", fetcher).getTools({ q: "open source" });
  expect(fetcher).toHaveBeenCalledWith(
    "http://api.test/api/tools?q=open+source",
    expect.any(Object),
  );
});
```

- [ ] **Step 4: Implement API errors and endpoints**

```ts
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
```

Implement exact methods for jars, jar tools, tools, a tool detail, licenses, stats, and suggestions. Parse the 400 suggestion `fields` object into `ApiError.fields`.

- [ ] **Step 5: Convert `index.html`’s five jars and 60 tools into `fallback-data.ts`**

Preserve original stable order, colors, descriptions, labels, and URLs. Give each fallback tool a deterministic slug and inferred `licenseFamily`; set unavailable repository metadata to `null`.

- [ ] **Step 6: Run unit tests**

Run: `npm test` from `web`

Expected: persistence and API tests pass.

- [ ] **Step 7: Commit**

```bash
git add web/src
git commit -m "feat: add frontend data state"
```

### Task 3: Extract and validate the sandwich canvas

**Files:**
- Create: `web/src/bread.ts`
- Create: `web/src/knife.ts`
- Create: `web/src/bread.test.ts`

**Interfaces:**
- Consumes: `Jar`, `Tool`, app state callbacks, and the canvas element.
- Produces `createBreadBoard(options)` with `setSlice(jar, tools, sliceIndex)`, `spreadAll()`, `clear()`, and `destroy()`.

- [ ] **Step 1: Write failing slice tests**

```ts
it("splits a jar tool list into twelve-item slices", () => {
  expect(sliceTools(Array.from({ length: 25 }, tool), 0)).toHaveLength(12);
  expect(sliceTools(Array.from({ length: 25 }, tool), 2)).toHaveLength(1);
});
```

- [ ] **Step 2: Move the bread geometry and rendering from `index.html` into `bread.ts`**

Keep the existing seeded crumb and crust rendering, mask/streak canvases, reveal sampling threshold, `ResizeObserver`, canvas pointer events, keyboard `Enter`/`Space`, and reduced-motion behavior. Replace `JARS[jarIdx].tools` lookups with injected `Tool` instances and draw `shortLabel ?? name`.

- [ ] **Step 3: Move knife state and `drawKnife` into `knife.ts`**

Export a knife model whose drawing accepts a `CanvasRenderingContext2D`, current jar colors, size, and reduced-motion setting.

- [ ] **Step 4: Connect reveal callback and announcement**

```ts
onReveal(tool) {
  state.markFound(tool.slug);
  liveRegion.textContent = `Found ${tool.name}`;
  renderFoundTools();
}
```

- [ ] **Step 5: Run canvas/slice unit tests and build**

Run: `npm test && npm run build` from `web`

Expected: tests and static build pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/bread.ts web/src/knife.ts web/src/bread.test.ts
git commit -m "feat: extract sandwich canvas"
```

### Task 4: Build the home view supporting jars, slices, cards, and facts

**Files:**
- Create: `web/src/shelf.ts`
- Create: `web/src/cards.ts`
- Create: `web/src/facts.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/style.css`

**Interfaces:**
- Consumes: `createBreadBoard`, `createApi`, `createAppState`, and domain types.
- Produces the Home route with retryable loading/error states.

- [ ] **Step 1: Render accessible shelf buttons**

Use native `button.jar` elements with `aria-pressed`, jar color CSS variables, the preserved visual glass/lid treatment, and a selected-jar callback.

- [ ] **Step 2: Render cards from found state**

Render hidden placeholders for undiscovered slice tools. Found cards show license, description, main URL, star count when non-null, and a repository link only when `repoUrl` is non-null.

- [ ] **Step 3: Render facts from API totals and found tools**

Display `found count / stats.tools`; group found tools by `licenseFamily`; retain the nutrition-label hierarchy and percentages.

- [ ] **Step 4: Implement slice controls**

Show no controls for one slice. Otherwise, render Previous Slice, `Slice N of M`, and Next Slice; disable boundary buttons, clear only the visual mask when changing slices, and retain discovered slugs.

- [ ] **Step 5: Implement retryable data loading and fallback**

On first `getJars` failure, initialize from `fallback-data.ts` and label the page as offline. On subsequent request errors, preserve loaded content and render a friendly error with Retry. Fetch the selected jar’s tools in stable order.

- [ ] **Step 6: Run build and manual home-view checks**

Run: `npm run build` from `web`, then run the backend and Vite server. Confirm jar selection, canvas spreading, keyboard spread, slice navigation, persisted progress, facts totals, and both themes.

- [ ] **Step 7: Commit**

```bash
git add web/src
git commit -m "feat: build API-driven sandwich"
```

### Task 5: Add pantry browsing and the suggestion form

**Files:**
- Create: `web/src/pantry.ts`
- Create: `web/src/suggest.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/style.css`

**Interfaces:**
- Consumes: `ApiClient`, `AppState`, `Jar[]`, and `LicenseCount[]`.
- Produces the `#pantry` and `#suggest` routes.

- [ ] **Step 1: Implement Pantry query controls**

Use a labeled search input, jar visual chips, a license family select, a name/stars/recent sort select, and previous/next pagination controls. Debounce only free-text search; immediately apply filter and sort changes.

- [ ] **Step 2: Render all Pantry states**

Render an in-content loading message while requests are active, a friendly retryable error on failure, and an empty message only when a successful query returns zero tools. Render the reusable cards with an “On your sandwich” mark for found slugs.

- [ ] **Step 3: Implement the Suggest route**

Render labeled native form controls for `name`, `url`, `jarId`, `description`, `license`, `repoUrl`, and `note`. Map 400 `ApiError.fields` errors to `aria-describedby` error elements beside the applicable fields. On 201, display exactly: `Thanks. Your suggestion is waiting for review.`

- [ ] **Step 4: Add route navigation**

Add Home, Pantry, and Suggest links that update the hash and preserve the site header. Restore the Home view when the hash is absent or unknown.

- [ ] **Step 5: Run build and manual route checks**

Run: `npm run build` from `web`. With the API running, verify Pantry filtering, sorting, pagination, empty/error states, suggestion validation errors, and successful submission.

- [ ] **Step 6: Commit**

```bash
git add web/src
git commit -m "feat: add pantry and suggestions"
```

### Task 6: Final verification and delivery

**Files:**
- Modify: `web/src/style.css` only for issues found during responsive/theme checks.

**Interfaces:**
- Consumes: completed frontend application and running API.
- Produces: a verified static `web/dist` build and pushed `main` branch.

- [ ] **Step 1: Run the frontend test and build suite**

Run: `npm test && npm run build` from `web`

Expected: all tests pass and `web/dist` exists.

- [ ] **Step 2: Start the backend and frontend**

Run: `npm run dev` from `server`, then `npm run dev` from `web`.

Expected: API is reachable at `http://localhost:8787` and Vite is reachable at `http://127.0.0.1:5173`.

- [ ] **Step 3: Perform browser-level acceptance checks**

At 360px and desktop widths, verify no horizontal overflow; Home canvas discovery and slice controls; Pantry search/filter/sort/page; Suggest validation and confirmation; dark and light themes; visible focus; canvas keyboard action; and live discovery announcement.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check origin/main...HEAD && git status --short`

Expected: no whitespace errors and only intended frontend/spec/plan files.

- [ ] **Step 5: Commit verification adjustments and push**

```bash
git add web
git commit -m "fix: polish Source Jar frontend"
git push origin main
```
