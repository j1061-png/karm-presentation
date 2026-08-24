/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is for container deploys (Dockerfile). Vercel sets VERCEL=1
  // and should use its default output — forcing standalone there drops static
  // assets and fails production deploys from main.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  serverExternalPackages: ["unpdf", "mammoth", "jszip"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
