"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#171717", color: "#f5f5f5" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>webo hit an unexpected error</p>
          <p style={{ fontSize: 13, opacity: 0.7, maxWidth: 360, margin: 0 }}>
            Reload the page to continue. If this keeps happening, start a new chat.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 8, fontSize: 13, fontWeight: 500, background: "#f5a623", color: "#171717", border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ fontSize: 11, opacity: 0.45, fontFamily: "ui-monospace, monospace" }}>{error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
