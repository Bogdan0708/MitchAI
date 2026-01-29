/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    domains: ['localhost', 'api.mitch-ai.com', 'api.mitchfromtransylvania.com'],
    unoptimized: true,
  },
}

module.exports = nextConfig
