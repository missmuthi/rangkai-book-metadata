import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: path.resolve("./src/lib/server/db/schema.ts"),
  out: "./drizzle",
  driver: "d1",
});
