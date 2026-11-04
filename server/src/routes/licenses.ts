import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";

export function registerLicenseRoutes(app: FastifyInstance, db: Database.Database): void {
  const listLicenses = db.prepare(`
    SELECT license_family AS family, COUNT(*) AS count
    FROM tools
    GROUP BY license_family
    ORDER BY count DESC, family ASC
  `);

  app.get("/api/licenses", async () => listLicenses.all());
}
