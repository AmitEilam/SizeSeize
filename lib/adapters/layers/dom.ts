import { extractProductImageFromHtml } from "@/lib/adapters/html";
import {
  AVAILABLE_PHRASES,
  UNAVAILABLE_PHRASES,
} from "@/lib/monitoring/sizeMatch";
import {
  failResult,
  okResult,
  type PageContext,
  type ProductAdapter,
  type ProductDetectionResult,
} from "@/lib/adapters/types";

type SizeCandidate = {
  label: string;
  available: boolean;
  score: number;
};

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function looksLikeSizeLabel(label: string): boolean {
  if (!label || label.length > 12) return false;
  if (/https?:/i.test(label)) return false;
  // Fashion sizes: S/M/L/XL, numbers, EU/UK codes, Hebrew letters rarely alone
  return (
    /^(xxs|xs|s|m|l|xl|xxl|xxxl|one size|os)$/i.test(label) ||
    /^\d{1,2}(?:[.,]\d)?$/.test(label) ||
    /^(eu|uk|us)?\s?\d{1,2}(?:[.,]\d)?$/i.test(label) ||
    /^[א-ת]{1,4}$/.test(label)
  );
}

function scoreAvailability(block: string): { available: boolean; score: number } | null {
  const lower = block.toLowerCase();
  let score = 0;
  let available: boolean | null = null;

  const hasDisabled =
    /\bdisabled\b/.test(lower) ||
    /aria-disabled=["']true["']/.test(lower) ||
    /aria-pressed=["']false["']/.test(lower);
  const hasSoldOutClass =
    /sold[_-]?out|out[_-]?of[_-]?stock|unavailable|not-available|אזל/.test(lower);

  if (hasDisabled || hasSoldOutClass) {
    available = false;
    score += 2;
  }

  if (
    /aria-disabled=["']false["']/.test(lower) ||
    /data-available=["']true["']/.test(lower) ||
    /data-stock=["'](?:in)?stock["']/.test(lower)
  ) {
    available = true;
    score += 2;
  }

  if (UNAVAILABLE_PHRASES.some((p) => lower.includes(p))) {
    available = false;
    score += 1;
  }
  if (AVAILABLE_PHRASES.some((p) => lower.includes(p))) {
    if (available === null) available = true;
    score += 1;
  }

  if (available === null) return null;
  return { available, score };
}

function extractSizeCandidates(html: string): SizeCandidate[] {
  const results: SizeCandidate[] = [];
  const re =
    /<(button|div|span|li|label|a)([^>]*)>([\s\S]*?)<\/\1>/gi;

  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs = match[2] ?? "";
    const inner = stripTags(match[3] ?? "");
    const attrBlob = `${attrs} ${inner}`;
    const lowerAttrs = attrs.toLowerCase();

    // Must look size-related in attributes or be a clean size label inside a size widget
    const sizeHint =
      /size|מידה|variant|sku|option/.test(lowerAttrs) ||
      /data-(?:size|value|option)=["'][^"']+["']/.test(lowerAttrs);

    const dataSize =
      attrs.match(/data-(?:size|value|option)=["']([^"']+)["']/i)?.[1]?.trim() ??
      "";

    const label = (dataSize || inner).trim();
    if (!looksLikeSizeLabel(label)) continue;
    if (!sizeHint && !dataSize) continue;

    const availability = scoreAvailability(attrBlob);
    if (!availability) continue;

    results.push({
      label,
      available: availability.available,
      score: availability.score + (sizeHint ? 1 : 0) + (dataSize ? 1 : 0),
    });
  }

  // Prefer higher-score entries per label
  const best = new Map<string, SizeCandidate>();
  for (const item of results) {
    const key = item.label.toLowerCase();
    const existing = best.get(key);
    if (!existing || item.score > existing.score) {
      best.set(key, item);
    } else if (existing && item.score === existing.score && !item.available) {
      // Prefer unavailable on tie (safer)
      best.set(key, item);
    }
  }

  return [...best.values()];
}

/**
 * Layer 3: Generic DOM inspection.
 * Only returns a result when size controls and availability states are clear.
 * Never guesses from loose page text alone.
 */
export const genericDomAdapter: ProductAdapter = {
  id: "dom",

  canHandle(_url: string, page?: PageContext) {
    return Boolean(page?.html);
  },

  async detect(
    _url: string,
    page?: PageContext,
  ): Promise<ProductDetectionResult> {
    if (!page?.html) {
      return failResult("dom", "unsupported", "No page HTML for DOM detection.");
    }

    const candidates = extractSizeCandidates(page.html);
    const confident = candidates.filter((c) => c.score >= 2);

    if (confident.length < 2) {
      return failResult(
        "dom",
        "unsupported",
        "Could not confidently detect size controls and availability in the page DOM.",
        { candidateCount: candidates.length },
      );
    }

    const productName =
      page.html.match(/property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      page.html.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];

    return okResult("dom", {
      productName,
      productImageUrl:
        extractProductImageFromHtml(page.html, page.finalUrl) ?? undefined,
      availableSizes: confident.filter((c) => c.available).map((c) => c.label),
      confidence: "medium",
      rawSignals: {
        source: "generic_dom",
        confidentCount: confident.length,
      },
    });
  },
};
