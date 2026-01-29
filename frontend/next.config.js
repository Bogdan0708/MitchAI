/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'api.mitch-ai.com', 'api.mitchfromtransylvania.com'],
    unoptimized: true,
  },
}

module.exports = nextConfig
