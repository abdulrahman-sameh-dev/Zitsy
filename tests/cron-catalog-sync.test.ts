import { beforeEach, describe, expect, it, vi } from "vitest";

const cronSecret = vi.fn<() => string>();
const syncCatalog = vi.fn();

vi.mock("@/lib/config/env", () => ({ cronSecret: () => cronSecret() }));
vi.mock("@/lib/catalog/sync", () => ({ syncCatalog: (...args: unknown[]) => syncCatalog(...args) }));
vi.mock("@/lib/printify/client", () => ({ getPrintifyClient: () => ({}) }));
vi.mock("@/lib/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { GET } from "@/app/api/cron/catalog-sync/route";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://zitsy.example/api/cron/catalog-sync", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cron catalog sync route", () => {
  it("returns 503 when no CRON_SECRET is configured", async () => {
    cronSecret.mockReturnValue("");
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(syncCatalog).not.toHaveBeenCalled();
  });

  it("returns 401 without the correct bearer token", async () => {
    cronSecret.mockReturnValue("s3cret");
    const res = await GET(request({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(syncCatalog).not.toHaveBeenCalled();
  });

  it("runs the sync with a valid bearer token", async () => {
    cronSecret.mockReturnValue("s3cret");
    syncCatalog.mockResolvedValue({
      productsSeen: 2,
      productsUpserted: 2,
      productsHidden: 0,
      errors: [],
    });
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, productsUpserted: 2 });
    expect(syncCatalog).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the sync throws", async () => {
    cronSecret.mockReturnValue("s3cret");
    syncCatalog.mockRejectedValue(new Error("boom"));
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(500);
  });
});