import "./style.css";
import { createApi } from "./api";
import { createBreadBoard, sliceTools, type BreadBoard } from "./bread";
import { renderCards } from "./cards";
import { fallbackJars, fallbackTools } from "./fallback-data";
import { renderFacts } from "./facts";
import { renderShelf } from "./shelf";
import { mountPantry } from "./pantry";
import { mountSuggest } from "./suggest";
import { createAppState } from "./state";
import type { Jar, LicenseCount, Stats, Tool } from "./types";

const SLICE_SIZE = 12;
const app = document.querySelector<HTMLDivElement>("#app")!;
const api = createApi();
const state = createAppState();
let activeCleanup: (() => void) | undefined;

function fallbackStats(): Stats {
  const licenses = new Map<string, number>();
  for (const tool of fallbackTools) {
    licenses.set(tool.licenseFamily, (licenses.get(tool.licenseFamily) ?? 0) + 1);
  }
  return {
    tools: fallbackTools.length,
    jars: fallbackJars.length,
    licenses: [...licenses].map(([family, count]) => ({ family, count })),
    updatedAt: "",
  };
}

function homeMarkup(): void {
  app.innerHTML = `
    <main class="wrap">
      <header class="top">
        <span class="brand">Open Source Spread</span>
        <nav class="site-nav" aria-label="Primary navigation">
          <a href="#">Home</a><a href="#pantry">Pantry</a><a href="#suggest">Suggest</a>
        </nav>
        <button class="theme-toggle" type="button" aria-label="Toggle color theme">Theme</button>
      </header>
      <p class="status" hidden></p>
      <section class="kitchen" aria-label="Sandwich station">
        <div class="intro">
          <h1>Spread the source.</h1>
          <p class="lede">Pick a jar, grab the knife and drag it across the bread. Every swipe uncovers free software that anyone can use, study, change and share.</p>
        </div>
        <div class="stage" id="stage">
          <canvas id="board" tabindex="0" role="img" aria-label="A slice of bread. Drag across it to spread the jar and uncover open source tools."></canvas>
          <div class="hint" id="hint">Drag the knife across the bread</div>
        </div>
        <div class="controls">
          <div><p class="shelf-label" id="shelf-label">The pantry</p><div class="shelf" id="shelf" role="group" aria-labelledby="shelf-label"></div></div>
          <p class="now" id="now"></p>
          <div class="buttons"><button class="btn" id="spread-all" type="button">Spread the whole slice</button><button class="btn ghost" id="fresh" type="button">Fresh slice</button></div>
          <div class="slice-controls" id="slice-controls"></div>
          <div class="facts" aria-label="Spread facts"><h2>Spread Facts</h2><p class="serving">Serving size 1 slice · jars from the pantry</p><div class="big"><span>Tools found</span><strong id="facts-total">0 / 0</strong></div><div class="head">% of license family</div><ul id="facts-list"></ul><p class="foot">Each tool lists its project's main license. SQLite is public domain; the rest use OSI-approved licenses.</p></div>
        </div>
      </section>
      <section aria-labelledby="found-title"><div class="found-head"><h2 id="found-title">Found tools</h2><p id="found-count"></p></div><div class="cards" id="cards"></div></section>
      <p class="note">Licenses shown are each project's primary license; some projects include parts under other terms. Every link goes to the project's own site or repository.</p>
      <div class="sr" aria-live="polite" id="live"></div>
    </main>`;
}

