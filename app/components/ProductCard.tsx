"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  deleteProduct,
  runCheckNow,
  updateProductNote,
  updateProductSize,
  type ActionState,
} from "@/app/actions";
import { DeleteProductButton } from "@/app/components/DeleteProductButton";
import { PendingButton } from "@/app/components/PendingButton";
import type { MonitoredProduct } from "@/lib/types";
import { formatDesiredSizeLabel } from "@/lib/monitoring/sizeMatch";
import { getProductStatus } from "@/lib/products/status";

const initial: ActionState = {};

function formatChecked(value: string | null) {
  if (!value) return "Never";
  try {
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  } catch {
    return value;
  }
}

export function ProductCard({ product }: { product: MonitoredProduct }) {
  const [editing, setEditing] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [updateState, updateAction, updating] = useActionState(
    updateProductSize,
    initial,
  );
  const [checkState, checkAction, checking] = useActionState(
    runCheckNow,
    initial,
  );
  const [noteState, noteAction, savingNote] = useActionState(
    updateProductNote,
    initial,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (updateState.success) {
      setEditing(false);
    }
  }, [updateState.success]);

  useEffect(() => {
    if (noteState.success) {
      setEditingNote(false);
    }
  }, [noteState.success]);

  useEffect(() => {
    setImageFailed(false);
  }, [product.product_image_url]);

  useEffect(() => {
    if (!confirmDelete) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmDelete(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmDelete]);

  const title = product.product_name || product.product_url;
  const status = getProductStatus(product);

  const showImage = Boolean(product.product_image_url) && !imageFailed;

  const deleteModal =
    mounted && confirmDelete
      ? createPortal(
          <div
            className="ss-modal-root"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setConfirmDelete(false);
              }
            }}
          >
            <div
              className="ss-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`delete-title-${product.id}`}
              aria-describedby={`delete-desc-${product.id}`}
            >
              <h2 id={`delete-title-${product.id}`} className="ss-modal-title">
                Delete product?
              </h2>
              <p id={`delete-desc-${product.id}`} className="ss-modal-body">
                Are you sure you want to delete <strong>{title}</strong>? This
                cannot be undone.
              </p>
              <div className="ss-modal-actions">
                <button
                  type="button"
                  className="ss-btn ss-btn-secondary"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
                <form action={deleteProduct}>
                  <input type="hidden" name="id" value={product.id} />
                  <DeleteProductButton />
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

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
        <div className="ss-product-header">
          <div className="ss-product-title-row">
            <h3 className="ss-product-title" title={title}>
              {title}
            </h3>
            <span className={`ss-badge ${status.badgeClass} shrink-0`}>
              {status.label}
            </span>
          </div>
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ss-product-link"
          >
            {product.product_url}
          </a>
        </div>

        <div
          className={`ss-product-meta-section ss-product-meta-section--${status.key}`}
        >
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
        </div>

        <div className="ss-product-note-section">
          <div className="ss-product-note-header">
            <p className="ss-product-note-label">Personal note</p>
            {!editingNote ? (
              <div className="ss-product-note-actions">
                {product.note ? (
                  <>
                    <button
                      type="button"
                      className="ss-btn ss-btn-secondary ss-product-note-toggle"
                      onClick={() => {
                        setEditingNote(true);
                        setEditing(false);
                        setConfirmDelete(false);
                      }}
                    >
                      Edit note
                    </button>
                    <form action={noteAction}>
                      <input type="hidden" name="id" value={product.id} />
                      <input type="hidden" name="note" value="" />
                      <PendingButton
                        type="submit"
                        pending={savingNote}
                        pendingLabel="Removing…"
                        className="ss-btn ss-btn-danger ss-product-note-toggle"
                      >
                        Remove note
                      </PendingButton>
                    </form>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ss-btn ss-btn-secondary ss-product-note-toggle"
                    onClick={() => {
                      setEditingNote(true);
                      setEditing(false);
                      setConfirmDelete(false);
                    }}
                  >
                    Add note
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {editingNote ? (
            <form action={noteAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={product.id} />
              <div className="ss-field">
                <label htmlFor={`note-${product.id}`} className="sr-only">
                  Personal note
                </label>
                <textarea
                  id={`note-${product.id}`}
                  name="note"
                  className="ss-textarea"
                  rows={3}
                  maxLength={2000}
                  defaultValue={product.note ?? ""}
                  placeholder="Coupon code, reminder, or anything to keep handy when this size is back."
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <PendingButton
                  type="submit"
                  pending={savingNote}
                  pendingLabel="Saving…"
                  className="ss-btn ss-btn-primary w-full sm:w-auto"
                >
                  Save note
                </PendingButton>
                <button
                  type="button"
                  className="ss-btn ss-btn-secondary w-full sm:w-auto"
                  onClick={() => setEditingNote(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : product.note ? (
            <p className="ss-product-note">{product.note}</p>
          ) : (
            <p className="ss-product-note-empty">
              Save a coupon code or reminder for when this product becomes
              available.
            </p>
          )}

          {noteState.error ? (
            <p className="m-0 text-sm text-[var(--danger)]">{noteState.error}</p>
          ) : null}
          {!editingNote && noteState.success ? (
            <p className="m-0 text-sm text-[var(--ok)]">{noteState.success}</p>
          ) : null}
        </div>

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
              <PendingButton
                type="submit"
                pending={updating}
                pendingLabel="Saving…"
                className="ss-btn ss-btn-primary"
              >
                Save
              </PendingButton>
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
        {/* Prefer the persisted check error on the card; avoid a second duplicate line. */}
        {!product.last_check_error && checkState.error ? (
          <p className="text-sm text-[var(--danger)]">{checkState.error}</p>
        ) : null}
        {checkState.success ? (
          <p className="text-sm text-[var(--ok)]">{checkState.success}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="ss-btn ss-btn-secondary"
            onClick={() => {
              setEditing(true);
              setEditingNote(false);
              setConfirmDelete(false);
            }}
          >
            Edit
          </button>
          <form action={checkAction}>
            <input type="hidden" name="id" value={product.id} />
            <PendingButton
              type="submit"
              pending={checking}
              pendingLabel="Checking…"
              className="ss-btn ss-btn-secondary w-full sm:w-auto"
            >
              Check now
            </PendingButton>
          </form>
          <button
            type="button"
            className="ss-btn ss-btn-danger w-full sm:w-auto"
            onClick={() => {
              setConfirmDelete(true);
              setEditing(false);
              setEditingNote(false);
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {deleteModal}
    </article>
  );
}
