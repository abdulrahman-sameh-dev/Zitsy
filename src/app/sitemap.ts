import { connection } from "next/server";

import { site } from "@/lib/config/public-env";
import { listSitemapProducts } from "@/lib/catalog/query";

export default async function sitemap() {
  await connection();
  const products = await listSitemapProducts();
  const base = site.url;

  const staticPages = [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/cart`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/shipping`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/returns`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/sizing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  ] as const;

  return [
    ...staticPages,
    ...products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}