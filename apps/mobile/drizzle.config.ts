import { defineConfig } from "drizzle-kit";
export default defineConfig({ dialect: "sqlite", schema: "./data/db/schema.ts", out: "./drizzle" });
