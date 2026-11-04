import "dotenv/config";
import { buildApp } from "./app.js";
import { createDb } from "./db.js";

const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.DB_PATH ?? "./data/sourcejar.db";
const corsOrigin = process.env.CORS_ORIGIN;
const adminToken = process.env.ADMIN_TOKEN;

const db = createDb(dbPath);
const app = buildApp({ db, corsOrigin, adminToken });

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    console.log(`Source Jar API listening on http://localhost:${port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
