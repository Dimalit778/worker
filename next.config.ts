import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ['10.100.102.22'],
  logging: {
    incomingRequests: false,
  },
};

export default nextConfig;
