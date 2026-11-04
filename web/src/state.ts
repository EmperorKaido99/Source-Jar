const STORAGE_KEY = "source-jar-found-slugs";

function readFoundSlugs(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((slug): slug is string => typeof slug === "string") : []);
  } catch {
    return new Set();
  }
}

export interface AppState {
  isFound(slug: string): boolean;
  markFound(slug: string): void;
  subscribe(listener: () => void): () => void;
}

export function createAppState(): AppState {
  const foundSlugs = readFoundSlugs();
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  return {
    isFound: (slug) => foundSlugs.has(slug),

    markFound: (slug) => {
      if (foundSlugs.has(slug)) return;

      foundSlugs.add(slug);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...foundSlugs]));
      } catch {
        // Discovery remains usable when browser storage is unavailable.
      }
      notify();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
