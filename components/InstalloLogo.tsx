export function InstalloLogo({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Installo"
      className={className}
    >
      <rect x="10" y="10" width="28" height="28" rx="8" fill="currentColor" />
      <path
        d="M20 18h8v12h-4V22h-4z"
        className="fill-white dark:fill-zinc-900"
      />
    </svg>
  );
}
