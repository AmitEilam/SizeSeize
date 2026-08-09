import { extractProductImageFromHtml } from "@/lib/adapters/html";
import { fetchJson, fetchText } from "@/lib/adapters/http";
import {
  failResult,
  okResult,
  type PageContext,
  type ProductAdapter,
  type ProductDetectionResult,
} from "@/lib/adapters/types";

type AsosStockResponse = Array<{
  productId?: number;
  variants?: Array<{
    brandSize?: string;
    size?: string;
    isInStock?: boolean;
    isAvailable?: boolean;
  }>;
}>;

function hostMatches(hostname: string) {
  const host = hostname.replace(/^www\./, "");
  return host === "asos.com" || host.endsWith(".asos.com");
}

function extractProductId(productUrl: string): string | null {
  const url = new URL(productUrl);
  return (
    url.pathname.match(/\/prd\/(\d+)/i)?.[1] ||
    url.searchParams.get("iid") ||
    url.searchParams.get("productId")
  );
}

export const asosAdapter: ProductAdapter = {
  id: "asos",

  canHandle(url: string) {
    try {
      return hostMatches(new URL(url).hostname);
    } catch {
      return false;
    }
  },

  async detect(
    url: string,
    _page?: PageContext,
  ): Promise<ProductDetectionResult> {
    const productId = extractProductId(url);
    if (!productId) {
      return failResult(
        "asos",
        "unsupported",
        "Could not find an ASOS product id in the URL.",
      );
    }

    const apiUrl =
      `https://www.asos.com/api/product/catalogue/v3/stockprice` +
      `?productIds=${encodeURIComponent(productId)}&store=COM&currency=GBP`;

    const stock = await fetchJson<AsosStockResponse>(apiUrl, {
      headers: { Accept: "application/json", Referer: url },
    });

    if (stock.status === 403 || stock.status === 429) {
      return failResult("asos", "blocked", "ASOS blocked the stock API.");
    }

    if (!stock.ok || !Array.isArray(stock.data) || !stock.data[0]?.variants) {
      return failResult(
        "asos",
        "unsupported",
        "Could not confidently read ASOS stock variants.",
        { apiStatus: stock.status },
      );
    }

    const variants = stock.data[0].variants;
    const availableSizes = variants
      .filter((v) => v.isInStock === true || v.isAvailable === true)
      .map((v) => v.brandSize || v.size || "")
      .filter(Boolean);

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
      // optional enrichment
    }

    return okResult("asos", {
      productName,
      productImageUrl,
      availableSizes,
      confidence: "high",
      rawSignals: { source: "asos_stockprice", productId },
    });
  },
};
