import type { MonitoredProduct } from "@/lib/types";

export type ProductStatusKey =
  | "available"
  | "unavailable"
  | "blocked"
  | "unsupported"
  | "error";

export type ProductStatus = {
  key: ProductStatusKey;
  label: string;
  badgeClass: string;
};

/**
 * Status order used by the dashboard status sort, ascending.
 * Ascending reads as "healthy first", descending as "issues first".
 */
export const PRODUCT_STATUS_ORDER: ProductStatusKey[] = [
  "available",
  "unavailable",
  "blocked",
  "unsupported",
  "error",
];

const STATUS_LABELS: Record<ProductStatusKey, string> = {
  available: "Available",
  unavailable: "Unavailable",
  blocked: "Blocked",
  unsupported: "Unsupported",
  error: "Check error",
};

const STATUS_BADGE_CLASSES: Record<ProductStatusKey, string> = {
  available: "ss-badge-ok",
  unavailable: "ss-badge-warn",
  blocked: "ss-badge-muted",
  unsupported: "ss-badge-muted",
  error: "ss-badge-muted",
};

type StatusInput = Pick<
  MonitoredProduct,
  "last_check_error" | "desired_size_available"
>;

export function getProductStatusKey(product: StatusInput): ProductStatusKey {
  const error = product.last_check_error?.toLowerCase();

  if (error) {
    if (error.includes("confident") || error.includes("unsupported")) {
      return "unsupported";
    }
    if (error.includes("blocked")) {
      return "blocked";
    }
    return "error";
  }

  return product.desired_size_available ? "available" : "unavailable";
}

export function getProductStatus(product: StatusInput): ProductStatus {
  const key = getProductStatusKey(product);
  return {
    key,
    label: STATUS_LABELS[key],
    badgeClass: STATUS_BADGE_CLASSES[key],
  };
}

export function getProductStatusRank(product: StatusInput): number {
  const rank = PRODUCT_STATUS_ORDER.indexOf(getProductStatusKey(product));
  return rank === -1 ? PRODUCT_STATUS_ORDER.length : rank;
}
