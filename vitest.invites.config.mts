import path from "node:path";
import { defineConfig } from "vitest/config";
// Isolated unit tests: no database setup, real emails, or data deletion.
export default defineConfig({resolve:{alias:{"@":path.resolve(__dirname,"src")}},test:{include:["tests/invite-email.unit.test.ts"],environment:"node"}});
