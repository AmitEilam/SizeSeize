"use client";

import { useActionState } from "react";
import { runCheckAll, type ActionState } from "@/app/actions";
import { PendingButton } from "@/app/components/PendingButton";
import { ProductSearchControl } from "@/app/components/ProductSearchControl";
import { ProductSortControl } from "@/app/components/ProductSortControl";
import type { ProductSort } from "@/lib/products/sort";

const initial: ActionState = {};

type Props = {
  productCount: number;
  totalCount: number;
  sort: ProductSort;
  query: string;
};

export function DashboardToolbar({
  productCount,
  totalCount,
  sort,
  query,
}: Props) {
  const [state, action, pending] = useActionState(runCheckAll, initial);
  const searching = query.trim().length > 0;

  return (
    <div className="ss-toolbar-panel">
      <ProductSearchControl query={query} sort={sort} />

      <div className="ss-toolbar">
        <p className="ss-toolbar-meta">
          {searching
            ? `${productCount} of ${totalCount} product${totalCount === 1 ? "" : "s"}`
            : `${productCount} monitored product${productCount === 1 ? "" : "s"}`}
        </p>
        <div className="ss-toolbar-controls">
          <ProductSortControl sort={sort} query={query} />
          <form action={action}>
            <PendingButton
              type="submit"
              pending={pending}
              pendingLabel="Checking all…"
              className="ss-btn ss-btn-secondary w-full sm:w-auto"
            >
              Check all
            </PendingButton>
          </form>
        </div>
      </div>

      {state.error ? (
        <p className="ss-status-banner ss-status-banner-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="ss-status-banner ss-status-banner-ok" role="status">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
