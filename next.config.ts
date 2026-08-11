import type { NextConfig } from "next";
import path from "path";
import { formatAppVersion } from "./lib/version";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: formatAppVersion(new Date()),
  },
  turbopack: {
    root: path.join(__dirname),
  },
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
