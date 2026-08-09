import { extractProductImageFromHtml } from "@/lib/adapters/html";
import { assertNotBlocked, fetchJson, fetchText } from "@/lib/adapters/http";
import {
  AdapterError,
  type ProductAdapter,
  type ProductAvailability,
} from "@/lib/adapters/types";

type AsosStockResponse = Array<{
  productId?: number;
  productCode?: string;
  isInStock?: boolean;
  variants?: Array<{
    brandSize?: string;
    size?: string;
    isInStock?: boolean;
    isAvailable?: boolean;
  }>;
}>;

function hostMatches(hostname: string) {
  return hostname === "asos.com" || hostname.endsWith(".asos.com");
}

function extractProductId(productUrl: string): string | null {
  const url = new URL(productUrl);
  const fromPath = url.pathname.match(/\/prd\/(\d+)/i)?.[1];
  if (fromPath) return fromPath;
  return url.searchParams.get("iid") || url.searchParams.get("productId");
}

function storeFromHost(hostname: string) {
  if (hostname.includes("asos.com")) return "COM";
  return "COM";
}

export const asosAdapter: ProductAdapter = {
  id: "asos",

  canHandle(url: string) {
    try {
      return hostMatches(new URL(url).hostname.replace(/^www\./, ""));
    } catch {
      return false;
    }
  },

  async fetchAvailability(url: string): Promise<ProductAvailability> {
    const productId = extractProductId(url);
    if (!productId) {
      throw new AdapterError(
        "Could not find an ASOS product id in the URL (expected /prd/123456).",
        "asos",
      );
    }

    const host = new URL(url).hostname;
    const store = storeFromHost(host);
    const apiUrl =
      `https://www.asos.com/api/product/catalogue/v3/stockprice` +
      `?productIds=${encodeURIComponent(productId)}&store=${store}&currency=GBP`;

    const stock = await fetchJson<AsosStockResponse>(apiUrl, {
      headers: {
        Accept: "application/json",
        Referer: url,
      },
    });

    if (stock.ok && Array.isArray(stock.data) && stock.data[0]) {
      const item = stock.data[0];
      const availableSizes = (item.variants ?? [])
        .filter((v) => v.isInStock || v.isAvailable)
        .map((v) => v.brandSize || v.size || "")
        .filter(Boolean);

      // Name/image from PDP as enrichment
      let productName: string | undefined;
      let productImageUrl: string | undefined;
      try {
        const page = await fetchText(url);
        if (page.ok) {
          productName =
            page.text.match(
              /property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
            )?.[1] || undefined;
          productImageUrl =
            extractProductImageFromHtml(page.text, page.finalUrl) ?? undefined;
        }
      } catch {
        // optional
      }

      return {
        productName,
        productImageUrl,
        availableSizes: [...new Set(availableSizes)],
        rawSignals: { source: "asos_stockprice", productId },
      };
    }

    const page = await fetchText(url);
    assertNotBlocked(page.status, page.text, "ASOS");
    throw new AdapterError(
      `Could not read ASOS stock (API ${stock.status}). The site may be blocking automated checks.`,
      "asos",
    );
  },
};
