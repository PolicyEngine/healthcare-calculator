import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // recharts ships CJS interop and reads browser globals; transpile to keep
  // Next's pipeline happy on first build. react-simple-maps similarly.
  transpilePackages: ['recharts', 'react-simple-maps'],
  // Pin the workspace root so Turbopack does not silently pick up a stray
  // lockfile from a parent directory during local development or CI.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
