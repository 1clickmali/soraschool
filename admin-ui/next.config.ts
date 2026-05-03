import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_API_URL: isProd
      ? "https://sorasaas-api-production.up.railway.app"
      : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "sorasaas-api-production.up.railway.app" },
    ],
  },
};

export default nextConfig;
