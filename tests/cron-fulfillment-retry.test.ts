import { beforeEach, describe, expect, it, vi } from "vitest";

const cronSecret = vi.fn<() => string>();
const findMany = vi.fn();
const fulfillPaidOrder = vi.fn();

vi.mock("@/lib/config/env", () => ({
  cronSecret: () => cronSecret(),
}));
vi.mock("@/lib/db/prisma", () => ({
  db: { order: { findMany: (...args: unknown[]) => findMany(...args) } },
}));
vi.mock("@/lib/fulfillment/service", () => ({
  fulfillPaidOrder: (...args: unknown[]) => fulfillPaidOrder(...args),
}));
vi.mock("@/lib/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { GET } from "@/app/api/cron/fulfillment-retry/route";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://zitsy.example/api/cron/fulfillment-retry", {
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cron fulfillment retry route", () => {
  it("returns 503 when no CRON_SECRET is configured", async () => {
    cronSecret.mockReturnValue("");
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(findMany).not.toHaveBeenCalled();
    expect(fulfillPaidOrder).not.toHaveBeenCalled();
  });

  it("returns 401 without the correct bearer token", async () => {
    cronSecret.mockReturnValue("s3cret");
    const res = await GET(request({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("only sweeps paid, unsubmitted orders stuck on a transient Printify error", async () => {
    cronSecret.mockReturnValue("s3cret");
    findMany.mockResolvedValue([
      { id: "o1", orderNumber: "ZS-1" },
      { id: "o2", orderNumber: "ZS-2" },
    ]);
    fulfillPaidOrder.mockResolvedValue({ status: "created" });

    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      checked: 2,
      succeeded: 2,
      failed: 0,
    });

    const where = findMany.mock.calls[0][0]?.where;
    expect(where).toMatchObject({
      status: "PAID",
      printifyOrderId: null,
      fulfillmentAttempts: { lt: 10 },
      fulfillmentError: { startsWith: "printify_unavailable:" },
    });
    expect(findMany.mock.calls[0][0]?.take).toBe(20);
    expect(fulfillPaidOrder).toHaveBeenCalledTimes(2);
    expect(fulfillPaidOrder).toHaveBeenCalledWith("o1");
    expect(fulfillPaidOrder).toHaveBeenCalledWith("o2");
  });

  it("counts orders that still fail without breaking the sweep", async () => {
    cronSecret.mockReturnValue("s3cret");
    findMany.mockResolvedValue([
      { id: "o1", orderNumber: "ZS-1" },
      { id: "o2", orderNumber: "ZS-2" },
    ]);
    fulfillPaidOrder
      .mockResolvedValueOnce({ status: "failed", code: "printify_unavailable" })
      .mockResolvedValueOnce({ status: "created" });

    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      succeeded: 1,
      failed: 1,
    });
  });

  it("returns 500 when the sweep itself throws", async () => {
    cronSecret.mockReturnValue("s3cret");
    findMany.mockRejectedValue(new Error("boom"));
    const res = await GET(request({ authorization: "Bearer s3cret" }));
    expect(res.status).toBe(500);
    expect(fulfillPaidOrder).not.toHaveBeenCalled();
  });
});
