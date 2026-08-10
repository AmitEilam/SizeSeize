import { inspectRenderedDom } from "@/lib/adapters/browser/inspectRenderedDom";
import { launchBrowser } from "@/lib/adapters/browser/launch";
import {
  failResult,
  okResult,
  type PageContext,
  type ProductAdapter,
  type ProductDetectionResult,
} from "@/lib/adapters/types";

const DEFAULT_TIMEOUT_MS = 18_000;

function browserFallbackDisabled(): boolean {
  const flag = (process.env.BROWSER_FALLBACK || "1").toLowerCase();
  return flag === "0" || flag === "false" || flag === "off";
}

/**
 * Final fallback: render the product page in headless Chromium and inspect
 * the live DOM after JavaScript has executed.
 *
 * Intentionally slower/heavier — only used after HTTP-based layers fail.
 */
export const browserAdapter: ProductAdapter = {
  id: "browser",

  canHandle(_url: string, _page?: PageContext) {
    return !browserFallbackDisabled();
  },

  async detect(
    url: string,
    _page?: PageContext,
  ): Promise<ProductDetectionResult> {
    if (browserFallbackDisabled()) {
      return failResult(
        "browser",
        "unsupported",
        "Browser fallback is disabled.",
      );
    }

    let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

    try {
      browser = await launchBrowser();
      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      );
      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
      });

      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_TIMEOUT_MS,
      });

      const status = response?.status() ?? 0;
      if (status === 403 || status === 429) {
        return failResult(
          "browser",
          "blocked",
          `Product site blocked the headless browser (HTTP ${status}).`,
          { httpStatus: status },
        );
      }

      // Give client-side size UI time to hydrate.
      await Promise.race([
        page
          .waitForFunction(
            () => {
              const nodes = document.querySelectorAll(
                "[data-size], [class*='size' i] button, [class*='Size'] button, button[aria-label*='size' i], [role='radiogroup'] [role='radio'], input[name*='size' i]",
              );
              return nodes.length > 0;
            },
            { timeout: 8_000 },
          )
          .catch(() => null),
        new Promise((resolve) => setTimeout(resolve, 3_500)),
      ]);

      // Small settle for late availability flags
      await new Promise((resolve) => setTimeout(resolve, 800));

      const inspection = await page.evaluate(inspectRenderedDom);
      const finalUrl = page.url();

      const confidentSizes = inspection.sizes.filter((s) => s.score >= 2);
      const availableSizes = confidentSizes
        .filter((s) => s.available)
        .map((s) => s.label);

      if (confidentSizes.length >= 2) {
        return okResult("browser", {
          productName: inspection.productName ?? undefined,
          productImageUrl: inspection.productImageUrl ?? undefined,
          availableSizes,
          productInStock: availableSizes.length > 0,
          sizeAware: true,
          confidence: "medium",
          rawSignals: {
            source: "headless_browser",
            finalUrl,
            httpStatus: status,
            ...inspection.signals,
            sizeCount: confidentSizes.length,
          },
        });
      }

      // Single size or size-less product: use overall stock if clear.
      if (
        confidentSizes.length === 1 ||
        typeof inspection.productInStock === "boolean"
      ) {
        const sizeAware = confidentSizes.length === 1;
        const productInStock = sizeAware
          ? confidentSizes[0]!.available
          : Boolean(inspection.productInStock);

        return okResult("browser", {
          productName: inspection.productName ?? undefined,
          productImageUrl: inspection.productImageUrl ?? undefined,
          availableSizes: sizeAware && productInStock ? availableSizes : [],
          productInStock,
          sizeAware,
          confidence: "medium",
          rawSignals: {
            source: "headless_browser",
            finalUrl,
            httpStatus: status,
            ...inspection.signals,
            mode: sizeAware ? "single_size" : "overall_stock",
          },
        });
      }

      return failResult(
        "browser",
        "unsupported",
        "Headless browser rendered the page but could not confidently detect sizes or availability.",
        {
          finalUrl,
          httpStatus: status,
          ...inspection.signals,
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Browser fallback failed.";
      const blocked =
        /403|429|access denied|cloudflare|timeout/i.test(message) &&
        /403|429|access denied|cloudflare/i.test(message);

      return failResult(
        "browser",
        blocked ? "blocked" : "unsupported",
        message,
      );
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // ignore close errors
        }
      }
    }
  },
};
