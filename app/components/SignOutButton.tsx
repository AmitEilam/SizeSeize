"use client";

import { FormStatusButton } from "@/app/components/PendingButton";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className = "ss-btn ss-btn-secondary" }: SignOutButtonProps) {
  return (
    <FormStatusButton type="submit" pendingLabel="Signing out…" className={className}>
      Sign out
    </FormStatusButton>
  );
}
