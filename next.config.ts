import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tensorflow/tfjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    middlewareClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
