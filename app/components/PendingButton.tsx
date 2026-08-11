"use client";

import { useFormStatus } from "react-dom";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";

type PendingButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel: string;
  children: React.ReactNode;
};

export function PendingButton({
  pending = false,
  pendingLabel,
  children,
  disabled,
  className,
  type = "button",
  ...rest
}: PendingButtonProps) {
  const isPending = pending;

  return (
    <button
      {...rest}
      type={type}
      className={className}
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
    >
      {isPending ? (
        <>
          <LoadingSpinner />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

type FormStatusButtonProps = Omit<PendingButtonProps, "pending">;

/** Submit button that reads pending state from the nearest parent form. */
export function FormStatusButton({
  pendingLabel,
  children,
  ...rest
}: FormStatusButtonProps) {
  const { pending } = useFormStatus();

  return (
    <PendingButton pending={pending} pendingLabel={pendingLabel} {...rest}>
      {children}
    </PendingButton>
  );
}
