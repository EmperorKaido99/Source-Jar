export interface JarRow {
  id: string;
  name: string;
  kind: string;
  color: string;
  dark: string;
  light: string;
  lid: string;
  sort_order: number;
}

export interface ToolRow {
  slug: string;
  name: string;
  short_label: string | null;
  jar_id: string;
  license: string;
  license_family: string;
  description: string;
  url: string;
  repo_url: string | null;
  stars: number | null;
  last_commit_at: string | null;
  seed_order: number;
  created_at: string;
  updated_at: string;
}

export interface SuggestionRow {
  id: number;
  name: string;
  url: string;
  repo_url: string | null;
  jar_id: string;
  description: string;
  license: string | null;
  submitter_note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface ToolJson {
  slug: string;
  name: string;
  shortLabel: string | null;
  jarId: string;
  license: string;
  licenseFamily: string;
  description: string;
  url: string;
  repoUrl: string | null;
  stars: number | null;
  lastCommitAt: string | null;
}

export function toolRowToJson(row: ToolRow): ToolJson {
  return {
    slug: row.slug,
    name: row.name,
    shortLabel: row.short_label,
    jarId: row.jar_id,
    license: row.license,
    licenseFamily: row.license_family,
    description: row.description,
    url: row.url,
    repoUrl: row.repo_url,
    stars: row.stars,
    lastCommitAt: row.last_commit_at,
  };
}
