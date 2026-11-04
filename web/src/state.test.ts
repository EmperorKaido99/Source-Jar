import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppState } from "./state";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createAppState", () => {
  it("retains a found slug when storage is available", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const state = createAppState();

    state.markFound("linux");

    expect(state.isFound("linux")).toBe(true);
    expect(createAppState().isFound("linux")).toBe(true);
  });

  it("continues in memory when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    const state = createAppState();

    state.markFound("linux");

    expect(state.isFound("linux")).toBe(true);
  });

  it("notifies subscribers only for newly found slugs", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const state = createAppState();
    const listener = vi.fn();
    state.subscribe(listener);

    state.markFound("linux");
    state.markFound("linux");

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
