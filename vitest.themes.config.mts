import path from "node:path";
import { defineConfig } from "vitest/config";
// Isolated theme service/schema tests: no database setup or truncation.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["tests/unit/themes.test.ts"] },
});
