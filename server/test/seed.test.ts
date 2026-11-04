import { describe, expect, it } from "vitest";
import { createDb } from "../src/db.js";
import { seedDatabase } from "../src/seed-core.js";
import { loadJarsFixture } from "./helpers.js";

describe("seed parsing", () => {
  it("parses 5 jars with 60 total tools from index.html", () => {
    const jars = loadJarsFixture();
    expect(jars).toHaveLength(5);
    const totalTools = jars.reduce((sum, jar) => sum + jar.tools.length, 0);
    expect(totalTools).toBe(60);
  });

  it("seeds the database with 5 jars and 60 tools", () => {
    const db = createDb(":memory:");
    const jars = loadJarsFixture();
    const result = seedDatabase(db, jars);
    expect(result.jarCount).toBe(5);
    expect(result.toolCount).toBe(60);

    const jarCount = (db.prepare("SELECT COUNT(*) as c FROM jars").get() as { c: number }).c;
    const toolCount = (db.prepare("SELECT COUNT(*) as c FROM tools").get() as { c: number }).c;
    expect(jarCount).toBe(5);
    expect(toolCount).toBe(60);
  });

  it("running seed twice does not create duplicates", () => {
    const db = createDb(":memory:");
    const jars = loadJarsFixture();
    seedDatabase(db, jars);
    seedDatabase(db, jars);

    const jarCount = (db.prepare("SELECT COUNT(*) as c FROM jars").get() as { c: number }).c;
    const toolCount = (db.prepare("SELECT COUNT(*) as c FROM tools").get() as { c: number }).c;
    expect(jarCount).toBe(5);
    expect(toolCount).toBe(60);
  });

  it("preserves seed order per jar via seed_order", () => {
    const db = createDb(":memory:");
    const jars = loadJarsFixture();
    seedDatabase(db, jars);

    const pb = jars.find((j) => j.id === "pb")!;
    const rows = db
      .prepare("SELECT name FROM tools WHERE jar_id = 'pb' ORDER BY seed_order ASC")
      .all() as { name: string }[];

    expect(rows.map((r) => r.name)).toEqual(pb.tools.map((t) => t.n));
  });
});
