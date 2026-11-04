import type { Jar, LicenseCount, Stats, SuggestionPayload, Tool, ToolPage } from "./types";

export interface ToolQuery {
  q?: string;
  jar?: string;
  licenseFamily?: string;
  sort?: "name" | "stars" | "recent";
  page?: number;
  limit?: number;
}

export interface SuggestionResponse {
  id: number;
  status: "pending";
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Fetcher = typeof fetch;

interface ErrorResponse {
  error?: string;
  fields?: Record<string, string>;
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function request<T>(fetcher: Fetcher, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });
  const body = await response.json() as T | ErrorResponse;

  if (!response.ok) {
    const error = body as ErrorResponse;
    throw new ApiError(
      error.error ?? `Request failed with status ${response.status}`,
      response.status,
      response.status === 400 && error.fields ? error.fields : {},
    );
  }

  return body as T;
}

export function createApi(
  baseUrl = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "http://localhost:8787",
  fetcher: Fetcher = fetch,
) {
  return {
    getJars: () => request<Jar[]>(fetcher, endpoint(baseUrl, "/api/jars")),

    getJarTools: (jarId: string) =>
      request<Tool[]>(fetcher, endpoint(baseUrl, `/api/jars/${encodeURIComponent(jarId)}/tools`)),

    getTools: (query: ToolQuery = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value));
      }
      const suffix = params.size > 0 ? `?${params}` : "";
      return request<ToolPage>(fetcher, endpoint(baseUrl, `/api/tools${suffix}`));
    },

    getTool: (slug: string) =>
      request<Tool>(fetcher, endpoint(baseUrl, `/api/tools/${encodeURIComponent(slug)}`)),

    getLicenses: () => request<LicenseCount[]>(fetcher, endpoint(baseUrl, "/api/licenses")),

    getStats: () => request<Stats>(fetcher, endpoint(baseUrl, "/api/stats")),

    submitSuggestion: (payload: SuggestionPayload) =>
      request<SuggestionResponse>(fetcher, endpoint(baseUrl, "/api/suggestions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  };
}

export type ApiClient = ReturnType<typeof createApi>;
