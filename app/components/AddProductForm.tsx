"use client";

import { useActionState } from "react";
import { addProduct, type ActionState } from "@/app/actions";

const initial: ActionState = {};

export function AddProductForm() {
  const [state, action, pending] = useActionState(addProduct, initial);

  return (
    <form action={action} className="ss-card flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Add product</h2>
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
        <label htmlFor="desired_size">Desired size</label>
        <input
          id="desired_size"
          name="desired_size"
          type="text"
          placeholder="M, L, 42..."
          required
          autoComplete="off"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-[var(--ok)]">{state.success}</p>
      ) : null}
      <button
        type="submit"
        className="ss-btn ss-btn-primary w-full sm:w-auto"
        disabled={pending}
      >
        {pending ? "Adding…" : "Add Product"}
      </button>
    </form>
  );
}
