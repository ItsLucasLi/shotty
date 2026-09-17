import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Shotty is a static app: `next build` emits plain HTML/JS/CSS into ./out.
  // There is no server runtime, so there is nowhere for an image to be sent.
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
