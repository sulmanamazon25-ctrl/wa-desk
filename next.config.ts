import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: [],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
