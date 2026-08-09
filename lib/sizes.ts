/**
 * Clean storefront size labels down to the shoppable size value.
 * Examples:
 * - "UK 6 (EU 40)" → "40" (prefer EU in parentheses)
 * - "EU 42.5" → "42.5"
 * - "M - Regular Fit" → "M"
 * - "Size 42 Men's" → "42"
 * - "נעלי ריצה CLOUDMONSTER / גברים – מידה 40.5" → "40.5"
 */
export function cleanSizeLabel(raw: string): string {
  let s = raw.replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
  if (!s) return "";

  // Explicit size markers anywhere in the label (common on TerminalX / HE PDPs).
  const marked =
    s.match(/מידה\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i) ||
    s.match(/\bsize\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
  if (marked) {
    return marked[1].replace(",", ".");
  }

  // Prefer an explicit EU value when dual-labeled.
  const euParen = s.match(/\(\s*eu\s*([^)]+?)\s*\)/i);
  if (euParen) {
    s = euParen[1].trim();
  } else {
    // Drop other parenthetical notes ("M (slim)").
    s = s.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  }

  s = s
    .replace(/^(size|מידה)\s*:?\s*/i, "")
    .replace(/^(eu|us|uk|cm)\s+/i, "")
    .trim();

  if (!s) return "";

  if (/^(one\s*size|osfa|o\/s|os)$/i.test(s)) {
    return "One Size";
  }

  // Split descriptive product text from the size token.
  // Hebrew PDPs often put the size AFTER the dash; English apparel puts it BEFORE.
  const parts = s
    .split(/\s*[–—|:]\s*|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    const lastSize = extractSimpleSize(last);
    if (lastSize) return lastSize;

    const first = parts[0];
    const firstSize = extractSimpleSize(first);
    if (firstSize) return firstSize;
  }

  const simple = extractSimpleSize(s);
  if (simple) return simple;

  // Last numeric shoe/apparel size token in a long label.
  const trailingNumber = s.match(/(\d{1,2}(?:[.,]\d+)?)\s*$/);
  if (trailingNumber && s.length > 8) {
    return trailingNumber[1].replace(",", ".");
  }

  // Fallback: first token only (drops trailing words like "Men's", "Regular").
  return (s.split(/\s+/)[0] ?? s).trim();
}

function extractSimpleSize(value: string): string | null {
  const s = value.trim();
  if (!s) return null;

  // Numeric sizes, optional fraction / width letter (e.g. 42.5, 10.5W, 42 2/3).
  const numeric = s.match(
    /^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?)(?:\s*([wn]))?\b/i,
  );
  if (numeric) {
    const core = numeric[1].replace(",", ".").replace(/\s+/g, " ").trim();
    const width = numeric[2] ? numeric[2].toUpperCase() : "";
    return `${core}${width}`;
  }

  // Standard letter sizes.
  const letter = s.match(/^(xxxx?l|xxx?l|xx?l|x{0,3}s|m|l)\b/i);
  if (letter) {
    return letter[1].toUpperCase();
  }

  return null;
}

export function cleanSizeLabels(sizes: string[]): string[] {
  return [
    ...new Set(
      sizes
        .map((size) => cleanSizeLabel(size))
        .filter((size) => size.length > 0),
    ),
  ];
}
