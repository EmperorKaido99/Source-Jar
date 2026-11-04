import type { ApiClient } from "./api";
import type { AppState } from "./state";
import type { Jar, LicenseCount, Tool } from "./types";

interface PantryOptions {
  api: ApiClient;
  state: AppState;
  jars: readonly Jar[];
  licenses: readonly LicenseCount[];
  fallbackTools?: readonly Tool[];
}

interface PantryFilters {
  q: string;
  jar: string;
  licenseFamily: string;
  sort: "name" | "stars" | "recent";
  page: number;
}

const PAGE_SIZE = 12;

function localToolPage(tools: readonly Tool[], filters: PantryFilters): {
  items: Tool[];
  page: number;
  limit: number;
  total: number;
} {
  const query = filters.q.toLocaleLowerCase();
  const matching = tools.filter((tool) =>
    (!query || `${tool.name} ${tool.description} ${tool.license}`.toLocaleLowerCase().includes(query)) &&
    (!filters.jar || tool.jarId === filters.jar) &&
    (!filters.licenseFamily || tool.licenseFamily === filters.licenseFamily),
  );
  matching.sort((left, right) => {
    if (filters.sort === "stars") return (right.stars ?? -1) - (left.stars ?? -1);
    if (filters.sort === "recent") return (right.lastCommitAt ?? "").localeCompare(left.lastCommitAt ?? "");
    return left.name.localeCompare(right.name);
  });
  const start = (filters.page - 1) * PAGE_SIZE;
  return {
    items: matching.slice(start, start + PAGE_SIZE),
    page: filters.page,
    limit: PAGE_SIZE,
    total: matching.length,
  };
}

function jarColor(jars: readonly Jar[], jarId: string): string {
  return jars.find((jar) => jar.id === jarId)?.color ?? "var(--jar)";
}

function toolCard(tool: Tool, color: string, onSandwich: boolean): HTMLElement {
  const card = document.createElement("article");
  card.className = "card pantry-card";

  const row = document.createElement("div");
  row.className = "row";
  const title = document.createElement("h3");
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = color;
  title.append(dot, document.createTextNode(tool.name));
  const license = document.createElement("span");
  license.className = "lic";
  license.textContent = tool.license;
  row.append(title, license);

  const description = document.createElement("p");
  description.textContent = tool.description;
  const links = document.createElement("div");
  links.className = "card-links";
  const project = document.createElement("a");
  project.href = tool.url;
  project.target = "_blank";
  project.rel = "noreferrer";
  project.textContent = "Visit project";
  links.append(project);
  if (tool.stars !== null) {
    const stars = document.createElement("span");
    stars.className = "stars";
    stars.textContent = `★ ${tool.stars.toLocaleString()}`;
    links.append(stars);
  }
  if (onSandwich) {
    const mark = document.createElement("span");
    mark.className = "sandwich-mark";
    mark.textContent = "On your sandwich";
    links.append(mark);
  }

  card.append(row, description, links);
  return card;
}

