/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    proxyClientMaxBodySize: "2gb",
    // Por defecto Next.js corta el proxy a los 30 s; videos grandes necesitan más tiempo.
    proxyTimeout: 600000,
  },
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000"
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