async function mountHome(): Promise<void> {
  homeMarkup();
  const shelf = document.querySelector<HTMLElement>("#shelf")!;
  const now = document.querySelector<HTMLElement>("#now")!;
  const cards = document.querySelector<HTMLElement>("#cards")!;
  const factsTotal = document.querySelector<HTMLElement>("#facts-total")!;
  const factsList = document.querySelector<HTMLElement>("#facts-list")!;
  const foundTitle = document.querySelector<HTMLElement>("#found-title")!;
  const foundCount = document.querySelector<HTMLElement>("#found-count")!;
  const live = document.querySelector<HTMLElement>("#live")!;
  const status = document.querySelector<HTMLElement>(".status")!;
  const sliceControls = document.querySelector<HTMLElement>("#slice-controls")!;
  const hint = document.querySelector<HTMLElement>("#hint")!;

  let jars: Jar[] = [];
  let stats = fallbackStats();
  let allTools: Tool[] = [];
  let selectedJar: Jar | undefined;
  let selectedTools: Tool[] = [];
  let sliceIndex = 0;
  let offline = false;
  let board: BreadBoard | undefined;
  let startupWarning = "";
  let selectionVersion = 0;
  const toolsByJar = new Map<string, Tool[]>();

  const showError = (message: string, retry: () => void): void => {
    status.hidden = false;
    status.replaceChildren(document.createTextNode(message + " "));
    const button = document.createElement("button");
    button.className = "retry";
    button.type = "button";
    button.textContent = "Retry";
    button.addEventListener("click", retry);
    status.append(button);
  };
  const clearStatus = (): void => {
    status.hidden = true;
    status.replaceChildren();
  };

  const render = (): void => {
    if (!selectedJar) return;
    const slice = sliceTools(selectedTools, sliceIndex);
    renderShelf(shelf, jars, selectedJar.id, (jar) => void selectJar(jar));
    now.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = selectedJar.color;
    const name = document.createElement("b");
    name.textContent = selectedJar.name;
    const kind = document.createElement("span");
    kind.className = "kind";
    kind.textContent = selectedJar.kind;
    now.append(dot, name, kind);
    foundTitle.textContent = `Found in ${selectedJar.name}`;
    foundCount.textContent = `${slice.filter((tool) => state.isFound(tool.slug)).length} of ${slice.length} found`;
    renderCards(cards, slice, state, selectedJar.color);
    renderFacts(factsTotal, factsList, allTools, stats, state);
    renderSliceControls();
  };

  const setSlice = (nextSlice: number): void => {
    if (!selectedJar) return;
    const count = Math.max(1, Math.ceil(selectedTools.length / SLICE_SIZE));
    sliceIndex = Math.min(Math.max(0, nextSlice), count - 1);
    board?.setSlice(selectedJar, selectedTools, sliceIndex);
    render();
  };

  const renderSliceControls = (): void => {
    const count = Math.ceil(selectedTools.length / SLICE_SIZE);
    sliceControls.replaceChildren();
    if (count <= 1) return;
    const previous = document.createElement("button");
    previous.className = "btn ghost";
    previous.type = "button";
    previous.textContent = "Previous Slice";
    previous.disabled = sliceIndex === 0;
    previous.addEventListener("click", () => setSlice(sliceIndex - 1));
    const label = document.createElement("span");
    label.className = "slice-label";
    label.textContent = `Slice ${sliceIndex + 1} of ${count}`;
    const next = document.createElement("button");
    next.className = "btn ghost";
    next.type = "button";
    next.textContent = "Next Slice";
    next.disabled = sliceIndex === count - 1;
    next.addEventListener("click", () => setSlice(sliceIndex + 1));
    sliceControls.append(previous, label, next);
  };

  const selectJar = async (jar: Jar): Promise<void> => {
    const requestVersion = ++selectionVersion;
    clearStatus();
    try {
      let tools = toolsByJar.get(jar.id);
      if (!tools) {
        tools = offline ? fallbackTools.filter((tool) => tool.jarId === jar.id) : await api.getJarTools(jar.id);
        if (requestVersion !== selectionVersion) return;
        toolsByJar.set(jar.id, tools);
      }
      if (requestVersion !== selectionVersion) return;
      if (!allTools.some((tool) => tool.jarId === jar.id)) allTools.push(...tools);
      selectedJar = jar;
      selectedTools = tools;
      sliceIndex = 0;
      board?.setSlice(jar, tools, 0);
      render();
    } catch {
      showError("That jar could not be opened. Your current discoveries are safe.", () => void selectJar(jar));
      render();
    }
  };

  board = createBreadBoard({
    canvas: document.querySelector<HTMLCanvasElement>("#board")!,
    container: document.querySelector<HTMLElement>("#stage")!,
    onReveal: (tool) => {
      state.markFound(tool.slug);
      hint.classList.add("off");
      live.textContent = `Found ${tool.name}`;
      render();
    },
  });
  document.querySelector<HTMLButtonElement>("#spread-all")!.addEventListener("click", () => board?.spreadAll());
  document.querySelector<HTMLButtonElement>("#fresh")!.addEventListener("click", () => {
    board?.clear();
    hint.classList.remove("off");
  });
  document.querySelector<HTMLButtonElement>(".theme-toggle")!.addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  });
  const unsubscribe = state.subscribe(render);
  activeCleanup = () => {
    unsubscribe();
    board?.destroy();
  };

  try {
    jars = await api.getJars();
  } catch {
    offline = true;
    jars = fallbackJars;
    stats = fallbackStats();
    allTools = [...fallbackTools];
    startupWarning = "You’re browsing the original pantry offline.";
  }

  if (!offline) {
    try {
      const [nextStats, toolLists] = await Promise.all([
        api.getStats(),
        Promise.all(jars.map(async (jar) => [jar.id, await api.getJarTools(jar.id)] as const)),
      ]);
      stats = nextStats;
      for (const [jarId, tools] of toolLists) toolsByJar.set(jarId, tools);
      allTools = toolLists.flatMap(([, tools]) => tools);
    } catch {
      startupWarning = "Some live pantry data could not be refreshed.";
    }
  }

  selectedJar = jars.find((jar) => jar.id === "jam" || jar.name === "Strawberry Jam") ?? jars[0];
  if (!selectedJar) {
    showError("The pantry is empty right now.", () => void mountHome());
    return;
  }
  await selectJar(selectedJar);
  if (startupWarning) {
    showError(startupWarning, () => {
      board?.destroy();
      void mountHome();
    });
  }
}

async function loadRouteData(): Promise<{ jars: Jar[]; licenses: LicenseCount[]; fallback?: true }> {
  try {
    const [jars, licenses] = await Promise.all([api.getJars(), api.getLicenses()]);
    return { jars, licenses };
  } catch {
    const counts = new Map<string, number>();
    for (const tool of fallbackTools) {
      counts.set(tool.licenseFamily, (counts.get(tool.licenseFamily) ?? 0) + 1);
    }
    return {
      jars: fallbackJars,
      licenses: [...counts].map(([family, count]) => ({ family, count })),
      fallback: true,
    };
  }
}

async function route(): Promise<void> {
  activeCleanup?.();
  activeCleanup = undefined;
  const hash = window.location.hash;
  if (hash === "#pantry") {
    const { jars, licenses, fallback } = await loadRouteData();
    if (window.location.hash === "#pantry") {
      mountPantry(app, { api, state, jars, licenses, fallbackTools: fallback ? fallbackTools : undefined });
    }
    return;
  }
  if (hash === "#suggest") {
    const { jars } = await loadRouteData();
    if (window.location.hash === "#suggest") mountSuggest(app, { api, jars });
    return;
  }
  await mountHome();
}

window.addEventListener("hashchange", () => void route());
void route();
