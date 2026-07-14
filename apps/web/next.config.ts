import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mubosher/shared', '@mubosher/api-client'],
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
};

export default nextConfig;
