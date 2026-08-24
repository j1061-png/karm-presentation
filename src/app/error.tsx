"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[15px] font-medium">Something went wrong</p>
      <p className="text-[13px] text-text-secondary max-w-sm">
        The last action hit an unexpected error. Your work is still saved — try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 text-[13px] font-medium bg-accent text-accent-text rounded-lg px-3.5 py-2 hover:bg-accent-hover cursor-pointer"
      >
        Try again
      </button>
      {error.digest && (
        <p className="text-[11px] text-text-tertiary font-mono">{error.digest}</p>
      )}
    </div>
  );
}
