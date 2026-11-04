import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers.js";

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("GET /api/jars", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp().app;
  });

  it("returns 5 jars in sort order with tool counts", async () => {
    const res = await app.inject({ method: "GET", url: "/api/jars" });
    expect(res.statusCode).toBe(200);
    const jars = res.json();
    expect(jars).toHaveLength(5);
    expect(jars[0]).toMatchObject({ id: "pb", name: "Peanut Butter", toolCount: 12 });
    for (const jar of jars) {
      expect(jar.toolCount).toBe(12);
    }
  });
});

describe("GET /api/jars/:id/tools", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp().app;
  });

  it("returns tools for a jar in original seed order", async () => {
    const res = await app.inject({ method: "GET", url: "/api/jars/pb/tools" });
    expect(res.statusCode).toBe(200);
    const tools = res.json();
    expect(tools).toHaveLength(12);
    expect(tools[0].name).toBe("Linux");
    expect(tools[1].name).toBe("Debian");
  });

  it("404s for an unknown jar", async () => {
    const res = await app.inject({ method: "GET", url: "/api/jars/nope/tools" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Jar not found" });
  });
});

describe("GET /api/tools/:slug", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp().app;
  });

  it("returns a tool by slug in camelCase", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools/linux" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      slug: "linux",
      name: "Linux",
      jarId: "pb",
      license: "GPL-2.0",
      licenseFamily: "GPL family",
      url: "https://kernel.org",
    });
  });

  it("404s for an unknown slug", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools/does-not-exist" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Tool not found" });
  });
});

describe("GET /api/tools search, filters, pagination", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp().app;
  });

  it("paginates with default page size", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools" });
    const body = res.json();
    expect(body.page).toBe(1);
    expect(body.limit).toBe(24);
    expect(body.total).toBe(60);
    expect(body.items).toHaveLength(24);
  });

  it("respects page and limit", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools?page=3&limit=20" });
    const body = res.json();
    expect(body.page).toBe(3);
    expect(body.limit).toBe(20);
    expect(body.total).toBe(60);
    expect(body.items).toHaveLength(20);
  });

  it("caps limit at 100", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools?limit=500" });
    expect(res.statusCode).toBe(400);
  });

  it("searches by name", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools?q=Firefox" });
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].name).toBe("Firefox");
  });

  it("search also matches description text mentioning the query", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools?q=Python&limit=100" });
    const body = res.json();
    expect(body.items.some((t: { name: string }) => t.name === "Python")).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it("searches by description text", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools?q=kernel" });
    const body = res.json();
    expect(body.items.some((t: { name: string }) => t.name === "Linux")).toBe(true);
  });

  it("filters by jar", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools?jar=jam&limit=100" });
    const body = res.json();
    expect(body.total).toBe(12);
    expect(body.items.every((t: { jarId: string }) => t.jarId === "jam")).toBe(true);
  });

  it("filters by licenseFamily", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools?licenseFamily=MIT&limit=100" });
    const body = res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((t: { licenseFamily: string }) => t.licenseFamily === "MIT")).toBe(true);
  });

  it("rejects an invalid licenseFamily", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools?licenseFamily=NotReal" });
    expect(res.statusCode).toBe(400);
  });

  it("sorts by name ascending by default", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tools?limit=100" });
    const names = res.json().items.map((t: { name: string }) => t.name.toLowerCase());
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });
});

describe("GET /api/licenses", () => {
  it("returns license family counts summing to 60", async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: "GET", url: "/api/licenses" });
    const body = res.json() as { family: string; count: number }[];
    const total = body.reduce((sum, row) => sum + row.count, 0);
    expect(total).toBe(60);
  });
});

describe("GET /api/stats", () => {
  it("returns aggregate stats", async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: "GET", url: "/api/stats" });
    const body = res.json();
    expect(body.tools).toBe(60);
    expect(body.jars).toBe(5);
    expect(Array.isArray(body.licenses)).toBe(true);
    expect(typeof body.updatedAt).toBe("string");
  });
});
