/** @type {import('next').NextConfig} */
const API = process.env.LUPIA_API_URL || "http://127.0.0.1:8010";

const nextConfig = {
  reactStrictMode: true,
  // Inlinea la URL del backend en el build: el runtime SSR de Amplify no recibe
  // variables de entorno, asi que tanto rewrites como route handlers la fijan aqui.
  env: { LUPIA_API_URL: API },
  // Proxy del lado del servidor hacia FastAPI: el navegador solo habla con Next
  // (cero CORS, y en produccion el ALB solo expone el front).
  async rewrites() {
    return [{ source: "/lupia-api/:path*", destination: `${API}/:path*` }];
  },
};
export default nextConfig;
