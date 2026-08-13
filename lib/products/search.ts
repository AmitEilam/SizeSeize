import { getProductStatus } from "@/lib/products/status";
import type { ProductSort } from "@/lib/products/sort";
import {
  SORT_DIRECTION_PARAM,
  SORT_FIELD_PARAM,
  parseProductSort,
} from "@/lib/products/sort";
import type { MonitoredProduct } from "@/lib/types";

export const SEARCH_PARAM = "q";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseProductSearch(
  searchParams:
    | Record<string, string | string[] | undefined>
    | undefined
    | null,
): string {
  return firstValue(searchParams?.[SEARCH_PARAM])?.trim() ?? "";
}

export function buildDashboardQuery(options: {
  sort: ProductSort;
  q?: string;
}): string {
  const params = new URLSearchParams();
  params.set(SORT_FIELD_PARAM, options.sort.field);
  params.set(SORT_DIRECTION_PARAM, options.sort.direction);

  const trimmed = options.q?.trim();
  if (trimmed) {
    params.set(SEARCH_PARAM, trimmed);
  }

  return params.toString();
}

function searchableText(product: MonitoredProduct): string {
  const parts = [
    product.product_name,
    product.product_url,
    product.desired_size,
    product.note,
    getProductStatus(product).label,
    product.last_check_error,
    product.last_known_available_sizes?.join(" "),
  ];

  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
}

export function filterProducts(
  products: MonitoredProduct[],
  query: string,
): MonitoredProduct[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return products;

  return products.filter((product) => searchableText(product).includes(needle));
}

export function parseDashboardParams(
  searchParams:
    | Record<string, string | string[] | undefined>
    | undefined
    | null,
) {
  return {
    sort: parseProductSort(searchParams),
    q: parseProductSearch(searchParams),
  };
}
