import {
  extractProductImageFromHtml,
  normalizeImageUrl,
} from "@/lib/adapters/html";
import { fetchJson, fetchText } from "@/lib/adapters/http";
import {
  failResult,
  okResult,
  type PageContext,
  type ProductAdapter,
  type ProductDetectionResult,
} from "@/lib/adapters/types";

type AdidasAvailability = {
  availability_status?: string;
  variation_list?: Array<{
    size?: string;
    availability?: number | string;
    availability_status?: string;
  }>;
};

type AdidasProduct = {
  name?: string;
  title?: string;
  product_description?: { title?: string };
  view_list?: Array<{ image_url?: string }>;
  images?: Array<{ src?: string; url?: string }>;
};

function hostMatches(hostname: string) {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return (
    host === "adidas.com" ||
    host.endsWith(".adidas.com") ||
    host.startsWith("adidas.")
  );
}

function extractProductId(productUrl: string): string | null {
  const url = new URL(productUrl);
  const fromHtmlPath = url.pathname.match(/\/([A-Z0-9]{5,12})(?:\.html)?\/?$/i);
  if (fromHtmlPath) return fromHtmlPath[1].toUpperCase();
  return (
    url.searchParams.get("productId") || url.searchParams.get("sku") || null
  )?.toUpperCase() ?? null;
}

function sitePathFromUrl(productUrl: string): string | null {
  const parts = new URL(productUrl).pathname.split("/").filter(Boolean);
  if (parts[0] && /^[a-z]{2}(?:_[a-z]{2})?$/i.test(parts[0]) && parts[0].length <= 5) {
    return parts[0].toLowerCase();
  }
  return null;
}

function isInStock(variation: NonNullable<AdidasAvailability["variation_list"]>[number]) {
  const status = (variation.availability_status ?? "").toUpperCase();
  if (status.includes("IN_STOCK") || status === "AVAILABLE") return true;
  if (status.includes("NOT") || status.includes("OUT")) return false;
  const qty = Number(variation.availability);
  return Number.isFinite(qty) ? qty > 0 : false;
}

export const adidasAdapter: ProductAdapter = {
  id: "adidas",

  canHandle(url: string) {
    try {
      return hostMatches(new URL(url).hostname);
    } catch {
      return false;
    }
  },

  async detect(
    url: string,
    page?: PageContext,
  ): Promise<ProductDetectionResult> {
    const productId = extractProductId(url);
    if (!productId) {
      return failResult(
        "adidas",
        "unsupported",
        "Could not find an Adidas product ID in the URL.",
      );
    }

    const origin = new URL(url).origin;
    const sitePath = sitePathFromUrl(url);
    const availabilityUrl =
      `${origin}/api/products/${productId}/availability` +
      (sitePath ? `?sitePath=${sitePath}` : "");
    const productApiUrl =
      `${origin}/api/products/${productId}` +
      (sitePath ? `?sitePath=${sitePath}` : "");

    const availability = await fetchJson<AdidasAvailability>(availabilityUrl, {
      headers: { Accept: "application/json", Referer: url, Origin: origin },
    });

    if (availability.ok && availability.data?.variation_list?.length) {
      const list = availability.data.variation_list;
      const sized = list.filter((v) => Boolean(v.size));
      if (sized.length < 1) {
        return failResult(
          "adidas",
          "unsupported",
          "Adidas availability payload had no size labels.",
        );
      }

      const availableSizes = sized.filter(isInStock).map((v) => v.size as string);
      let productName: string | undefined;
      let productImageUrl: string | undefined;

      const product = await fetchJson<AdidasProduct>(productApiUrl, {
        headers: { Accept: "application/json", Referer: url, Origin: origin },
      });
      if (product.ok && product.data) {
        productName =
          product.data.name ||
          product.data.title ||
          product.data.product_description?.title;
        productImageUrl =
          normalizeImageUrl(product.data.view_list?.[0]?.image_url) ||
          normalizeImageUrl(product.data.images?.[0]?.src) ||
          normalizeImageUrl(product.data.images?.[0]?.url) ||
          undefined;
      }

      return okResult("adidas", {
        productName,
        productImageUrl,
        availableSizes,
        confidence: "high",
        rawSignals: {
          source: "adidas_api",
          productId,
          availability_status: availability.data.availability_status,
        },
      });
    }

    if (availability.status === 403 || availability.status === 429) {
      // Method failed — pipeline continues to other layers / browser.
      return failResult(
        "adidas",
        "unsupported",
        `Adidas availability API unavailable (HTTP ${availability.status}).`,
        { httpStatus: availability.status, source: "adidas_api" },
      );
    }

    const pageData = page
      ? page
      : await fetchText(url).then((p) => ({
          url,
          finalUrl: p.finalUrl,
          html: p.text,
          status: p.status,
        }));

    if (pageData.status === 403 || pageData.status === 429) {
      return failResult(
        "adidas",
        "unsupported",
        `Adidas product page unavailable (HTTP ${pageData.status}).`,
        { httpStatus: pageData.status, source: "adidas_html" },
      );
    }

    const embed = pageData.html.match(
      /"variation_list"\s*:\s*(\[[\s\S]*?\])\s*,\s*"availability_status"/,
    );
    if (embed) {
      try {
        const list = JSON.parse(embed[1]) as AdidasAvailability["variation_list"];
        const sized = (list ?? []).filter((v) => Boolean(v.size));
        if (sized.length >= 1) {
          return okResult("adidas", {
            productName:
              pageData.html.match(
                /property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
              )?.[1],
            productImageUrl:
              extractProductImageFromHtml(pageData.html, pageData.finalUrl) ??
              undefined,
            availableSizes: sized.filter(isInStock).map((v) => v.size as string),
            confidence: "medium",
            rawSignals: { source: "adidas_embedded_json", productId },
          });
        }
      } catch {
        // fall through
      }
    }

    return failResult(
      "adidas",
      "unsupported",
      "Could not confidently read Adidas size availability.",
      { apiStatus: availability.status },
    );
  },
};
