import { extractProductImageFromHtml, normalizeImageUrl } from "@/lib/adapters/html";
import { assertNotBlocked, fetchText } from "@/lib/adapters/http";
import {
  AdapterError,
  type ProductAdapter,
  type ProductAvailability,
} from "@/lib/adapters/types";

type NextOption = {
  name?: string;
  value?: string;
  stock_status?: string;
  StockStatus?: string;
};

function hostMatches(hostname: string) {
  return (
    hostname === "next.co.uk" ||
    hostname.endsWith(".next.co.uk") ||
    hostname === "next.co.il" ||
    hostname.endsWith(".next.co.il") ||
    hostname === "nextdirect.com" ||
    hostname.endsWith(".nextdirect.com")
  );
}

function isInStock(status: string | undefined) {
  const value = (status ?? "").toLowerCase();
  return (
    value === "instock" ||
    value === "in_stock" ||
    value === "available" ||
    value.includes("instock")
  );
}

function extractOptionsFromHtml(html: string): NextOption[] {
  const options: NextOption[] = [];

  // Common Next payload shapes
  const patterns = [
    /"options"\s*:\s*\{[\s\S]*?"options"\s*:\s*(\[[\s\S]*?\])\s*\}/i,
    /"SizeOptions"\s*:\s*(\[[\s\S]*?\])/i,
    /"sizeOptions"\s*:\s*(\[[\s\S]*?\])/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    try {
      const parsed = JSON.parse(match[1]) as NextOption[];
      if (Array.isArray(parsed) && parsed.length) {
        options.push(...parsed);
        break;
      }
    } catch {
      // try next pattern
    }
  }

  // Fallback: discrete stock_status records
  if (options.length === 0) {
    const re =
      /"name"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"[^"]*"\s*,\s*(?:"price"[^,]*\s*,\s*)?"stock_status"\s*:\s*"([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      options.push({ name: match[1], stock_status: match[2] });
    }
  }

  return options;
}

export const nextAdapter: ProductAdapter = {
  id: "next",

  canHandle(url: string) {
    try {
      return hostMatches(new URL(url).hostname.replace(/^www\./, ""));
    } catch {
      return false;
    }
  },

  async fetchAvailability(url: string): Promise<ProductAvailability> {
    const page = await fetchText(url);
    assertNotBlocked(page.status, page.text, "Next");
    if (!page.ok) {
      throw new AdapterError(`Next page fetch failed (${page.status})`, "next");
    }

    const html = page.text;
    const options = extractOptionsFromHtml(html);
    const availableSizes = options
      .filter((opt) => isInStock(opt.stock_status || opt.StockStatus))
      .map((opt) => opt.name || opt.value || "")
      .filter(Boolean);

    if (availableSizes.length === 0 && options.length === 0) {
      throw new AdapterError(
        "Could not read Next size availability. The site may be blocking automated checks.",
        "next",
      );
    }

    const productName =
      html.match(/property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];

    const imagePath =
      html.match(/"image_url"\s*:\s*"([^"]+)"/i)?.[1] ||
      html.match(/"ImageUrl"\s*:\s*"([^"]+)"/i)?.[1];

    return {
      productName,
      productImageUrl:
        normalizeImageUrl(imagePath, page.finalUrl) ||
        extractProductImageFromHtml(html, page.finalUrl) ||
        undefined,
      availableSizes: [...new Set(availableSizes)],
      rawSignals: {
        source: "next_html",
        optionCount: options.length,
      },
    };
  },
};
