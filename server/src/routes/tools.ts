import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { z } from "zod";
import type { ToolRow } from "../types.js";
import { toolRowToJson } from "../types.js";
import { LICENSE_FAMILIES } from "../lib/license.js";

const querySchema = z.object({
  q: z.string().trim().min(1).optional(),
  jar: z.string().trim().min(1).optional(),
  licenseFamily: z.enum(LICENSE_FAMILIES).optional(),
  sort: z.enum(["name", "stars", "recent"]).default("name"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

const SORT_CLAUSES: Record<string, string> = {
  name: "ORDER BY t.name COLLATE NOCASE ASC",
  stars: "ORDER BY t.stars IS NULL, t.stars DESC",
  recent: "ORDER BY t.last_commit_at IS NULL, t.last_commit_at DESC",
};

export function registerToolRoutes(app: FastifyInstance, db: Database.Database): void {
  const getToolBySlug = db.prepare("SELECT * FROM tools WHERE slug = ?");

  app.get("/api/tools", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.status(400).send({ error: "Invalid query parameters" });
      return;
    }
    const { q, jar, licenseFamily, sort, page, limit } = parsed.data;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q) {
      conditions.push("(t.name LIKE ? OR t.description LIKE ? OR t.license LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (jar) {
      conditions.push("t.jar_id = ?");
      params.push(jar);
    }
    if (licenseFamily) {
      conditions.push("t.license_family = ?");
      params.push(licenseFamily);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderClause = SORT_CLAUSES[sort];

    const totalRow = db
      .prepare(`SELECT COUNT(*) as count FROM tools t ${whereClause}`)
      .get(...params) as { count: number };

    const offset = (page - 1) * limit;
    const items = db
      .prepare(`SELECT t.* FROM tools t ${whereClause} ${orderClause} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as ToolRow[];

    return {
      items: items.map(toolRowToJson),
      page,
      limit,
      total: totalRow.count,
    };
  });

  app.get<{ Params: { slug: string } }>("/api/tools/:slug", async (request, reply) => {
    const row = getToolBySlug.get(request.params.slug) as ToolRow | undefined;
    if (!row) {
      reply.status(404).send({ error: "Tool not found" });
      return;
    }
    return toolRowToJson(row);
  });
}
