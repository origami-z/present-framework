import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportPreview } from "./ReportPreview";

describe("ReportPreview", () => {
  it("shows empty state when content is empty string", () => {
    render(<ReportPreview content="" />);
    expect(screen.getByText(/No report generated yet/i)).toBeInTheDocument();
    expect(screen.getByText("Generate All")).toBeInTheDocument();
  });

  it("renders a heading from markdown content", () => {
    render(<ReportPreview content={"# Hello\n\nSome **bold** text."} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders bold text from markdown content", () => {
    render(<ReportPreview content={"# Hello\n\nSome **bold** text."} />);
    // react-markdown wraps bold text in <strong>
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("does not show empty-state message when content is provided", () => {
    render(<ReportPreview content="Some report content" />);
    expect(screen.queryByText(/No report generated yet/i)).not.toBeInTheDocument();
  });
});
