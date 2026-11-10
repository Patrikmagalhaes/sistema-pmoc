import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `forbidden()` para o estado SEM_ACESSO com status 403 (04 §1.1 regra 2; CA-01.3).
  experimental: { authInterrupts: true },
};

export default nextConfig;
