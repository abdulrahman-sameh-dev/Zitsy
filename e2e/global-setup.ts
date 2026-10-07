import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { STORE_TEST_DATABASE_URL } from "../tests/test-db";
import { CAPTURE_FILE, startStub } from "./resend-stub";

export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL = STORE_TEST_DATABASE_URL;
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: STORE_TEST_DATABASE_URL },
  });
  writeFileSync(CAPTURE_FILE, "[]\n");
  await startStub();
}
