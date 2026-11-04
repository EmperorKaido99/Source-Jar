import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { z } from "zod";

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const httpsUrl = (message: string) => z.string().trim().refine(isHttpsUrl, message);

const bodySchema = z.object({
  name: z.string().trim().min(1, "Name must be 1–60 characters").max(60, "Name must be 1–60 characters"),
  url: httpsUrl("url must be a valid https URL"),
  jarId: z.string().trim().min(1, "jarId is required"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be 10–140 characters")
    .max(140, "Description must be 10–140 characters"),
  license: z.string().trim().optional(),
  repoUrl: httpsUrl("repoUrl must be a valid https URL").optional(),
  note: z.string().trim().optional(),
});

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

let hits = new Map<string, number[]>();

export function __resetRateLimitForTests(): void {
  hits = new Map();
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) {
    hits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  return false;
}

export function registerSuggestionRoutes(app: FastifyInstance, db: Database.Database): void {
  const getJar = db.prepare("SELECT id FROM jars WHERE id = ?");
  const getToolByUrl = db.prepare("SELECT slug FROM tools WHERE url = ?");
  const insertSuggestion = db.prepare(`
    INSERT INTO suggestions (name, url, repo_url, jar_id, description, license, submitter_note, status, created_at)
    VALUES (@name, @url, @repo_url, @jar_id, @description, @license, @submitter_note, 'pending', @created_at)
  `);

  app.post("/api/suggestions", async (request, reply) => {
    if (isRateLimited(request.ip)) {
      reply.status(429).send({ error: "Too many suggestions from this IP. Try again later." });
      return;
    }

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "body";
        if (!fields[key]) fields[key] = issue.message;
      }
      reply.status(400).send({ error: "Validation failed", fields });
      return;
    }

    const { name, url, jarId, description, license, repoUrl, note } = parsed.data;

    if (!getJar.get(jarId)) {
      reply.status(400).send({ error: "Validation failed", fields: { jarId: "Jar does not exist" } });
      return;
    }

    if (getToolByUrl.get(url)) {
      reply.status(400).send({ error: "Validation failed", fields: { url: "A tool with this URL already exists" } });
      return;
    }

    const result = insertSuggestion.run({
      name,
      url,
      repo_url: repoUrl ?? null,
      jar_id: jarId,
      description,
      license: license ?? null,
      submitter_note: note ?? null,
      created_at: new Date().toISOString(),
    });

    reply.status(201).send({ id: result.lastInsertRowid, status: "pending" });
  });
}
