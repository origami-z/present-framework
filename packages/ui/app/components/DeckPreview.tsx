import { useEffect, useState } from "react";

interface Props {
  content: string;
}

export function DeckPreview({ content }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!content) {
      setBlobUrl(null);
      return;
    }
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [content]);

  if (!content) {
    return (
      <div style={emptyStyle}>
        No deck generated yet. Click <strong>Generate All</strong>.
      </div>
    );
  }

  if (!blobUrl) {
    return <div style={emptyStyle}>Loading deck preview...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <iframe
        src={blobUrl}
        style={iframeStyle}
        title="Presentation deck"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
      <a href={blobUrl} download="deck.html" style={downloadStyle}>
        ↓ Download deck.html
      </a>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: 200,
  color: "#94a3b8",
  fontSize: "0.9rem",
};

const iframeStyle: React.CSSProperties = {
  flex: 1,
  border: "none",
  background: "#fff",
  minHeight: 500,
};

const downloadStyle: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "0.5rem",
  background: "#f1f5f9",
  color: "#1a56db",
  textDecoration: "none",
  fontSize: "0.85rem",
  borderTop: "1px solid #e2e8f0",
};
