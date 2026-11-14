/** @type {import('next').NextConfig} */
const backend = (process.env.BACKEND_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Answers can take a while when the AI provider is busy; the backend caps
    // its own time budget well below this.
    proxyTimeout: 120_000,
  },
  // The browser calls /api/* on the same origin; Next proxies to the backend.
  // Set NEXT_PUBLIC_API_URL instead to call the backend directly (needs CORS).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
