import type { AppState } from "./state";
import type { Stats, Tool } from "./types";

export function renderFacts(
  total: HTMLElement,
  list: HTMLElement,
  allTools: readonly Tool[],
  stats: Stats,
  state: AppState,
): void {
  const found = allTools.filter((tool) => state.isFound(tool.slug));
  total.textContent = `${found.length} / ${stats.tools}`;
  list.replaceChildren();

  const totals = new Map(stats.licenses.map((license) => [license.family, license.count]));
  const counts = new Map<string, number>();
  for (const tool of found) counts.set(tool.licenseFamily, (counts.get(tool.licenseFamily) ?? 0) + 1);

  for (const [family, count] of [...counts].sort(([left], [right]) => left.localeCompare(right))) {
    const item = document.createElement("li");
    const name = document.createElement("b");
    name.textContent = family;
    const familyTotal = totals.get(family) ?? allTools.filter((tool) => tool.licenseFamily === family).length;
    const amount = document.createElement("span");
    amount.textContent = `${count} / ${familyTotal}`;
    const percentage = document.createElement("span");
    percentage.className = "pct";
    percentage.textContent = `${familyTotal ? Math.round((count / familyTotal) * 100) : 0}%`;
    item.append(name, amount, percentage);
    list.append(item);
  }
}
