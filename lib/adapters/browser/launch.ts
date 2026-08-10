import type { Browser } from "puppeteer-core";

const DEFAULT_VIEWPORT = {
  width: 1280,
  height: 1800,
  deviceScaleFactor: 1,
} as const;

/**
 * Launch a Chromium browser suitable for local Node and Vercel serverless.
 * Uses @sparticuz/chromium on Vercel; prefers system Chrome/Chromium locally.
 */
export async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    // Disable GPU/graphics for serverless Chromium (typed as private in some versions).
    Object.assign(chromium, { graphicsMode: false });

    return puppeteer.default.launch({
      args: chromium.args,
      defaultViewport: DEFAULT_VIEWPORT,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    (await resolveLocalChromePath());

  if (!executablePath) {
    const chromium = (await import("@sparticuz/chromium")).default;
    Object.assign(chromium, { graphicsMode: false });
    return puppeteer.default.launch({
      args: [...chromium.args, "--no-sandbox"],
      defaultViewport: DEFAULT_VIEWPORT,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.default.launch({
    executablePath,
    headless: true,
    defaultViewport: DEFAULT_VIEWPORT,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
}

async function resolveLocalChromePath(): Promise<string | null> {
  const { existsSync } = await import("node:fs");
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
