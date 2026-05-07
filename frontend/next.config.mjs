const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/auth/:path*", destination: `${backendUrl}/auth/:path*` },
      { source: "/images/:path*", destination: `${backendUrl}/images/:path*` },
      { source: "/download-json/:path*", destination: `${backendUrl}/download-json/:path*` },
    ];
  },
};

export default nextConfig;
