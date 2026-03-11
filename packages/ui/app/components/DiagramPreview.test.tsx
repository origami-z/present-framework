import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiagramPreview } from "./DiagramPreview";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg>diagram</svg>" }),
  },
}));

describe("DiagramPreview", () => {
  it("shows empty state when content is empty string", () => {
    render(<DiagramPreview content="" />);
    expect(screen.getByText(/No diagram generated yet/i)).toBeInTheDocument();
    expect(screen.getByText("Generate All")).toBeInTheDocument();
  });

  it("renders the raw source details section when content is provided", () => {
    render(<DiagramPreview content="graph TD\nA-->B" />);
    expect(screen.getByText(/View raw Mermaid source/i)).toBeInTheDocument();
  });

  it("shows raw content in the pre element", () => {
    const content = "graph TD\nA-->B";
    const { container } = render(<DiagramPreview content={content} />);
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toBe(content);
  });

  it("extracts mermaid code from markdown fences for rendering", () => {
    const fenced = "```mermaid\ngraph TD\nA-->B\n```";
    render(<DiagramPreview content={fenced} />);
    expect(screen.getByText(/View raw Mermaid source/i)).toBeInTheDocument();
  });
});
