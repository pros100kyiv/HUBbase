/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
}

// PWA тимчасово вимкнено через несумісність з Next.js 15
// TODO: Оновити next-pwa або використати альтернативу
module.exports = nextConfig

