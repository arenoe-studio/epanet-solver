/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { cpus: 2, workerThreads: true },
  typescript: { ignoreBuildErrors: true }
};

export default nextConfig;
