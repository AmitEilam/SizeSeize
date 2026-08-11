type LoadingSpinnerProps = {
  className?: string;
};

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <svg
      className={className ? `ss-spinner ${className}` : "ss-spinner"}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="ss-spinner-track"
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        className="ss-spinner-head"
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
