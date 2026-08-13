"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { buildDashboardQuery } from "@/lib/products/search";
import type { ProductSort } from "@/lib/products/sort";

type Props = {
  query: string;
  sort: ProductSort;
};

export function ProductSearchControl({ query, sort }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function apply(nextQuery: string) {
    startTransition(() => {
      setCurrent(nextQuery);
      router.replace(`/dashboard?${buildDashboardQuery({ sort, q: nextQuery })}`, {
        scroll: false,
      });
    });
  }

  function scheduleApply(nextQuery: string) {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      apply(nextQuery);
    }, 250);
  }

  function clearSearch() {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    apply("");
  }

  return (
    <div className="ss-search">
      <label htmlFor="product-search" className="ss-search-label">
        Search products
      </label>
      <div className="ss-search-row">
        <input
          ref={inputRef}
          key={query}
          id="product-search"
          type="search"
          className="ss-search-input"
          placeholder="Search by name, URL, size, note, or status…"
          defaultValue={query}
          onChange={(event) => scheduleApply(event.target.value)}
        />
        {current ? (
          <button
            type="button"
            className="ss-btn ss-btn-secondary ss-search-clear"
            onClick={clearSearch}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
