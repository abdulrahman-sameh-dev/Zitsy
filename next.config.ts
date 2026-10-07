import type { NextConfig } from "next";

/**
 * Conservative baseline security headers.
 *
 * Deliberately no Content-Security-Policy: the store must load the PayPal JS
 * SDK and Printify-hosted product imagery, and an over-restrictive CSP would
 * break checkout (§19).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** Order pages carry PII and are rendered per request — never cached. */
const privateOrderHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images-api.printify.com",
      },
      {
        protocol: "https",
        hostname: "images.printify.com",
      },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/checkout/success",
        headers: privateOrderHeaders,
      },
      {
        source: "/track-order/:path*",
        headers: privateOrderHeaders,
      },
    ];
  },
};

export default nextConfig;
