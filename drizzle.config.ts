import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load environment variables from .env.local (Next.js convention) and .env
config({ path: ".env.local" });
config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL or DATABASE_URL_UNPOOLED in environment");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
