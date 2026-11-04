import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "../src/db.js";
import { parseJarsFromHtml, seedDatabase } from "../src/seed-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const htmlPath = path.resolve(__dirname, "../../index.html");
  const html = fs.readFileSync(htmlPath, "utf-8");
  const jars = parseJarsFromHtml(html);

  const dbPath = process.env.DB_PATH ?? "./data/sourcejar.db";
  const db = createDb(dbPath);

  const result = seedDatabase(db, jars);
  console.log(`Seeded ${result.jarCount} jars and ${result.toolCount} tools.`);

  db.close();
}

main();
