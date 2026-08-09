import { extractProductImageFromHtml } from "@/lib/adapters/html";
import {
  assertNotBlocked,
  extractNextData,
  fetchJson,
  fetchText,
} from "@/lib/adapters/http";
import {
  failResult,
  okResult,
  type PageContext,
  type ProductAdapter,
  type ProductDetectionResult,
} from "@/lib/adapters/types";

const NIKE_CHANNEL_ID = "d9a5bc42-4b9c-4976-858a-f159cf99c647";

type NikeFeedResponse = {
  objects?: Array<{
    productInfo?: Array<{
      merchProduct?: { labelName?: string; styleColor?: string };
      imageUrls?: { productImageUrl?: string };
      skus?: Array<{
        id?: string;
        nikeSize?: string;
        countrySpecifications?: Array<{ localizedSize?: string }>;
      }>;
      availableSkus?: Array<{
        skuId?: string;
        available?: boolean;
        level?: string;
      }>;
    }>;
  }>;
};

type NikeNextData = {
  props?: {
    pageProps?: {
      selectedProduct?: {
        productInfo?: { title?: string; fullTitle?: string };
        sizes?: Array<{
          label?: string;
          localizedLabel?: string;
          status?: string;
        }>;
      };
      colorwayImages?: Array<{
        portraitImg?: string;
        squarishImg?: string;
      }>;
    };
  };
};

function hostMatches(hostname: string) {
  const host = hostname.replace(/^www\./, "");
  return (
    host === "nike.com" ||
    host.endsWith(".nike.com") ||
    host === "nike.co.il" ||
    host.endsWith(".nike.co.il")
  );
}

function parseNikeContext(productUrl: string) {
  const url = new URL(productUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  const styleColor = [...parts]
    .reverse()
    .find((part) => /^[A-Z0-9]+-\d+$/i.test(part));

  let marketplace = "US";
  let language = "en";
  if (parts[0] && /^[a-z]{2}$/i.test(parts[0]) && parts[0].toLowerCase() !== "t") {
    marketplace = parts[0].toUpperCase();
  }
  if (url.hostname.includes("nike.co.il")) {
    marketplace = "IL";
  }

  return { styleColor, marketplace, language };
}

export const nikeAdapter: ProductAdapter = {
  id: "nike",

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
    const ctx = parseNikeContext(url);
    if (!ctx.styleColor) {
      return failResult(
        "nike",
        "unsupported",
        "Could not find a Nike style code in the URL (expected like DD1391-100).",
      );
    }

    const feedUrl =
      `https://api.nike.com/product_feed/threads/v2` +
      `?filter=marketplace(${ctx.marketplace})` +
      `&filter=language(${ctx.language})` +
      `&filter=channelId(${NIKE_CHANNEL_ID})` +
      `&filter=productInfo.merchProduct.styleColor(${ctx.styleColor})`;

    const feed = await fetchJson<NikeFeedResponse>(feedUrl, {
      headers: {
        "nike-api-caller-id": "nike:product:browse.pdp.feed",
        Accept: "application/json",
      },
    });

    if (feed.ok && feed.data?.objects?.length) {
      const info = feed.data.objects[0]?.productInfo?.[0];
      if (info?.skus && info.availableSkus) {
        const availabilityBySku = new Map(
          info.availableSkus.map((sku) => [sku.skuId ?? "", Boolean(sku.available)]),
        );
        const availableSizes = info.skus
          .filter((sku) => availabilityBySku.get(sku.id ?? "") === true)
          .map(
            (sku) =>
              sku.nikeSize ||
              sku.countrySpecifications?.[0]?.localizedSize ||
              "",
          )
          .filter(Boolean);

        return okResult("nike", {
          productName: info.merchProduct?.labelName,
          productImageUrl: info.imageUrls?.productImageUrl,
          availableSizes,
          confidence: "high",
          rawSignals: {
            source: "nike_product_feed",
            styleColor: ctx.styleColor,
            marketplace: ctx.marketplace,
          },
        });
      }
    }

    const pageData = page
      ? page
      : await fetchText(url).then((p) => ({
          url,
          finalUrl: p.finalUrl,
          html: p.text,
          status: p.status,
        }));

    if (pageData.status >= 400 || looksBlockedHtml(pageData.html, pageData.status)) {
      return failResult(
        "nike",
        pageData.status === 403 || pageData.status === 429 ? "blocked" : "error",
        `Nike page/API unavailable (HTTP ${pageData.status}).`,
      );
    }

    const nextData = extractNextData<NikeNextData>(pageData.html);
    const selected = nextData?.props?.pageProps?.selectedProduct;
    const sizes = selected?.sizes ?? [];
    const mapped = sizes
      .map((size) => {
        const label = size.label || size.localizedLabel;
        const status = (size.status ?? "").toUpperCase();
        if (!label || !status) return null;
        return {
          label,
          available:
            status === "ACTIVE" || status === "IN_STOCK" || status === "AVAILABLE",
        };
      })
      .filter((x): x is { label: string; available: boolean } => Boolean(x));

    if (mapped.length < 2) {
      return failResult(
        "nike",
        "unsupported",
        "Could not confidently read Nike size availability.",
      );
    }

    return okResult("nike", {
      productName:
        selected?.productInfo?.fullTitle || selected?.productInfo?.title,
      productImageUrl:
        nextData?.props?.pageProps?.colorwayImages?.[0]?.portraitImg ||
        nextData?.props?.pageProps?.colorwayImages?.[0]?.squarishImg ||
        extractProductImageFromHtml(pageData.html, pageData.finalUrl) ||
        undefined,
      availableSizes: mapped.filter((m) => m.available).map((m) => m.label),
      confidence: "medium",
      rawSignals: { source: "nike_next_data", styleColor: ctx.styleColor },
    });
  },
};

function looksBlockedHtml(html: string, status: number) {
  const lower = html.toLowerCase();
  return (
    status === 403 ||
    status === 429 ||
    lower.includes("access denied") ||
    lower.includes("captcha")
  );
}
