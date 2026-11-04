import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import type { JarRow, ToolRow } from "../types.js";
import { toolRowToJson } from "../types.js";

export function registerJarRoutes(app: FastifyInstance, db: Database.Database): void {
  const listJars = db.prepare(`
    SELECT j.*, (SELECT COUNT(*) FROM tools t WHERE t.jar_id = j.id) AS toolCount
    FROM jars j
    ORDER BY j.sort_order ASC
  `);

  const getJar = db.prepare("SELECT * FROM jars WHERE id = ?");

  const listToolsForJar = db.prepare(`
    SELECT * FROM tools WHERE jar_id = ? ORDER BY seed_order ASC
  `);

  app.get("/api/jars", async () => {
    const rows = listJars.all() as (JarRow & { toolCount: number })[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      color: row.color,
      dark: row.dark,
      light: row.light,
      lid: row.lid,
      toolCount: row.toolCount,
    }));
  });

  app.get<{ Params: { id: string } }>("/api/jars/:id/tools", async (request, reply) => {
    const jar = getJar.get(request.params.id);
    if (!jar) {
      reply.status(404).send({ error: "Jar not found" });
      return;
    }
    const rows = listToolsForJar.all(request.params.id) as ToolRow[];
    return rows.map(toolRowToJson);
  });
}
