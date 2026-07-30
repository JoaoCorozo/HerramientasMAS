/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Compresor MP4: subidas grandes sin límite práctico en local
    proxyClientMaxBodySize: "50gb",
    // Por defecto Next.js corta el proxy a los 30 s; videos grandes necesitan más tiempo.
    proxyTimeout: 600000,
  },
  async rewrites() {
    // Las rutas /api/* las atiende app/api/[...path]/route.ts (proxy con cookies).
    return []
  },
}

export default nextConfig
