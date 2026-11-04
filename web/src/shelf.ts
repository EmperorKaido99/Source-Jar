import type { Jar } from "./types";

export function renderShelf(
  container: HTMLElement,
  jars: readonly Jar[],
  selectedJarId: string,
  onSelect: (jar: Jar) => void,
): void {
  container.replaceChildren();

  for (const jar of jars) {
    const button = document.createElement("button");
    button.className = "jar";
    button.type = "button";
    button.setAttribute("aria-pressed", String(jar.id === selectedJarId));
    button.setAttribute("aria-label", `Choose ${jar.name}`);

    const glass = document.createElement("span");
    glass.className = "glass";
    glass.style.setProperty("--c", jar.color);
    glass.style.setProperty("--lid", jar.lid);

    const label = document.createElement("span");
    label.textContent = jar.name.replace(/ Hazelnut$/, "");
    glass.append(label);

    const name = document.createElement("span");
    name.className = "jar-name";
    name.textContent = jar.name;

    button.append(glass, name);
    button.addEventListener("click", () => onSelect(jar));
    container.append(button);
  }
}
