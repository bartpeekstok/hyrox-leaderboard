import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath:
    process.env.NEXT_PUBLIC_PUBLIC_ONLY === "true"
      ? "/hyrox-simulatie-alkmaar"
      : undefined,
};

export default nextConfig;
