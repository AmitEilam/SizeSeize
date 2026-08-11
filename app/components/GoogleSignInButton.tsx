"use client";

import { FormStatusButton } from "@/app/components/PendingButton";

export function GoogleSignInButton() {
  return (
    <FormStatusButton
      type="submit"
      pendingLabel="Signing in…"
      className="ss-btn ss-btn-primary w-full"
    >
      Continue with Google
    </FormStatusButton>
  );
}
