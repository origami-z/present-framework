import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GanttPreview } from "./GanttPreview";

const pillars = [
  {
    id: "delivery",
    name: "Delivery",
    description: "",
    short_term_goal: [],
    long_term_goal: [],
    tasks: [
      {
        id: "task-todo",
        title: "Todo task",
        status: "todo",
        priority: "medium",
        dependencies: [],
        linked_goal: [],
        start_date: "2026-03-01",
        end_date: "2026-03-14",
      },
      {
        id: "task-done",
        title: "Done task",
        status: "done",
        priority: "medium",
        dependencies: [],
        linked_goal: [],
        start_date: "2026-03-02",
        end_date: "2026-03-08",
      },
      {
        id: "task-wip",
        title: "WIP task",
        status: "wip",
        priority: "medium",
        dependencies: [],
        linked_goal: [],
        start_date: "2026-03-05",
        end_date: "2026-03-18",
      },
    ],
  },
];

describe("GanttPreview", () => {
  it("renders a pillar strip with the pillar name", () => {
    render(<GanttPreview pillars={pillars} />);

    expect(screen.getByLabelText("Pillar Delivery")).toBeInTheDocument();
  });

  it("shows status filters in the toolbar", () => {
    render(<GanttPreview pillars={pillars} />);

    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "To do" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WIP" })).toBeInTheDocument();
  });

  it("toggles task visibility by status", async () => {
    const user = userEvent.setup();

    render(<GanttPreview pillars={pillars} />);

    expect(screen.getAllByText("Done task").length).toBeGreaterThan(0);
    expect(screen.getAllByText("WIP task").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByText("Done task")).not.toBeInTheDocument();
    expect(screen.getAllByText("WIP task").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Show all/i }));

    expect(screen.getAllByText("Done task").length).toBeGreaterThan(0);
  });
});
