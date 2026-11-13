import type { NextConfig } from "next";

const ARCHIVADAS = [
  "/metodologia",
  "/estado",
  "/creditos",
  "/modelo/:path*",
  "/admin/:path*",
  "/api/refrescar",
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Temporales y no permanentes: si el proyecto vuelve, los navegadores no se
  // quedan con la redirección guardada.
  async redirects() {
    return ARCHIVADAS.map((source) => ({ source, destination: "/", permanent: false }));
  },
};

export default nextConfig;
