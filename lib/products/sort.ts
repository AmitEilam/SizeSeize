import { getProductStatusRank } from "@/lib/products/status";
import type { MonitoredProduct } from "@/lib/types";

export const PRODUCT_SORT_FIELDS = [
  "name",
  "status",
  "created_at",
  "last_checked_at",
] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export type ProductSort = {
  field: ProductSortField;
  direction: SortDirection;
};

export const SORT_FIELD_PARAM = "sort";
export const SORT_DIRECTION_PARAM = "dir";

export const PRODUCT_SORT_FIELD_LABELS: Record<ProductSortField, string> = {
  name: "Name",
  status: "Status",
  created_at: "Date added",
  last_checked_at: "Last checked",
};

/** Direction labels are field specific so the dropdown reads plainly. */
export const PRODUCT_SORT_DIRECTION_LABELS: Record<
  ProductSortField,
  Record<SortDirection, string>
> = {
  name: { asc: "A to Z", desc: "Z to A" },
  status: { asc: "Available first", desc: "Issues first" },
  created_at: { asc: "Oldest first", desc: "Newest first" },
  last_checked_at: { asc: "Oldest first", desc: "Newest first" },
};

const DEFAULT_DIRECTIONS: Record<ProductSortField, SortDirection> = {
  name: "asc",
  status: "asc",
  created_at: "desc",
  last_checked_at: "desc",
};

export const DEFAULT_PRODUCT_SORT: ProductSort = {
  field: "created_at",
  direction: DEFAULT_DIRECTIONS.created_at,
};

export function defaultDirectionFor(field: ProductSortField): SortDirection {
  return DEFAULT_DIRECTIONS[field];
}

function isProductSortField(value: unknown): value is ProductSortField {
  return (
    typeof value === "string" &&
    (PRODUCT_SORT_FIELDS as readonly string[]).includes(value)
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseProductSort(
  searchParams:
    | Record<string, string | string[] | undefined>
    | undefined
    | null,
): ProductSort {
  const rawField = firstValue(searchParams?.[SORT_FIELD_PARAM]);
  const rawDirection = firstValue(searchParams?.[SORT_DIRECTION_PARAM]);

  const field = isProductSortField(rawField)
    ? rawField
    : DEFAULT_PRODUCT_SORT.field;
  const direction =
    rawDirection === "asc" || rawDirection === "desc"
      ? rawDirection
      : defaultDirectionFor(field);

  return { field, direction };
}

export function buildProductSortQuery(sort: ProductSort): string {
  const params = new URLSearchParams();
  params.set(SORT_FIELD_PARAM, sort.field);
  params.set(SORT_DIRECTION_PARAM, sort.direction);
  return params.toString();
}

function displayName(product: MonitoredProduct): string {
  return product.product_name?.trim() || product.product_url;
}

function toTime(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Missing timestamps count as the oldest possible value. */
function compareTimes(a: string | null, b: string | null): number {
  const timeA = toTime(a);
  const timeB = toTime(b);

  if (timeA === null && timeB === null) return 0;
  if (timeA === null) return -1;
  if (timeB === null) return 1;
  return timeA - timeB;
}

function compareNames(a: MonitoredProduct, b: MonitoredProduct): number {
  return displayName(a).localeCompare(displayName(b), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function compareByField(
  a: MonitoredProduct,
  b: MonitoredProduct,
  field: ProductSortField,
): number {
  switch (field) {
    case "name":
      return compareNames(a, b);
    case "status":
      return getProductStatusRank(a) - getProductStatusRank(b);
    case "created_at":
      return compareTimes(a.created_at, b.created_at);
    case "last_checked_at":
      return compareTimes(a.last_checked_at, b.last_checked_at);
  }
}

export function sortProducts(
  products: MonitoredProduct[],
  sort: ProductSort,
): MonitoredProduct[] {
  const factor = sort.direction === "asc" ? 1 : -1;

  return [...products].sort((a, b) => {
    const primary = compareByField(a, b, sort.field);
    if (primary !== 0) return primary * factor;

    // Stable, predictable fallback: newest added first, then by name.
    const byCreated = compareTimes(b.created_at, a.created_at);
    return byCreated !== 0 ? byCreated : compareNames(a, b);
  });
}
