/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined
};

export default nextConfig;
