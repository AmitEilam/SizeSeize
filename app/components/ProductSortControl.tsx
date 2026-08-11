"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import {
  buildProductSortQuery,
  PRODUCT_SORT_DIRECTION_LABELS,
  PRODUCT_SORT_FIELD_LABELS,
  PRODUCT_SORT_FIELDS,
  type ProductSort,
  type ProductSortField,
  type SortDirection,
} from "@/lib/products/sort";

export function ProductSortControl({ sort }: { sort: ProductSort }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(sort);

  function apply(next: ProductSort) {
    startTransition(() => {
      setCurrent(next);
      router.replace(`/dashboard?${buildProductSortQuery(next)}`, {
        scroll: false,
      });
    });
  }

  const directionLabels = PRODUCT_SORT_DIRECTION_LABELS[current.field];

  return (
    <div className="ss-sort">
      <div className="ss-sort-field">
        <label htmlFor="product-sort-field">Sort by</label>
        <select
          id="product-sort-field"
          className="ss-select"
          value={current.field}
          onChange={(event) =>
            apply({
              field: event.target.value as ProductSortField,
              direction: current.direction,
            })
          }
        >
          {PRODUCT_SORT_FIELDS.map((field) => (
            <option key={field} value={field}>
              {PRODUCT_SORT_FIELD_LABELS[field]}
            </option>
          ))}
        </select>
      </div>

      <div className="ss-sort-field">
        <label htmlFor="product-sort-direction">Order</label>
        <select
          id="product-sort-direction"
          className="ss-select"
          value={current.direction}
          onChange={(event) =>
            apply({
              field: current.field,
              direction: event.target.value as SortDirection,
            })
          }
        >
          <option value="asc">{directionLabels.asc}</option>
          <option value="desc">{directionLabels.desc}</option>
        </select>
      </div>
    </div>
  );
}
