"use client";

/**
 * Replaces the whole document when the root layout itself fails, so even that
 * case keeps a retry rather than falling back to the browser's error page.
 * It renders outside the app's stylesheet, hence the inline styles.
 */
export default function GlobalError({ retry }: { error: Error; retry: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e9eaec",
          color: "#17181a",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 340,
            padding: 24,
            borderRadius: 16,
            background: "#fff",
            textAlign: "center",
            boxShadow: "0 12px 40px rgba(23, 24, 26, 0.08)",
          }}
        >
          <h1 style={{ fontSize: 14, margin: 0 }}>Algo ha fallado</h1>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: "#8a8d93" }}>
            No se pudo cargar la aplicación. Inténtalo de nuevo en unos segundos.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: 0,
              background: "#17181a",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
