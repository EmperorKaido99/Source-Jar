export interface Jar {
  id: string;
  name: string;
  kind: string;
  color: string;
  dark: string;
  light: string;
  lid: string;
  toolCount: number;
}

export interface Tool {
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

export interface LicenseCount {
  family: string;
  count: number;
}

export interface Stats {
  tools: number;
  jars: number;
  licenses: LicenseCount[];
  updatedAt: string;
}

export interface ToolPage {
  items: Tool[];
  page: number;
  limit: number;
  total: number;
}

export interface SuggestionPayload {
  name: string;
  url: string;
  jarId: string;
  description: string;
  license?: string;
  repoUrl?: string;
  note?: string;
}
