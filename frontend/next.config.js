/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'api.mitch-ai.com'],
  },
}

module.exports = nextConfig
