import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build that runs as a Node site behind IIS.
  output: "standalone",
  async rewrites() {
    // Development only: in production IIS routes /api to the API so the browser sees one origin.
    if (process.env.NODE_ENV === "production") return [];
    const api = process.env.API_URL ?? "http://localhost:5080";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
