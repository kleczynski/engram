import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile above this directory otherwise wins root inference.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
