"use client";

import { FormStatusButton } from "@/app/components/PendingButton";

export function DeleteProductButton() {
  return (
    <FormStatusButton
      type="submit"
      pendingLabel="Deleting…"
      className="ss-btn ss-btn-danger"
    >
      Yes, delete
    </FormStatusButton>
  );
}
