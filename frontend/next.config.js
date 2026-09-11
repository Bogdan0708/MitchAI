/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    remotePatterns: [
      { hostname: 'localhost' },
      { hostname: 'api.mitch-ai.com' },
      { hostname: 'api.mitchfromtransylvania.com' },
    ],
    unoptimized: true,
  },
}

module.exports = nextConfig
