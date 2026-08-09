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
  const trimmed = size.trim().toLowerCase().replace(/\s+/g, " ");
  if (!trimmed) return "";

  if (HEBREW_SIZE_ALIASES[trimmed]) {
    return HEBREW_SIZE_ALIASES[trimmed];
  }

  // Collapse common fashion size tokens
  return trimmed
    .replace(/^size\s+/i, "")
    .replace(/^מידה\s+/i, "")
    .replace(/\s+/g, "");
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

/** EN/HE unavailability phrases — fallback only when structured signals are missing. */
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
