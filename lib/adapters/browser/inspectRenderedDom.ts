/**
 * Runs inside page.evaluate — must stay self-contained (no imports).
 * Inspects the rendered DOM for size options + overall availability.
 */
export type RenderedInspection = {
  productName: string | null;
  productImageUrl: string | null;
  sizes: Array<{ label: string; available: boolean; score: number }>;
  productInStock: boolean | null;
  signals: {
    sizeNodeCount: number;
    addToCartFound: boolean;
    soldOutBadge: boolean;
  };
};

export function inspectRenderedDom(): RenderedInspection {
  const UNAVAILABLE = [
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
  const AVAILABLE = [
    "in stock",
    "add to cart",
    "add to bag",
    "במלאי",
    "זמין",
    "הוסף לסל",
    "הוספה לסל",
  ];

  function textOf(el: Element): string {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function looksLikeSizeLabel(label: string): boolean {
    if (!label || label.length > 24) return false;
    if (/https?:/i.test(label)) return false;
    return (
      /^(xxs|xs|s|m|l|xl|xxl|xxxl|one size|os)$/i.test(label) ||
      /^\d{1,2}(?:[.,]\d{1,2})?$/.test(label) ||
      /^(eu|uk|us)\s?\d{1,2}(?:[.,]\d{1,2})?$/i.test(label) ||
      /^מידה\s*\d/i.test(label) ||
      /^[א-ת]{1,4}$/.test(label)
    );
  }

  function isUnavailableNode(el: Element): boolean {
    const htmlEl = el as HTMLElement;
    if (htmlEl.hasAttribute("disabled")) return true;
    if (htmlEl.getAttribute("aria-disabled") === "true") return true;
    if ((htmlEl as HTMLInputElement).disabled) return true;

    const cls = (htmlEl.className || "").toString().toLowerCase();
    if (
      /sold[_-]?out|out[_-]?of[_-]?stock|unavailable|not[_-]?available|disabled|אזל/.test(
        cls,
      )
    ) {
      return true;
    }

    const dataAvail = (
      htmlEl.getAttribute("data-available") ||
      htmlEl.getAttribute("data-stock") ||
      htmlEl.getAttribute("data-instock") ||
      ""
    ).toLowerCase();
    if (
      dataAvail === "false" ||
      dataAvail === "0" ||
      dataAvail === "out" ||
      dataAvail === "outofstock" ||
      dataAvail === "soldout"
    ) {
      return true;
    }

    const blob = `${cls} ${textOf(el)}`.toLowerCase();
    return UNAVAILABLE.some((p) => blob.includes(p));
  }

  function isAvailableNode(el: Element): boolean {
    if (isUnavailableNode(el)) return false;
    const htmlEl = el as HTMLElement;
    if (htmlEl.getAttribute("aria-disabled") === "false") return true;
    const dataAvail = (
      htmlEl.getAttribute("data-available") ||
      htmlEl.getAttribute("data-stock") ||
      htmlEl.getAttribute("data-instock") ||
      ""
    ).toLowerCase();
    if (
      dataAvail === "true" ||
      dataAvail === "1" ||
      dataAvail === "in" ||
      dataAvail === "instock" ||
      dataAvail === "available"
    ) {
      return true;
    }
    return false;
  }

  function scoreNode(el: Element, available: boolean): number {
    let score = 2;
    const htmlEl = el as HTMLElement;
    const attrs = Array.from(htmlEl.attributes)
      .map((a) => `${a.name}=${a.value}`)
      .join(" ")
      .toLowerCase();
    if (/size|מידה|variant|sku|option/.test(attrs)) score += 1;
    if (htmlEl.getAttribute("data-size") || htmlEl.getAttribute("data-value")) {
      score += 1;
    }
    if (available && isAvailableNode(el)) score += 1;
    if (!available && isUnavailableNode(el)) score += 1;
    return score;
  }

  const selectorGroups = [
    "[data-size]",
    "[data-testid*='size' i]",
    "[class*='size' i] button",
    "[class*='Size'] button",
    "[class*='size-selector' i] *",
    "[class*='sizeSelector' i] *",
    "[class*='swatch' i]",
    "button[aria-label*='size' i]",
    "label[for*='size' i]",
    "input[name*='size' i]",
    "[role='listbox'] [role='option']",
    "[role='radiogroup'] [role='radio']",
    "fieldset legend",
  ];

  const nodes = new Set<Element>();
  for (const sel of selectorGroups) {
    try {
      document.querySelectorAll(sel).forEach((n) => nodes.add(n));
    } catch {
      // ignore invalid selectors in older engines
    }
  }

  // Also pick buttons/labels inside containers that mention size / מידה
  document.querySelectorAll("div, section, ul, fieldset").forEach((container) => {
    const mark = (
      (container.getAttribute("class") || "") +
      " " +
      (container.getAttribute("id") || "") +
      " " +
      (container.getAttribute("aria-label") || "")
    ).toLowerCase();
    if (!/size|מידה|variant/.test(mark)) return;
    container
      .querySelectorAll("button, label, li, a, [role='option'], [role='radio']")
      .forEach((n) => nodes.add(n));
  });

  type Cand = { label: string; available: boolean; score: number };
  const candidates: Cand[] = [];

  for (const node of nodes) {
    const htmlEl = node as HTMLElement;
    const tag = htmlEl.tagName.toLowerCase();

    let label =
      htmlEl.getAttribute("data-size") ||
      htmlEl.getAttribute("data-value") ||
      htmlEl.getAttribute("data-option") ||
      htmlEl.getAttribute("aria-label") ||
      "";

    if (tag === "input") {
      const id = htmlEl.getAttribute("id");
      if (id) {
        const lab = document.querySelector(
          `label[for="${id.replace(/"/g, '\\"')}"]`,
        );
        if (lab) label = textOf(lab) || label;
      }
      label =
        label ||
        htmlEl.getAttribute("value") ||
        htmlEl.getAttribute("aria-label") ||
        "";
    }

    label = (label || textOf(htmlEl)).trim();
    if (!looksLikeSizeLabel(label)) continue;

    // Prefer a clear availability signal; skip ambiguous nodes.
    const unavailable = isUnavailableNode(htmlEl);
    const availableHint = isAvailableNode(htmlEl);
    let available: boolean | null = null;
    if (unavailable) available = false;
    else if (availableHint) available = true;
    else if (
      tag === "button" ||
      tag === "label" ||
      htmlEl.getAttribute("role") === "option" ||
      htmlEl.getAttribute("role") === "radio"
    ) {
      // Interactive size controls without disabled/sold-out markers → treat as available
      available = true;
    }

    if (available === null) continue;

    candidates.push({
      label,
      available,
      score: scoreNode(htmlEl, available),
    });
  }

  const best = new Map<string, Cand>();
  for (const item of candidates) {
    const key = item.label.toLowerCase();
    const existing = best.get(key);
    if (!existing || item.score > existing.score) {
      best.set(key, item);
    } else if (existing && item.score === existing.score && !item.available) {
      best.set(key, item);
    }
  }

  const sizes = [...best.values()].filter((s) => s.score >= 2);

  // Overall product availability (size-less SKUs)
  let productInStock: boolean | null = null;
  const bodyText = (document.body?.innerText || "")
    .toLowerCase()
    .slice(0, 20_000);

  const stockBadgeText = Array.from(
    document.querySelectorAll(
      "[class*='sold' i], [class*='stock' i], [data-testid*='stock' i], [class*='availability' i]",
    ),
  )
    .map((el) => textOf(el).toLowerCase())
    .join(" ");

  const soldOutBadge = UNAVAILABLE.some(
    (p) => stockBadgeText.includes(p) || bodyText.slice(0, 2500).includes(p),
  );

  const addToCart = document.querySelector(
    [
      "button[name='add']",
      "button[id*='add' i]",
      "button[class*='add-to-cart' i]",
      "button[class*='addToCart' i]",
      "button[data-testid*='add' i]",
      "form[action*='cart' i] button[type='submit']",
      "button[aria-label*='add to' i]",
    ].join(","),
  ) as HTMLButtonElement | null;

  const addToCartFound = Boolean(addToCart);
  if (addToCart) {
    const disabled =
      addToCart.disabled ||
      addToCart.getAttribute("aria-disabled") === "true" ||
      /disabled|sold|unavailable/.test(
        (addToCart.className || "").toString().toLowerCase(),
      );
    productInStock = !disabled;
  } else if (soldOutBadge) {
    productInStock = false;
  } else if (AVAILABLE.some((p) => bodyText.includes(p))) {
    productInStock = true;
  } else if (UNAVAILABLE.some((p) => bodyText.includes(p))) {
    productInStock = false;
  }

  if (sizes.length > 0) {
    productInStock = sizes.some((s) => s.available);
  }

  const ogTitle =
    document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content") || null;
  const ogImage =
    document
      .querySelector('meta[property="og:image"]')
      ?.getAttribute("content") || null;
  const h1 = document.querySelector("h1");

  return {
    productName: (ogTitle || (h1 ? textOf(h1) : null) || null)?.slice(0, 200) ?? null,
    productImageUrl: ogImage,
    sizes,
    productInStock,
    signals: {
      sizeNodeCount: sizes.length,
      addToCartFound,
      soldOutBadge,
    },
  };
}
