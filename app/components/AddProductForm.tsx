"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addProduct, type ActionState } from "@/app/actions";
import { PendingButton } from "@/app/components/PendingButton";

const initial: ActionState = {};

export function AddProductForm() {
  const [state, action, pending] = useActionState(addProduct, initial);

  return (
    <form action={action} className="ss-card flex flex-col gap-4">
      <div className="ss-field">
        <label htmlFor="product_url">Product URL</label>
        <input
          id="product_url"
          name="product_url"
          type="url"
          inputMode="url"
          placeholder="https://store.example.com/products/..."
          required
          autoComplete="off"
        />
      </div>
      <div className="ss-field">
        <label htmlFor="desired_size">Desired size (optional)</label>
        <input
          id="desired_size"
          name="desired_size"
          type="text"
          placeholder="M, L, 42… or leave empty"
          autoComplete="off"
        />
        <p className="m-0 text-[0.85rem] text-[var(--muted)]">
          Leave empty to monitor overall product availability (in stock / out of
          stock).
        </p>
      </div>
      {state.error ? (
        <p className="text-[0.95rem] text-[var(--danger)]">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-[0.95rem] text-[var(--ok)]">{state.success}</p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <PendingButton
          type="submit"
          pending={pending}
          pendingLabel="Adding & checking…"
          className="ss-btn ss-btn-primary w-full sm:w-auto"
        >
          Add product
        </PendingButton>
        {state.success ? (
          <Link href="/dashboard" className="ss-btn ss-btn-secondary w-full sm:w-auto">
            View dashboard
          </Link>
        ) : null}
      </div>
    </form>
  );
}
