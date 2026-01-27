import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Step 2: Load backend .env so Clerk (and other server env) can use process.env.CLERK_SECRET_KEY etc.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "server", ".env") });

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable to prevent double rendering
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
