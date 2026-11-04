import { describe, expect, it } from "vitest";
import { sliceTools } from "./bread";
import type { Tool } from "./types";

function tool(index: number): Tool {
  return {
    slug: `tool-${index}`,
    name: `Tool ${index}`,
    shortLabel: null,
    jarId: "test",
    license: "MIT",
    licenseFamily: "MIT",
    description: "Test tool",
    url: "https://example.test",
    repoUrl: null,
    stars: null,
    lastCommitAt: null,
  };
}

describe("sliceTools", () => {
  it("splits a jar tool list into twelve-item slices", () => {
    const tools = Array.from({ length: 25 }, (_, index) => tool(index));

    expect(sliceTools(tools, 0)).toHaveLength(12);
    expect(sliceTools(tools, 1)).toHaveLength(12);
    expect(sliceTools(tools, 2)).toHaveLength(1);
  });

  it("returns no tools for a slice beyond the list", () => {
    expect(sliceTools([tool(1)], 1)).toEqual([]);
  });
});
