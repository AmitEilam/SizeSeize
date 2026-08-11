"use client";

import { useActionState } from "react";
import { runCheckAll, type ActionState } from "@/app/actions";

const initial: ActionState = {};

export function CheckAllButton({ productCount }: { productCount: number }) {
  const [state, action, pending] = useActionState(runCheckAll, initial);

  if (productCount === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <button
          type="submit"
          className="ss-btn ss-btn-secondary w-full sm:w-auto"
          disabled={pending}
        >
          {pending ? "Checking all…" : "Check all"}
        </button>
      </form>
      {state.error ? (
        <p className="m-0 text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="m-0 text-sm text-[var(--ok)]">{state.success}</p>
      ) : null}
    </div>
  );
}
