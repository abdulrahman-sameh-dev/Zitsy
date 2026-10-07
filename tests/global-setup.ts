import { execSync } from "node:child_process";

import { STORE_TEST_DATABASE_URL } from "./test-db";

export default function globalSetup(): void {
  process.env.DATABASE_URL = STORE_TEST_DATABASE_URL;
  try {
    execSync("pnpm exec prisma migrate deploy", {
      stdio: "inherit",
      env: process.env,
    });
  } catch (err) {
    console.error("test database migration failed");
    throw err;
  }
}