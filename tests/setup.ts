import "dotenv/config";

import { beforeEach, vi } from "vitest";

import { resetRateLimits } from "@/lib/rate-limit";

import { STORE_TEST_DATABASE_URL } from "./test-db";
import { fakeEmail } from "./fake-email";

process.env.DATABASE_URL = STORE_TEST_DATABASE_URL;

// Safety net: never let a test reach the real Printify API. Tests that exercise
// fulfillment must inject a fake `PrintifyOrderGateway` explicitly.
vi.mock("@/lib/printify/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/printify/client")>();
  return {
    ...actual,
    getPrintifyClient: () => {
      throw new Error("Printify client is disabled in tests; inject a fake gateway");
    },
  };
});

// Safety net: never let a test reach Resend. Assertions read `fakeEmail.sent`;
// failure paths flip `fakeEmail.failAll` or inject a transport directly.
vi.mock("@/lib/email/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/client")>();
  return {
    ...actual,
    getEmailTransport: () => fakeEmail,
  };
});

beforeEach(() => {
  fakeEmail.reset();
  resetRateLimits();
});
