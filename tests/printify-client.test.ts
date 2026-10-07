import { afterEach, describe, expect, it, vi } from "vitest";

import { PrintifyApiError, PrintifyClient } from "@/lib/printify/client";

function client(): PrintifyClient {
  return new PrintifyClient({ token: "tok", shopId: "shop-1" });
}

interface StubbedRoute {
  match: (url: URL) => boolean;
  body: unknown;
  status?: number;
}

function stubFetch(routes: StubbedRoute[]): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string" ? new URL(input) : new URL(input as unknown as string);
    const route = routes.find((r) => r.match(url));
    if (!route) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PrintifyClient", () => {
  it("sends bearer auth and parses list responses", async () => {
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return new Response(
        JSON.stringify({ current_page: 1, data: [{ id: "P1", title: "Mug" }], last_page: 1 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const list = await client().listProducts();

    expect(list.data).toHaveLength(1);
    expect(captured?.url).toContain("https://api.printify.com/v1/shops/shop-1/products.json");
    expect(captured?.url).toContain("page=1");
    expect(captured?.url).toContain("limit=50");
    expect(captured?.init?.headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("paginates through every product page", async () => {
    const pages = [
      { current_page: 1, data: [{ id: "P1" }, { id: "P2" }], next_page_url: "/?page=2" },
      { current_page: 2, data: [{ id: "P3" }], next_page_url: null },
    ];
    let page = 0;
    vi.stubGlobal("fetch", async () => {
      const body = pages[page];
      page += 1;
      return new Response(JSON.stringify({ ...body, data: body.data } as never), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const all = await client().getAllProducts();

    expect(all.map((p) => p.id)).toEqual(["P1", "P2", "P3"]);
    expect(page).toBe(2);
  });

  it("surfaces non-2xx responses as PrintifyApiError with status", async () => {
    stubFetch([
      {
        match: () => true,
        status: 401,
        body: { message: "Unauthenticated" },
      },
    ]);

    try {
      await client().getProduct("nope");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PrintifyApiError);
      const apiErr = err as PrintifyApiError;
      expect(apiErr.status).toBe(401);
      expect(apiErr.message).toContain("Unauthenticated");
    }
  });

  it("posts JSON bodies for order creation", async () => {
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return new Response(JSON.stringify({ id: "o1", status: "submitted" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    });

    const order = await client().createOrder({
      external_id: "ord-1",
      line_items: [{ product_id: "P1", variant_id: 1001, quantity: 1 }],
      address_to: {
        first_name: "Jane",
        last_name: "Smith",
        address1: "1 Main St",
        city: "London",
        zip: "SW1",
        country: "GB",
        email: "jane@example.com",
      },
      label: "ord-1",
    });

    expect(order.id).toBe("o1");
    expect(captured?.url).toContain("/shops/shop-1/orders.json");
    expect(captured?.init?.method).toBe("POST");
    expect(captured?.init?.headers).toMatchObject({
      "Content-Type": "application/json",
    });
    const sent = JSON.parse(String(captured?.init?.body)) as {
      external_id: string;
      line_items: Array<{ variant_id: number }>;
    };
    expect(sent.external_id).toBe("ord-1");
    expect(sent.line_items[0].variant_id).toBe(1001);
  });
});