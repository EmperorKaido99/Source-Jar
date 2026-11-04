import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { ADMIN_TOKEN, buildTestApp } from "./helpers.js";

function insertPendingSuggestion(db: Database.Database) {
  const result = db
    .prepare(
      `INSERT INTO suggestions (name, url, repo_url, jar_id, description, license, submitter_note, status, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, NULL, 'pending', ?)`
    )
    .run("Cool Tool", "https://example.com/cool-tool", "jam", "A genuinely useful developer tool.", "MIT", new Date().toISOString());
  return result.lastInsertRowid as number;
}

describe("admin routes auth", () => {
  let app: FastifyInstance;
  beforeEach(() => {
    app = buildTestApp().app;
  });

  it("rejects requests without a bearer token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/suggestions" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects requests with the wrong token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/suggestions",
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("admin suggestions workflow", () => {
  let app: FastifyInstance;
  let db: Database.Database;
  beforeEach(() => {
    const built = buildTestApp();
    app = built.app;
    db = built.db;
  });

  it("lists pending suggestions", async () => {
    insertPendingSuggestion(db);
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/suggestions?status=pending",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Cool Tool");
  });

  it("approves a suggestion and creates the tool", async () => {
    const id = insertPendingSuggestion(db);
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/suggestions/${id}/approve`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    const tool = res.json();
    expect(tool.slug).toBe("cool-tool");
    expect(tool.name).toBe("Cool Tool");
    expect(tool.jarId).toBe("jam");

    const toolCheck = await app.inject({ method: "GET", url: "/api/tools/cool-tool" });
    expect(toolCheck.statusCode).toBe(200);

    const statusCheck = db.prepare("SELECT status FROM suggestions WHERE id = ?").get(id) as {
      status: string;
    };
    expect(statusCheck.status).toBe("approved");
  });

  it("rejects a suggestion", async () => {
    const id = insertPendingSuggestion(db);
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/suggestions/${id}/reject`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id, status: "rejected" });

    const statusCheck = db.prepare("SELECT status FROM suggestions WHERE id = ?").get(id) as {
      status: string;
    };
    expect(statusCheck.status).toBe("rejected");
  });

  it("404s approving an unknown suggestion", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/suggestions/9999/approve",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
