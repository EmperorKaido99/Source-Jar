import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";

export function registerStatsRoutes(app: FastifyInstance, db: Database.Database): void {
  const countTools = db.prepare("SELECT COUNT(*) AS count FROM tools");
  const countJars = db.prepare("SELECT COUNT(*) AS count FROM jars");
  const listLicenses = db.prepare(`
    SELECT license_family AS family, COUNT(*) AS count
    FROM tools
    GROUP BY license_family
    ORDER BY count DESC, family ASC
  `);
  const maxUpdatedAt = db.prepare("SELECT MAX(updated_at) AS updatedAt FROM tools");

  app.get("/api/stats", async () => {
    const tools = (countTools.get() as { count: number }).count;
    const jars = (countJars.get() as { count: number }).count;
    const licenses = listLicenses.all();
    const row = maxUpdatedAt.get() as { updatedAt: string | null };
    return {
      tools,
      jars,
      licenses,
      updatedAt: row.updatedAt ?? new Date().toISOString(),
    };
  });
}
