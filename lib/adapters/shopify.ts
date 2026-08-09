import {
  extractProductImageFromHtml,
  normalizeImageUrl,
} from "@/lib/adapters/html";
import {
  AdapterError,
  DEFAULT_FETCH_HEADERS,
  type ProductAvailability,
  type ProductAdapter,
} from "@/lib/adapters/types";

type ShopifyVariant = {
  id?: number;
  title?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  available?: boolean;
  featured_image?: { src?: string } | null;
};

type ShopifyProductJson = {
  title?: string;
  featured_image?: string | null;
  images?: Array<string | { src?: string }>;
  variants?: ShopifyVariant[];
  options?: Array<{ name?: string; values?: string[] }>;
};

function productJsonUrl(productUrl: string): string | null {
  try {
    const url = new URL(productUrl);
    const match = url.pathname.match(/\/products\/([^/?#]+)/i);
    if (!match) return null;
    const handle = match[1];
    return `${url.origin}/products/${handle}.js`;
  } catch {
    return null;
  }
}

function extractImage(data: ShopifyProductJson): string | null {
  const featured = normalizeImageUrl(data.featured_image ?? undefined);
  if (featured) return featured;

  const first = data.images?.[0];
  if (typeof first === "string") return normalizeImageUrl(first);
  if (first && typeof first === "object") {
    return normalizeImageUrl(first.src);
  }

  const variantImage = data.variants?.find((v) => v.featured_image?.src)
    ?.featured_image?.src;
  return normalizeImageUrl(variantImage);
}

function extractSizeFromVariant(
  variant: ShopifyVariant,
  options: ShopifyProductJson["options"],
): string | null {
  const sizeOptionIndex = (options ?? []).findIndex((opt) => {
    const name = (opt.name ?? "").toLowerCase();
    return (
      name.includes("size") ||
      name.includes("מידה") ||
      name === "sizes" ||
      name === "מידת"
    );
  });

  if (sizeOptionIndex === 0 && variant.option1) return variant.option1;
  if (sizeOptionIndex === 1 && variant.option2) return variant.option2;
  if (sizeOptionIndex === 2 && variant.option3) return variant.option3;

  if (variant.option1 && !variant.option2 && !variant.option3) {
    return variant.option1;
  }

  const fromTitle = variant.title?.split("/").map((p) => p.trim()).pop();
  return fromTitle || variant.option1 || null;
}

async function detectShopifyFromHtml(html: string): Promise<boolean> {
  return (
    html.includes("cdn.shopify.com") ||
    html.includes("Shopify.theme") ||
    html.includes("window.Shopify") ||
    html.includes('name="shopify-digital-wallet"')
  );
}

function toAvailability(data: ShopifyProductJson, source: string): ProductAvailability {
  const availableSizes = (data.variants ?? [])
    .filter((v) => v.available)
    .map((v) => extractSizeFromVariant(v, data.options))
    .filter((s): s is string => Boolean(s));

  return {
    productName: data.title,
    productImageUrl: extractImage(data) ?? undefined,
    availableSizes: [...new Set(availableSizes)],
    rawSignals: { source, variantCount: data.variants?.length ?? 0 },
  };
}

export const shopifyAdapter: ProductAdapter = {
  id: "shopify",

  canHandle(url: string) {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname.includes("myshopify.com") ||
        /\/products\//i.test(parsed.pathname)
      );
    } catch {
      return false;
    }
  },

  async fetchAvailability(url: string): Promise<ProductAvailability> {
    const jsonUrl = productJsonUrl(url);

    if (jsonUrl) {
      const res = await fetch(jsonUrl, {
        headers: DEFAULT_FETCH_HEADERS,
        next: { revalidate: 0 },
      });

      if (res.ok) {
        const data = (await res.json()) as ShopifyProductJson;
        const availability = toAvailability(data, "shopify_product_js");
        if (!availability.productImageUrl) {
          // Best-effort og:image if JSON has no featured image
          try {
            const pageRes = await fetch(url, {
              headers: DEFAULT_FETCH_HEADERS,
              redirect: "follow",
              next: { revalidate: 0 },
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              availability.productImageUrl =
                extractProductImageFromHtml(html) ?? undefined;
            }
          } catch {
            // ignore
          }
        }
        return availability;
      }
    }

    const pageRes = await fetch(url, {
      headers: DEFAULT_FETCH_HEADERS,
      redirect: "follow",
      next: { revalidate: 0 },
    });

    if (!pageRes.ok) {
      throw new AdapterError(
        `Failed to fetch product page (${pageRes.status})`,
        "shopify",
      );
    }

    const html = await pageRes.text();
    const isShopify = await detectShopifyFromHtml(html);
    if (!isShopify) {
      throw new AdapterError("Not a Shopify product page", "shopify");
    }

    const resolvedJson = productJsonUrl(pageRes.url || url);
    if (!resolvedJson) {
      throw new AdapterError("Could not resolve Shopify product handle", "shopify");
    }

    const jsonRes = await fetch(resolvedJson, {
      headers: DEFAULT_FETCH_HEADERS,
      next: { revalidate: 0 },
    });

    if (!jsonRes.ok) {
      throw new AdapterError(
        `Shopify product JSON unavailable (${jsonRes.status})`,
        "shopify",
      );
    }

    const data = (await jsonRes.json()) as ShopifyProductJson;
    const availability = toAvailability(data, "shopify_html_then_js");
    availability.productImageUrl =
      availability.productImageUrl ??
      extractProductImageFromHtml(html) ??
      undefined;
    return availability;
  },
};
