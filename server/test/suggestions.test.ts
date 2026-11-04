import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers.js";
import { __resetRateLimitForTests } from "../src/routes/suggestions.js";

describe("POST /api/suggestions", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildTestApp().app;
    __resetRateLimitForTests();
  });

  const validBody = {
    name: "Zig Tools",
    url: "https://example.com/zig-tools",
    jarId: "jam",
    description: "A collection of helpful tools for the Zig ecosystem.",
  };

  it("accepts a valid suggestion", async () => {
    const res = await app.inject({ method: "POST", url: "/api/suggestions", payload: validBody });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe("pending");
    expect(body.id).toBeDefined();
  });

  it("rejects a name longer than 60 chars", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/suggestions",
      payload: { ...validBody, name: "x".repeat(61) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields.name).toBeDefined();
  });

  it("rejects a non-https url", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/suggestions",
      payload: { ...validBody, url: "http://example.com/tool" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields.url).toBeDefined();
  });

  it("rejects an unknown jarId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/suggestions",
      payload: { ...validBody, jarId: "peanut-brittle" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields.jarId).toBeDefined();
  });

  it("rejects a description shorter than 10 chars", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/suggestions",
      payload: { ...validBody, description: "too short" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields.description).toBeDefined();
  });

  it("rejects a description longer than 140 chars", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/suggestions",
      payload: { ...validBody, description: "x".repeat(141) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields.description).toBeDefined();
  });

  it("rejects a url that already matches an existing tool", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/suggestions",
      payload: { ...validBody, url: "https://kernel.org" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields.url).toBeDefined();
  });

  it("rate limits after 5 requests per IP per hour", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/suggestions",
        payload: { ...validBody, url: `https://example.com/tool-${i}` },
      });
      expect(res.statusCode).toBe(201);
    }
    const res = await app.inject({
      method: "POST",
      url: "/api/suggestions",
      payload: { ...validBody, url: "https://example.com/tool-6" },
    });
    expect(res.statusCode).toBe(429);
  });
});
