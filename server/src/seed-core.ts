import type Database from "better-sqlite3";
import { licenseFamily } from "./lib/license.js";
import { slugify } from "./lib/slug.js";

export interface RawTool {
  n: string;
  s?: string;
  lic: string;
  d: string;
  url: string;
}

export interface RawJar {
  id: string;
  name: string;
  tag?: string;
  kind: string;
  color: string;
  dark: string;
  light: string;
  lid: string;
  tools: RawTool[];
}

/**
 * Extracts the `const JARS = [ ... ];` array literal out of index.html and
 * evaluates only that block (no other script code is executed).
 */
export function parseJarsFromHtml(html: string): RawJar[] {
  const marker = "const JARS = ";
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Could not find `const JARS = [` in index.html");
  }

  const arrStart = html.indexOf("[", markerIndex);
  if (arrStart === -1) {
    throw new Error("Malformed JARS declaration: no opening bracket found");
  }

  let depth = 0;
  let end = -1;
  for (let i = arrStart; i < html.length; i++) {
    const ch = html[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error("Malformed JARS declaration: no matching closing bracket found");
  }

  const literal = html.slice(arrStart, end);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const evaluate = new Function(`"use strict"; return (${literal});`);
  return evaluate() as RawJar[];
}

export interface SeedResult {
  jarCount: number;
  toolCount: number;
}

export function seedDatabase(db: Database.Database, jars: RawJar[]): SeedResult {
  const now = new Date().toISOString();

  const upsertJar = db.prepare(`
    INSERT INTO jars (id, name, kind, color, dark, light, lid, sort_order)
    VALUES (@id, @name, @kind, @color, @dark, @light, @lid, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      kind = excluded.kind,
      color = excluded.color,
      dark = excluded.dark,
      light = excluded.light,
      lid = excluded.lid,
      sort_order = excluded.sort_order
  `);

  const upsertTool = db.prepare(`
    INSERT INTO tools (
      slug, name, short_label, jar_id, license, license_family,
      description, url, repo_url, stars, last_commit_at,
      seed_order, created_at, updated_at
    )
    VALUES (
      @slug, @name, @short_label, @jar_id, @license, @license_family,
      @description, @url, NULL, NULL, NULL,
      @seed_order, @created_at, @updated_at
    )
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      short_label = excluded.short_label,
      jar_id = excluded.jar_id,
      license = excluded.license,
      license_family = excluded.license_family,
      description = excluded.description,
      url = excluded.url,
      seed_order = excluded.seed_order,
      updated_at = excluded.updated_at
  `);

  let toolCount = 0;

  const run = db.transaction((jarsData: RawJar[]) => {
    jarsData.forEach((jar, jarIndex) => {
      upsertJar.run({
        id: jar.id,
        name: jar.name,
        kind: jar.kind,
        color: jar.color,
        dark: jar.dark,
        light: jar.light,
        lid: jar.lid,
        sort_order: jarIndex,
      });

      jar.tools.forEach((tool, toolIndex) => {
        const slug = slugify(tool.n);
        upsertTool.run({
          slug,
          name: tool.n,
          short_label: tool.s ?? null,
          jar_id: jar.id,
          license: tool.lic,
          license_family: licenseFamily(tool.lic),
          description: tool.d,
          url: tool.url,
          seed_order: toolIndex,
          created_at: now,
          updated_at: now,
        });
        toolCount++;
      });
    });
  });

  run(jars);

  return { jarCount: jars.length, toolCount };
}
