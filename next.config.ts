import type { NextConfig } from 'next';

// healthcare-calculator is its own product — do NOT default to another app's
// multizone path. Coverage Compass owns /us/coverage-compass; this calculator
// should build at root unless an explicit NEXT_PUBLIC_BASE_PATH is set at
// build time (for whatever route policyengine.org decides to mount it at).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
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
