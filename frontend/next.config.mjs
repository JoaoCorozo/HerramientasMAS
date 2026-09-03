/** @type {import('next').NextConfig} */
const isVercel = Boolean(process.env.VERCEL)

const nextConfig = {
  // standalone solo para Docker/local; en Vercel rompe el empaquetado del deploy
  ...(isVercel ? {} : { output: "standalone" }),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // En Vercel hay límites de body/timeout; valores extremos pueden fallar el deploy
    proxyClientMaxBodySize: isVercel ? "100mb" : "50gb",
    proxyTimeout: isVercel ? 60000 : 600000,
  },
  async rewrites() {
    // Las rutas /api/* las atiende app/api/[...path]/route.ts (proxy con cookies).
    return []
  },
}

export default nextConfig
