"use client";

import { useActionState, useEffect, useState } from "react";
import {
  deleteProduct,
  runCheckNow,
  updateProductSize,
  type ActionState,
} from "@/app/actions";
import type { MonitoredProduct } from "@/lib/types";
import { formatDesiredSizeLabel } from "@/lib/monitoring/sizeMatch";

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
  const [imageFailed, setImageFailed] = useState(false);
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

  useEffect(() => {
    setImageFailed(false);
  }, [product.product_image_url]);

  const title = product.product_name || product.product_url;
  const statusClass = product.last_check_error
    ? "ss-badge-muted"
    : product.desired_size_available
      ? "ss-badge-ok"
      : "ss-badge-warn";
  const statusLabel = product.last_check_error
    ? product.last_check_error.toLowerCase().includes("confident") ||
      product.last_check_error.toLowerCase().includes("unsupported")
      ? "Unsupported"
      : product.last_check_error.toLowerCase().includes("blocked")
        ? "Blocked"
        : "Check error"
    : product.desired_size_available
      ? "Available"
      : "Unavailable";

  const showImage = Boolean(product.product_image_url) && !imageFailed;

  return (
    <article
      className={`ss-card ss-product-card${showImage ? " ss-product-card--with-image" : ""}`}
    >
      {showImage ? (
        <a
          href={product.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ss-product-media"
          aria-label={`Open ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.product_image_url!}
            alt=""
            className="ss-product-image"
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        </a>
      ) : null}

      <div className="ss-product-body">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="ss-product-title" title={title}>
              {title}
            </h3>
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ss-product-link"
            >
              {product.product_url}
            </a>
          </div>
          <span className={`ss-badge ${statusClass} w-fit`}>{statusLabel}</span>
        </div>

        <dl className="ss-meta-list">
          <div className="ss-meta-row">
            <dt>Desired size</dt>
            <dd className="font-semibold">
              {formatDesiredSizeLabel(product.desired_size)}
            </dd>
          </div>
          <div className="ss-meta-row">
            <dt>Available sizes</dt>
            <dd>
              {product.last_known_available_sizes?.length
                ? product.last_known_available_sizes.join(", ")
                : !product.last_checked_at
                  ? "-"
                  : product.desired_size?.trim()
                    ? "-"
                    : product.desired_size_available
                      ? "In stock"
                      : "Out of stock"}
            </dd>
          </div>
          <div className="ss-meta-row">
            <dt>Last checked</dt>
            <dd>{formatChecked(product.last_checked_at)}</dd>
          </div>
          {product.last_check_error ? (
            <div className="rounded-lg bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2 text-[0.95rem] text-[var(--danger)]">
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
              <label htmlFor={`size-${product.id}`}>
                Desired size (optional)
              </label>
              <input
                id={`size-${product.id}`}
                name="desired_size"
                defaultValue={product.desired_size ?? ""}
                placeholder="Leave empty for overall stock"
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
            Edit
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
            <button
              type="submit"
              className="ss-btn ss-btn-danger w-full sm:w-auto"
            >
              Delete
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
