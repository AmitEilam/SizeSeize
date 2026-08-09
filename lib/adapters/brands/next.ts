import {
  extractProductImageFromHtml,
  normalizeImageUrl,
} from "@/lib/adapters/html";
import { fetchText } from "@/lib/adapters/http";
import {
  failResult,
  okResult,
  type PageContext,
  type ProductAdapter,
  type ProductDetectionResult,
} from "@/lib/adapters/types";

type NextOption = {
  name?: string;
  value?: string;
  stock_status?: string;
  StockStatus?: string;
};

function hostMatches(hostname: string) {
  const host = hostname.replace(/^www\./, "");
  return (
    host === "next.co.uk" ||
    host.endsWith(".next.co.uk") ||
    host === "next.co.il" ||
    host.endsWith(".next.co.il") ||
    host === "nextdirect.com" ||
    host.endsWith(".nextdirect.com")
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
      return hostMatches(new URL(url).hostname);
    } catch {
      return false;
    }
  },

  async detect(
    url: string,
    page?: PageContext,
  ): Promise<ProductDetectionResult> {
    const pageData = page
      ? page
      : await fetchText(url).then((p) => ({
          url,
          finalUrl: p.finalUrl,
          html: p.text,
          status: p.status,
        }));

    if (pageData.status === 403 || pageData.status === 429) {
      return failResult("next", "blocked", "Next blocked the product page.");
    }
    if (pageData.status >= 400) {
      return failResult(
        "next",
        "error",
        `Next page fetch failed (${pageData.status}).`,
      );
    }

    const options = extractOptionsFromHtml(pageData.html);
    const withStatus = options.filter(
      (opt) => opt.stock_status || opt.StockStatus,
    );

    if (withStatus.length < 2) {
      return failResult(
        "next",
        "unsupported",
        "Could not confidently read Next size stock statuses.",
        { optionCount: options.length },
      );
    }

    const availableSizes = withStatus
      .filter((opt) => isInStock(opt.stock_status || opt.StockStatus))
      .map((opt) => opt.name || opt.value || "")
      .filter(Boolean);

    const imagePath =
      pageData.html.match(/"image_url"\s*:\s*"([^"]+)"/i)?.[1] ||
      pageData.html.match(/"ImageUrl"\s*:\s*"([^"]+)"/i)?.[1];

    return okResult("next", {
      productName:
        pageData.html.match(
          /property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        )?.[1],
      productImageUrl:
        normalizeImageUrl(imagePath, pageData.finalUrl) ||
        extractProductImageFromHtml(pageData.html, pageData.finalUrl) ||
        undefined,
      availableSizes,
      confidence: "medium",
      rawSignals: { source: "next_stock_options", optionCount: withStatus.length },
    });
  },
};
