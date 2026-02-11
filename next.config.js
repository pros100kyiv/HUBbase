/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Менший initial bundle: tree-shake великі пакети
  experimental: {
    optimizePackageImports: ['date-fns', 'date-fns/locale'],
  },
}

module.exports = nextConfig

