# Source Jar Frontend Design

## Goal

Create a standalone `web/` Vite + vanilla TypeScript frontend that preserves the original Source Jar interaction and visual language while loading its data from the separately maintained API.

## Scope and Constraints

- Do not modify `server/`.
- Use `VITE_API_URL`, defaulting to `http://localhost:8787`.
- Build static deployable output in `web/dist`.
- Preserve the original gingham tablecloth, plate, bread canvas, knife, jar shelf, facts label, cards, fonts, color tokens, dark theme, and reduced-motion behavior.
- Keep tool discovery locally persisted by tool slug, with all localStorage access wrapped in `try`/`catch`.
- Retain the original 60 tools as a bundled first-load fallback when the API cannot be reached.

## Architecture

The app has a small `main.ts` coordinator that selects a hash route (`#`, `#pantry`, or `#suggest`), loads initial state, and mounts the current view. `api.ts` exposes typed request functions and consistent API errors. `state.ts` owns app state, including safe persisted discovery state and subscriptions for view updates.

Canvas behavior is extracted rather than recreated: `bread.ts` owns bread geometry, drawing, the spread mask, labels, reveal detection, and automated spreading; `knife.ts` draws and parks the knife. The home view composes those modules with `shelf.ts`, `cards.ts`, and `facts.ts`. `pantry.ts` owns its server-paginated search interface; `suggest.ts` owns form submission, field-level API errors, and success feedback.

## Data Flow

1. Initial boot requests `/api/jars`, `/api/stats`, `/api/licenses`, and the selected jar's `/api/jars/:id/tools`.
2. On a first-load network failure, the app derives jars, tools, stats, and license totals from `fallback-data.ts`; later API errors retain the current data and show a retry control.
3. Selecting a jar resets the current slice's canvas mask, fetches tools when necessary, and divides its stable-order tool list into 12-item slices.
4. A reveal marks the tool slug as found through `state.ts`, updates cards and facts, and announces the new discovery through an `aria-live` region.
5. Pantry requests `/api/tools` for each search/filter/sort/page change and uses the same found-slug state to mark matching tools.
6. Suggestions post the typed form payload to `/api/suggestions`; a 400 response maps `fields` errors to their associated inputs, while a 201 response replaces the form feedback with the specified confirmation text.

## Module Contracts

| File | Responsibility |
|---|---|
| `src/api.ts` | API types, request helpers, typed endpoint methods, `ApiError` |
| `src/bread.ts` | Canvas bread/spread rendering, labels, reveal detection, slice reset, automatic spreading |
| `src/knife.ts` | Knife model and canvas drawing |
| `src/shelf.ts` | Accessible visual jar buttons and pantry filter chips |
| `src/cards.ts` | Reusable tool card and hidden-discovery card rendering |
| `src/facts.ts` | Spread Facts markup from found tools, all tools, and API totals |
| `src/pantry.ts` | Pantry search, filters, sorting, pagination, loading/error/empty states |
| `src/suggest.ts` | Suggestion form, field errors, success status |
| `src/state.ts` | App state, safe localStorage persistence, subscriptions, theme preference |
| `src/fallback-data.ts` | The original 60 tools and five jar definitions converted to API-shaped data |
| `src/main.ts` | Hash routing, initial loading/retry, and view composition |
| `src/style.css` | Migrated design tokens and responsive, accessible styling |

## Accessibility and Responsiveness

- Jar choices are native buttons with pressed state and visible focus rings.
- The canvas is keyboard focusable; Enter and Space spread the current slice.
- Discoveries announce `Found <tool>` through a polite live region.
- All controls work at 360px without horizontal scrolling; the kitchen becomes a single-column layout below the existing breakpoint.
- Motion transitions and reveal/card animations disable under `prefers-reduced-motion`.
- The existing system/light/dark theme behavior is retained with an explicit theme toggle.

## Validation

- Run `npm run build` in `web`.
- Start the backend and the Vite server on port 5173.
- Verify Home jar switching, slice controls, keyboard spreading, progress persistence, and fallback mode.
- Verify Pantry search, filters, sorting, pagination, loading/error/empty states, and found markers.
- Verify suggestion validation errors and the 201 confirmation path.
- Verify the 360px layout and both themes in a browser.
