/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    domains: ['localhost', 'api.mitch-ai.com'],
  },
}

module.exports = nextConfig
