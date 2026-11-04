import cors from "@fastify/cors";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { registerHealthRoutes } from "./routes/health.js";
import { registerJarRoutes } from "./routes/jars.js";
import { registerToolRoutes } from "./routes/tools.js";
import { registerLicenseRoutes } from "./routes/licenses.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerSuggestionRoutes } from "./routes/suggestions.js";
import { registerAdminRoutes } from "./routes/admin.js";

export interface AppOptions {
  db: Database.Database;
  corsOrigin?: string;
  adminToken?: string;
}

export function buildApp(options: AppOptions): FastifyInstance {
  const { db, corsOrigin, adminToken } = options;

  const app = Fastify({ logger: false });

  const allowedOrigins = new Set(["http://localhost:5173"]);
  if (corsOrigin) allowedOrigins.add(corsOrigin);

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      reply.status(400).send({ error: "Invalid request" });
      return;
    }
    app.log.error(error);
    reply.status(500).send({ error: "Internal server error" });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: "Not found" });
  });

  registerHealthRoutes(app);
  registerJarRoutes(app, db);
  registerToolRoutes(app, db);
  registerLicenseRoutes(app, db);
  registerStatsRoutes(app, db);
  registerSuggestionRoutes(app, db);
  registerAdminRoutes(app, db, adminToken);

  return app;
}
