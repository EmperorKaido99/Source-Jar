import type { AppState } from "./state";
import type { Tool } from "./types";

function externalLink(href: string, text: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = text;
  return link;
}

function hiddenCard(): HTMLElement {
  const card = document.createElement("article");
  card.className = "card hidden";
  const title = document.createElement("b");
  title.textContent = "Keep spreading";
  const detail = document.createElement("small");
  detail.textContent = "A free tool is hiding here.";
  card.append(title, detail);
  return card;
}

function foundCard(tool: Tool, color: string): HTMLElement {
  const card = document.createElement("article");
  card.className = "card fresh";

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
  links.append(externalLink(tool.url, "Visit project"));
  if (tool.repoUrl) links.append(externalLink(tool.repoUrl, "Repository"));
  if (tool.stars !== null) {
    const stars = document.createElement("span");
    stars.className = "stars";
    stars.textContent = `★ ${tool.stars.toLocaleString()}`;
    links.append(stars);
  }

  card.append(row, description, links);
  return card;
}

export function renderCards(
  container: HTMLElement,
  tools: readonly Tool[],
  state: AppState,
  color: string,
): void {
  container.replaceChildren(...tools.map((tool) => (
    state.isFound(tool.slug) ? foundCard(tool, color) : hiddenCard()
  )));
}
