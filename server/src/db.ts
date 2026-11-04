import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jars (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  color TEXT NOT NULL,
  dark TEXT NOT NULL,
  light TEXT NOT NULL,
  lid TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tools (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_label TEXT,
  jar_id TEXT NOT NULL REFERENCES jars(id),
  license TEXT NOT NULL,
  license_family TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  repo_url TEXT,
  stars INTEGER,
  last_commit_at TEXT,
  seed_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tools_jar_id ON tools(jar_id);

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  repo_url TEXT,
  jar_id TEXT NOT NULL,
  description TEXT NOT NULL,
  license TEXT,
  submitter_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
`;

export function createDb(dbPath: string): Database.Database {
  if (dbPath !== ":memory:") {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(dbPath);
  if (dbPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }
  db.exec(SCHEMA);
  return db;
}
