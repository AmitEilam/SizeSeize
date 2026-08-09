import { cleanSizeLabel } from "@/lib/sizes";

/** Normalize sizes for comparison across EN/HE storefronts. */
const HEBREW_SIZE_ALIASES: Record<string, string> = {
  "קס": "xs",
  "אקס סמול": "xs",
  "סמול": "s",
  "קטן": "s",
  "מדיום": "m",
  "בינוני": "m",
  "לרג": "l",
  "גדול": "l",
  "אקס לרג": "xl",
  "אקסטרה לרג": "xl",
};

export function normalizeSize(size: string): string {
  const cleaned = cleanSizeLabel(size).toLowerCase();
  if (!cleaned) return "";

  if (HEBREW_SIZE_ALIASES[cleaned]) {
    return HEBREW_SIZE_ALIASES[cleaned];
  }

  return cleaned.replace(/\s+/g, "");
}

export function sizesMatch(desired: string, available: string): boolean {
  const a = normalizeSize(desired);
  const b = normalizeSize(available);
  if (!a || !b) return false;
  return a === b;
}

export function isDesiredSizeAvailable(
  desiredSize: string,
  availableSizes: string[],
): boolean {
  return availableSizes.some((size) => sizesMatch(desiredSize, size));
}

export function hasDesiredSize(desiredSize: string | null | undefined): boolean {
  return Boolean(desiredSize?.trim());
}

/**
 * Resolve whether the user's monitor target is currently available.
 * - With a desired size: match against availableSizes
 * - Without a size: use overall productInStock (or any available size as fallback)
 */
export function isMonitorTargetAvailable(
  desiredSize: string | null | undefined,
  detection: {
    availableSizes: string[];
    productInStock?: boolean;
  },
): boolean {
  if (hasDesiredSize(desiredSize)) {
    return isDesiredSizeAvailable(desiredSize!.trim(), detection.availableSizes);
  }

  if (typeof detection.productInStock === "boolean") {
    return detection.productInStock;
  }

  return detection.availableSizes.length > 0;
}

/**
 * Size monitoring needs size-aware detection.
 * Overall stock monitoring works with sizeAware or stock-only results.
 */
export function canEvaluateMonitorTarget(
  desiredSize: string | null | undefined,
  detection: {
    sizeAware?: boolean;
    productInStock?: boolean;
    availableSizes: string[];
  },
): { ok: true } | { ok: false; message: string } {
  if (hasDesiredSize(desiredSize)) {
    if (detection.sizeAware === false) {
      return {
        ok: false,
        message:
          "This product page does not expose sizes. Leave desired size empty to monitor overall availability.",
      };
    }
    return { ok: true };
  }

  if (
    typeof detection.productInStock === "boolean" ||
    detection.sizeAware !== false ||
    detection.availableSizes.length > 0
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    message: "Unable to confidently detect product availability for this page.",
  };
}

export function formatDesiredSizeLabel(
  desiredSize: string | null | undefined,
): string {
  const cleaned = desiredSize ? cleanSizeLabel(desiredSize) : "";
  return cleaned || "Overall availability";
}

/** EN/HE unavailability phrases - fallback only when structured signals are missing. */
export const UNAVAILABLE_PHRASES = [
  "out of stock",
  "sold out",
  "unavailable",
  "not available",
  "currently unavailable",
  "אזל מהמלאי",
  "לא במלאי",
  "אזל",
  "נגמר המלאי",
  "לא זמין",
  "חסר במלאי",
];

export const AVAILABLE_PHRASES = [
  "in stock",
  "available",
  "add to cart",
  "add to bag",
  "במלאי",
  "זמין",
  "הוסף לסל",
  "הוספה לסל",
];
