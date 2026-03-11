import { useEffect, useRef, useState } from "react";

interface Props {
  content: string;
}

export function DiagramPreview({ content }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || !content) return;

    // Extract mermaid code from markdown fences
    const match = content.match(/```mermaid\n([\s\S]*?)```/);
    const code = match ? match[1].trim() : content.trim();

    let cancelled = false;
    import("mermaid").then(({ default: mermaid }) => {
      if (cancelled) return;
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        flowchart: { htmlLabels: true, curve: "basis" },
      });
      const id = "diagram-" + Date.now();
      mermaid
        .render(id, code)
        .then(({ svg }) => {
          if (!cancelled && ref.current) {
            ref.current.innerHTML = svg;
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [content]);

  if (!content) {
    return (
      <div style={emptyStyle}>
        No diagram generated yet. Click <strong>Generate All</strong>.
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", overflow: "auto" }}>
      {error && (
        <div style={{ color: "red", marginBottom: "0.5rem", fontSize: "0.8rem" }}>
          ⚠️ Mermaid error: {error}
        </div>
      )}
      <div ref={ref} style={{ minHeight: 200 }} />
      <details style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", color: "#64748b", fontSize: "0.8rem" }}>
          View raw Mermaid source
        </summary>
        <pre style={codeStyle}>{content}</pre>
      </details>
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

const codeStyle: React.CSSProperties = {
  background: "#f1f5f9",
  padding: "0.75rem",
  borderRadius: 6,
  fontSize: "0.75rem",
  overflow: "auto",
  marginTop: "0.5rem",
};
