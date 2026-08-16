"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { runCheckAll, type ActionState } from "@/app/actions";
import { ProductSortControl } from "@/app/components/ProductSortControl";
import type { ProductSort } from "@/lib/products/sort";

const initial: ActionState = {};

type Props = {
  productCount: number;
  sort: ProductSort;
};

export function DashboardToolbar({ productCount, sort }: Props) {
  const [state, action, pending] = useActionState(runCheckAll, initial);
  const [mounted, setMounted] = useState(false);
  const [updateModal, setUpdateModal] = useState<
    "unchanged" | "updated" | null
  >(null);
  const wasPending = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (wasPending.current && !pending && state.checkAllUpdates) {
      setUpdateModal(state.checkAllUpdates);
    }
    wasPending.current = pending;
  }, [pending, state.checkAllUpdates]);

  useEffect(() => {
    if (!updateModal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUpdateModal(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [updateModal]);

  const updateModalNode =
    mounted && updateModal
      ? createPortal(
          <div
            className="ss-modal-root"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setUpdateModal(null);
              }
            }}
          >
            <div
              className="ss-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="check-all-updates-title"
            >
              <h2 id="check-all-updates-title" className="ss-modal-title">
                {updateModal === "updated"
                  ? "New updates available."
                  : "No new updates."}
              </h2>
              <div className="ss-modal-actions">
                <button
                  type="button"
                  className="ss-btn ss-btn-primary"
                  onClick={() => setUpdateModal(null)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="ss-toolbar-panel">
        <div className="ss-toolbar">
          <p className="ss-toolbar-meta">
            {productCount} monitored product{productCount === 1 ? "" : "s"}
          </p>
          <div className="ss-toolbar-controls">
            <ProductSortControl sort={sort} />
            <form action={action}>
              <button
                type="submit"
                className="ss-btn ss-btn-secondary w-full sm:w-auto"
                disabled={pending}
              >
                {pending ? "Checking all…" : "Check all"}
              </button>
            </form>
          </div>
        </div>

        {state.error ? (
          <p className="ss-status-banner ss-status-banner-error" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>

      {updateModalNode}
    </>
  );
}
