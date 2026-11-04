import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "../src/db.js";
import { parseJarsFromHtml, seedDatabase, type RawJar } from "../src/seed-core.js";
import { buildApp } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadJarsFixture(): RawJar[] {
  const htmlPath = path.resolve(__dirname, "../../index.html");
  const html = fs.readFileSync(htmlPath, "utf-8");
  return parseJarsFromHtml(html);
}

export const ADMIN_TOKEN = "test-admin-token";

export function buildTestApp() {
  const db = createDb(":memory:");
  const jars = loadJarsFixture();
  seedDatabase(db, jars);
  const app = buildApp({ db, adminToken: ADMIN_TOKEN });
  return { app, db };
}
