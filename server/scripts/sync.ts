import "dotenv/config";
import { createDb } from "../src/db.js";
import { syncStars } from "../src/sync-core.js";

async function main() {
  const dbPath = process.env.DB_PATH ?? "./data/sourcejar.db";
  const db = createDb(dbPath);

  const result = await syncStars(db, { token: process.env.GITHUB_TOKEN });
  console.log(result.message);

  db.close();
}

main();
