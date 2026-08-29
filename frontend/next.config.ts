import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination: "http://15.252.138.61:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
