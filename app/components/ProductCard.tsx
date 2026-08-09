"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteProduct,
  runCheckNow,
  updateProductSize,
  type ActionState,
} from "@/app/actions";
import type { MonitoredProduct } from "@/lib/types";

const initial: ActionState = {};

function formatChecked(value: string | null) {
  if (!value) return "Never";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ProductCard({ product }: { product: MonitoredProduct }) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updating] = useActionState(
    updateProductSize,
    initial,
  );
  const [checkState, checkAction, checking] = useActionState(
    runCheckNow,
    initial,
  );

  useEffect(() => {
    if (updateState.success) {
      setEditing(false);
    }
  }, [updateState.success]);

  const title = product.product_name || product.product_url;
  const statusClass = product.last_check_error
    ? "ss-badge-muted"
    : product.desired_size_available
      ? "ss-badge-ok"
      : "ss-badge-warn";
  const statusLabel = product.last_check_error
    ? "Check error"
    : product.desired_size_available
      ? "Available"
      : "Unavailable";

  return (
    <article className="ss-card flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold" title={title}>
            {title}
          </h3>
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block truncate text-sm text-[var(--brand-soft)] underline-offset-2 hover:underline"
          >
            {product.product_url}
          </a>
        </div>
        <span className={`ss-badge ${statusClass} w-fit`}>{statusLabel}</span>
      </div>

      <dl className="grid gap-2 text-sm text-[var(--muted)]">
        <div className="flex flex-wrap gap-x-2">
          <dt>Desired size:</dt>
          <dd className="font-semibold text-[var(--ink)]">
            {product.desired_size}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt>Available sizes:</dt>
          <dd className="text-[var(--ink)]">
            {product.last_known_available_sizes?.length
              ? product.last_known_available_sizes.join(", ")
              : "—"}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt>Last checked:</dt>
          <dd>{formatChecked(product.last_checked_at)}</dd>
        </div>
        {product.last_check_error ? (
          <div className="rounded-lg bg-[rgba(155,44,44,0.08)] px-3 py-2 text-[var(--danger)]">
            {product.last_check_error}
          </div>
        ) : null}
      </dl>

      {editing ? (
        <form
          action={updateAction}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="id" value={product.id} />
          <div className="ss-field flex-1">
            <label htmlFor={`size-${product.id}`}>New desired size</label>
            <input
              id={`size-${product.id}`}
              name="desired_size"
              defaultValue={product.desired_size}
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="ss-btn ss-btn-primary"
              disabled={updating}
            >
              Save
            </button>
            <button
              type="button"
              className="ss-btn ss-btn-secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {updateState.error ? (
        <p className="text-sm text-[var(--danger)]">{updateState.error}</p>
      ) : null}
      {checkState.error ? (
        <p className="text-sm text-[var(--danger)]">{checkState.error}</p>
      ) : null}
      {checkState.success ? (
        <p className="text-sm text-[var(--ok)]">{checkState.success}</p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className="ss-btn ss-btn-secondary"
          onClick={() => setEditing(true)}
        >
          Edit size
        </button>
        <form action={checkAction}>
          <input type="hidden" name="id" value={product.id} />
          <button
            type="submit"
            className="ss-btn ss-btn-secondary w-full sm:w-auto"
            disabled={checking}
          >
            {checking ? "Checking…" : "Check now"}
          </button>
        </form>
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={product.id} />
          <button type="submit" className="ss-btn ss-btn-danger w-full sm:w-auto">
            Delete
          </button>
        </form>
      </div>
    </article>
  );
}
