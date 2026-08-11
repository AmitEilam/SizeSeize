"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";

type PendingLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
  pendingLabel: string;
};

function PendingLinkContents({
  children,
  pendingLabel,
}: Pick<PendingLinkProps, "children" | "pendingLabel">) {
  const { pending } = useLinkStatus();

  if (pending) {
    return (
      <>
        <LoadingSpinner />
        <span>{pendingLabel}</span>
      </>
    );
  }

  return <>{children}</>;
}

export function PendingLink({
  href,
  className,
  children,
  pendingLabel,
}: PendingLinkProps) {
  return (
    <Link href={href} className={className}>
      <PendingLinkContents pendingLabel={pendingLabel}>
        {children}
      </PendingLinkContents>
    </Link>
  );
}
