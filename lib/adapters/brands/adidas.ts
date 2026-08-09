import { extractProductImageFromHtml, normalizeImageUrl } from "@/lib/adapters/html";
import { assertNotBlocked, fetchJson, fetchText } from "@/lib/adapters/http";
import {
  AdapterError,
  type ProductAdapter,
  type ProductAvailability,
} from "@/lib/adapters/types";

type AdidasAvailability = {
  id?: string;
  availability_status?: string;
  variation_list?: Array<{
    sku?: string;
    size?: string;
    availability?: number | string;
    availability_status?: string;
  }>;
};

type AdidasProduct = {
  id?: string;
  name?: string;
  title?: string;
  product_description?: { title?: string };
  view_list?: Array<{ image_url?: string; type?: string }>;
  images?: Array<{ src?: string; url?: string }>;
  sizing?: { sizes?: Array<{ size?: string; value?: string }> };
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
  const fromQuery = url.searchParams.get("productId") || url.searchParams.get("sku");
  return fromQuery ? fromQuery.toUpperCase() : null;
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
      return hostMatches(new URL(url).hostname.replace(/^www\./, ""));
    } catch {
      return false;
    }
  },

  async fetchAvailability(url: string): Promise<ProductAvailability> {
    const productId = extractProductId(url);
    if (!productId) {
      throw new AdapterError(
        "Could not find an Adidas product ID in the URL (expected like B75806.html).",
        "adidas",
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
      headers: {
        Accept: "application/json",
        Referer: url,
        Origin: origin,
      },
    });

    let productName: string | undefined;
    let productImageUrl: string | undefined;
    let availableSizes: string[] = [];

    if (availability.ok && availability.data?.variation_list) {
      availableSizes = availability.data.variation_list
        .filter(isInStock)
        .map((v) => v.size || "")
        .filter(Boolean);

      const product = await fetchJson<AdidasProduct>(productApiUrl, {
        headers: {
          Accept: "application/json",
          Referer: url,
          Origin: origin,
        },
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

      return {
        productName,
        productImageUrl,
        availableSizes: [...new Set(availableSizes)],
        rawSignals: {
          source: "adidas_api",
          productId,
          availability_status: availability.data.availability_status,
        },
      };
    }

    // HTML fallback when API is bot-blocked
    const page = await fetchText(url, {
      headers: { Referer: origin },
    });
    assertNotBlocked(page.status, page.text, "Adidas");
    if (!page.ok) {
      throw new AdapterError(
        `Adidas page/API unavailable (${availability.status || page.status}).`,
        "adidas",
      );
    }

    const html = page.text;
    productName =
      html.match(/property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
    productImageUrl =
      extractProductImageFromHtml(html, page.finalUrl) ?? undefined;

    // Embedded availability JSON sometimes appears in script tags
    const embed = html.match(
      /"variation_list"\s*:\s*(\[[\s\S]*?\])\s*,\s*"availability_status"/,
    );
    if (embed) {
      try {
        const list = JSON.parse(embed[1]) as AdidasAvailability["variation_list"];
        availableSizes = (list ?? [])
          .filter(isInStock)
          .map((v) => v.size || "")
          .filter(Boolean);
      } catch {
        // ignore
      }
    }

    if (availableSizes.length === 0) {
      throw new AdapterError(
        "Could not read Adidas size availability. The site may be blocking automated checks.",
        "adidas",
      );
    }

    return {
      productName,
      productImageUrl,
      availableSizes: [...new Set(availableSizes)],
      rawSignals: { source: "adidas_html", productId },
    };
  },
};
