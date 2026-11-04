import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type Database from "better-sqlite3";
import type { SuggestionRow, ToolRow } from "../types.js";
import { toolRowToJson } from "../types.js";
import { licenseFamily } from "../lib/license.js";
import { slugify } from "../lib/slug.js";

function requireAdmin(adminToken: string | undefined) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const header = request.headers.authorization;
    const expected = adminToken ? `Bearer ${adminToken}` : undefined;
    if (!expected || header !== expected) {
      reply.status(401).send({ error: "Unauthorized" });
      return;
    }
    done();
  };
}

export function registerAdminRoutes(
  app: FastifyInstance,
  db: Database.Database,
  adminToken: string | undefined
): void {
  const auth = requireAdmin(adminToken);

  const listByStatus = db.prepare("SELECT * FROM suggestions WHERE status = ? ORDER BY created_at ASC");
  const listAll = db.prepare("SELECT * FROM suggestions ORDER BY created_at ASC");
  const getSuggestion = db.prepare("SELECT * FROM suggestions WHERE id = ?");
  const setStatus = db.prepare("UPDATE suggestions SET status = ? WHERE id = ?");
  const getMaxSeedOrder = db.prepare("SELECT MAX(seed_order) AS maxOrder FROM tools WHERE jar_id = ?");
  const getToolBySlug = db.prepare("SELECT * FROM tools WHERE slug = ?");
  const insertTool = db.prepare(`
    INSERT INTO tools (
      slug, name, short_label, jar_id, license, license_family,
      description, url, repo_url, stars, last_commit_at,
      seed_order, created_at, updated_at
    )
    VALUES (
      @slug, @name, NULL, @jar_id, @license, @license_family,
      @description, @url, @repo_url, NULL, NULL,
      @seed_order, @created_at, @updated_at
    )
  `);

  app.get("/api/admin/suggestions", { preHandler: auth }, async (request) => {
    const status = (request.query as { status?: string }).status;
    const rows = (status ? listByStatus.all(status) : listAll.all()) as SuggestionRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      repoUrl: row.repo_url,
      jarId: row.jar_id,
      description: row.description,
      license: row.license,
      submitterNote: row.submitter_note,
      status: row.status,
      createdAt: row.created_at,
    }));
  });

  app.post<{ Params: { id: string } }>(
    "/api/admin/suggestions/:id/approve",
    { preHandler: auth },
    async (request, reply) => {
      const suggestion = getSuggestion.get(request.params.id) as SuggestionRow | undefined;
      if (!suggestion) {
        reply.status(404).send({ error: "Suggestion not found" });
        return;
      }
      if (suggestion.status !== "pending") {
        reply.status(400).send({ error: "Suggestion is not pending" });
        return;
      }

      let slug = slugify(suggestion.name);
      if (getToolBySlug.get(slug)) {
        slug = `${slug}-${suggestion.id}`;
      }

      const license = suggestion.license ?? "Other";
      const now = new Date().toISOString();
      const maxOrder = (getMaxSeedOrder.get(suggestion.jar_id) as { maxOrder: number | null }).maxOrder;

      insertTool.run({
        slug,
        name: suggestion.name,
        jar_id: suggestion.jar_id,
        license,
        license_family: licenseFamily(license),
        description: suggestion.description,
        url: suggestion.url,
        repo_url: suggestion.repo_url,
        seed_order: (maxOrder ?? -1) + 1,
        created_at: now,
        updated_at: now,
      });

      setStatus.run("approved", suggestion.id);

      const tool = getToolBySlug.get(slug) as ToolRow;
      reply.send(toolRowToJson(tool));
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/admin/suggestions/:id/reject",
    { preHandler: auth },
    async (request, reply) => {
      const suggestion = getSuggestion.get(request.params.id) as SuggestionRow | undefined;
      if (!suggestion) {
        reply.status(404).send({ error: "Suggestion not found" });
        return;
      }
      if (suggestion.status !== "pending") {
        reply.status(400).send({ error: "Suggestion is not pending" });
        return;
      }
      setStatus.run("rejected", suggestion.id);
      reply.send({ id: suggestion.id, status: "rejected" });
    }
  );
}
