import type Database from "better-sqlite3";
import { repoMap } from "./repo-map.js";
import type { ToolRow } from "./types.js";

const GITHUB_URL_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?(?:$|[?#])/i;

export function resolveRepo(slug: string, url: string): { owner: string; repo: string } | null {
  const match = GITHUB_URL_RE.exec(url);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  const mapped = repoMap[slug];
  if (mapped) {
    const [owner, repo] = mapped.split("/");
    return { owner, repo };
  }
  return null;
}

export interface SyncOptions {
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface SyncResult {
  updated: number;
  skipped: number;
  stoppedEarly: boolean;
  message: string;
}

export async function syncStars(db: Database.Database, options: SyncOptions = {}): Promise<SyncResult> {
  const { token, fetchImpl = fetch } = options;

  if (!token) {
    return {
      updated: 0,
      skipped: 0,
      stoppedEarly: false,
      message: "No GITHUB_TOKEN set, skipping GitHub enrichment.",
    };
  }

  const tools = db.prepare("SELECT * FROM tools").all() as ToolRow[];
  const update = db.prepare(
    "UPDATE tools SET repo_url = ?, stars = ?, last_commit_at = ?, updated_at = ? WHERE slug = ?"
  );

  let updated = 0;
  let skipped = 0;
  let stoppedEarly = false;

  for (const tool of tools) {
    const resolved = resolveRepo(tool.slug, tool.url);
    if (!resolved) {
      skipped++;
      continue;
    }

    const res = await fetchImpl(`https://api.github.com/repos/${resolved.owner}/${resolved.repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "source-jar-sync",
      },
    });

    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
      stoppedEarly = true;
      break;
    }

    if (!res.ok) {
      skipped++;
      continue;
    }

    const data = (await res.json()) as { stargazers_count: number; pushed_at: string };
    update.run(
      `https://github.com/${resolved.owner}/${resolved.repo}`,
      data.stargazers_count,
      data.pushed_at,
      new Date().toISOString(),
      tool.slug
    );
    updated++;
  }

  const message = stoppedEarly
    ? `Stopped early due to GitHub rate limiting. Updated ${updated} of ${tools.length} tools.`
    : `Updated ${updated} of ${tools.length} tools (${skipped} skipped).`;

  return { updated, skipped, stoppedEarly, message };
}