export function mountPantry(container: HTMLElement, options: PantryOptions): void {
  container.innerHTML = `
    <main class="wrap">
      <header class="top">
        <span class="brand">Open Source Spread</span>
        <nav class="site-nav" aria-label="Primary navigation">
          <a href="#">Home</a><a href="#pantry" aria-current="page">Pantry</a><a href="#suggest">Suggest</a>
        </nav>
        <button class="theme-toggle" type="button" aria-label="Toggle color theme">Theme</button>
      </header>
      <section class="page-head" aria-labelledby="pantry-title">
        <p class="eyebrow">The pantry</p>
        <h1 id="pantry-title">Find your next spread.</h1>
        <p class="lede">Search every open source tool, then filter the shelf to suit your sandwich.</p>
      </section>
      <section class="pantry-controls" aria-label="Filter pantry tools">
        <label class="field search-field">Search tools
          <input id="pantry-search" type="search" placeholder="Search name, license, or description" autocomplete="off">
        </label>
        <fieldset class="jar-filter">
          <legend>Choose a jar</legend>
          <div class="jar-chips" id="jar-chips"></div>
        </fieldset>
        <label class="field">License family
          <select id="license-filter"><option value="">All license families</option></select>
        </label>
        <label class="field">Sort by
          <select id="sort-filter">
            <option value="name">Name</option>
            <option value="stars">Stars</option>
            <option value="recent">Recently updated</option>
          </select>
        </label>
      </section>
      <section class="pantry-results" aria-live="polite" aria-busy="false">
        <div class="found-head"><h2>Pantry tools</h2><p id="result-count"></p></div>
        <div id="pantry-content"></div>
        <nav class="pagination" id="pagination" aria-label="Pantry pages"></nav>
      </section>
    </main>`;

  const search = container.querySelector<HTMLInputElement>("#pantry-search")!;
  const jarChips = container.querySelector<HTMLElement>("#jar-chips")!;
  const license = container.querySelector<HTMLSelectElement>("#license-filter")!;
  const sort = container.querySelector<HTMLSelectElement>("#sort-filter")!;
  const results = container.querySelector<HTMLElement>(".pantry-results")!;
  const content = container.querySelector<HTMLElement>("#pantry-content")!;
  const count = container.querySelector<HTMLElement>("#result-count")!;
  const pagination = container.querySelector<HTMLElement>("#pagination")!;
  let filters: PantryFilters = { q: "", jar: "", licenseFamily: "", sort: "name", page: 1 };
  let searchTimer: number | undefined;
  let requestId = 0;

  for (const family of options.licenses) {
    const option = document.createElement("option");
    option.value = family.family;
    option.textContent = `${family.family} (${family.count})`;
    license.append(option);
  }

  const renderJarChips = (): void => {
    jarChips.replaceChildren();
    const all = document.createElement("button");
    all.type = "button";
    all.className = "jar-chip";
    all.setAttribute("aria-pressed", String(!filters.jar));
    all.textContent = "All jars";
    all.addEventListener("click", () => update({ jar: "", page: 1 }));
    jarChips.append(all);
    for (const jar of options.jars) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "jar-chip";
      chip.setAttribute("aria-pressed", String(filters.jar === jar.id));
      const swatch = document.createElement("span");
      swatch.className = "jar-chip-swatch";
      swatch.style.background = jar.color;
      chip.append(swatch, document.createTextNode(jar.name));
      chip.addEventListener("click", () => update({ jar: jar.id, page: 1 }));
      jarChips.append(chip);
    }
  };

  const renderPagination = (page: number, limit: number, total: number): void => {
    pagination.replaceChildren();
    const pages = Math.ceil(total / limit);
    if (pages <= 1) return;
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "btn ghost";
    previous.textContent = "Previous";
    previous.disabled = page === 1;
    previous.addEventListener("click", () => update({ page: page - 1 }));
    const label = document.createElement("span");
    label.className = "slice-label";
    label.textContent = `Page ${page} of ${pages}`;
    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn ghost";
    next.textContent = "Next";
    next.disabled = page === pages;
    next.addEventListener("click", () => update({ page: page + 1 }));
    pagination.append(previous, label, next);
  };

  const load = async (): Promise<void> => {
    const currentRequest = ++requestId;
    results.setAttribute("aria-busy", "true");
    count.textContent = "";
    pagination.replaceChildren();
    content.replaceChildren(document.createTextNode("Loading pantry tools…"));
    content.className = "page-message";
    try {
      const page = options.fallbackTools
        ? localToolPage(options.fallbackTools, filters)
        : await options.api.getTools({
          q: filters.q || undefined,
          jar: filters.jar || undefined,
          licenseFamily: filters.licenseFamily || undefined,
          sort: filters.sort,
          page: filters.page,
          limit: PAGE_SIZE,
        });
      if (currentRequest !== requestId) return;
      results.setAttribute("aria-busy", "false");
      count.textContent = `${page.total} tool${page.total === 1 ? "" : "s"}`;
      if (page.total === 0) {
        content.className = "page-message";
        content.textContent = "No tools match those pantry filters.";
        return;
      }
      content.className = "cards";
      content.replaceChildren(...page.items.map((tool) => toolCard(
        tool,
        jarColor(options.jars, tool.jarId),
        options.state.isFound(tool.slug),
      )));
      renderPagination(page.page, page.limit, page.total);
    } catch {
      if (currentRequest !== requestId) return;
      results.setAttribute("aria-busy", "false");
      content.className = "page-message";
      content.replaceChildren(document.createTextNode("The pantry could not be loaded. "));
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "retry";
      retry.textContent = "Retry";
      retry.addEventListener("click", () => void load());
      content.append(retry);
    }
  };

  const update = (next: Partial<PantryFilters>): void => {
    filters = { ...filters, ...next };
    search.value = filters.q;
    license.value = filters.licenseFamily;
    sort.value = filters.sort;
    renderJarChips();
    void load();
  };

  search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => update({ q: search.value.trim(), page: 1 }), 250);
  });
  license.addEventListener("change", () => update({ licenseFamily: license.value, page: 1 }));
  sort.addEventListener("change", () => update({ sort: sort.value as PantryFilters["sort"], page: 1 }));
  container.querySelector<HTMLButtonElement>(".theme-toggle")!.addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  });

  renderJarChips();
  void load();
}
