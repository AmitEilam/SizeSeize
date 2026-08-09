import { extractProductImageFromHtml } from "@/lib/adapters/html";
import { assertNotBlocked, extractNextData, fetchJson, fetchText } from "@/lib/adapters/http";
import {
  AdapterError,
  type ProductAdapter,
  type ProductAvailability,
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
        altText?: string;
      }>;
      styleColor?: string;
    };
  };
};

function hostMatches(hostname: string) {
  return (
    hostname === "nike.com" ||
    hostname.endsWith(".nike.com") ||
    hostname === "nike.co.il" ||
    hostname.endsWith(".nike.co.il")
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

  return { styleColor, marketplace, language, origin: url.origin };
}

export const nikeAdapter: ProductAdapter = {
  id: "nike",

  canHandle(url: string) {
    try {
      return hostMatches(new URL(url).hostname.replace(/^www\./, ""));
    } catch {
      return false;
    }
  },

  async fetchAvailability(url: string): Promise<ProductAvailability> {
    const ctx = parseNikeContext(url);
    if (!ctx.styleColor) {
      throw new AdapterError(
        "Could not find a Nike style code in the URL (expected like DD1391-100).",
        "nike",
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
      if (info) {
        const availabilityBySku = new Map(
          (info.availableSkus ?? []).map((sku) => [
            sku.skuId ?? "",
            Boolean(sku.available),
          ]),
        );
        const availableSizes = (info.skus ?? [])
          .filter((sku) => availabilityBySku.get(sku.id ?? "") === true)
          .map(
            (sku) =>
              sku.nikeSize ||
              sku.countrySpecifications?.[0]?.localizedSize ||
              "",
          )
          .filter(Boolean);

        return {
          productName: info.merchProduct?.labelName,
          productImageUrl: info.imageUrls?.productImageUrl,
          availableSizes: [...new Set(availableSizes)],
          rawSignals: {
            source: "nike_product_feed",
            styleColor: ctx.styleColor,
            marketplace: ctx.marketplace,
          },
        };
      }
    }

    // Fallback: parse PDP HTML / __NEXT_DATA__
    const page = await fetchText(url);
    assertNotBlocked(page.status, page.text, "Nike");
    if (!page.ok) {
      throw new AdapterError(`Nike page fetch failed (${page.status})`, "nike");
    }

    const nextData = extractNextData<NikeNextData>(page.text);
    const selected = nextData?.props?.pageProps?.selectedProduct;
    const sizes = selected?.sizes ?? [];
    const availableSizes = sizes
      .filter((size) => (size.status ?? "").toUpperCase() === "ACTIVE")
      .map((size) => size.label || size.localizedLabel || "")
      .filter(Boolean);

    if (availableSizes.length === 0 && sizes.length === 0) {
      throw new AdapterError(
        "Could not read Nike size availability from the product page.",
        "nike",
      );
    }

    const image =
      nextData?.props?.pageProps?.colorwayImages?.[0]?.portraitImg ||
      nextData?.props?.pageProps?.colorwayImages?.[0]?.squarishImg ||
      extractProductImageFromHtml(page.text, page.finalUrl) ||
      undefined;

    return {
      productName:
        selected?.productInfo?.fullTitle || selected?.productInfo?.title,
      productImageUrl: image,
      availableSizes: [...new Set(availableSizes)],
      rawSignals: { source: "nike_next_data", styleColor: ctx.styleColor },
    };
  },
};
