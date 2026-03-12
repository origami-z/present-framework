import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TaskEditor } from "./TaskEditor";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dependencies: string[];
  linked_goal: string[];
  notes?: string;
  created?: string;
  updated?: string;
}

const baseTask: Task = {
  id: "pillar-001",
  title: "My Task",
  description: "A description",
  status: "todo",
  priority: "medium",
  dependencies: [],
  linked_goal: [],
  notes: "",
  created: "2024-01-01",
  updated: "2024-01-01",
};

const noOtherTasks: { id: string; title: string }[] = [];
const otherTasksList = [
  { id: "pillar-001", title: "My Task" },
  { id: "pillar-002", title: "Second Task" },
  { id: "pillar-003", title: "Third Task" },
];

const noStatusItems: {
  id: string;
  text: string;
  evaluation: string;
  list: "short_term" | "long_term";
}[] = [];
const sampleStatusItems: {
  id: string;
  text: string;
  evaluation: string;
  list: "short_term" | "long_term";
}[] = [
  { id: "infra-stg-001", text: "Running on bare metal", evaluation: "at_risk", list: "short_term" },
  { id: "infra-ltg-001", text: "Fully on Kubernetes", evaluation: "on_track", list: "long_term" },
];

/** Stateful wrapper so controlled inputs work correctly in tests. */
function StatefulEditor({
  task: initialTask,
  allTasks,
  statusItems,
  onUpdate,
  onDelete,
}: {
  task: Task;
  allTasks: { id: string; title: string }[];
  statusItems?: {
    id: string;
    text: string;
    evaluation: string;
    list: "short_term" | "long_term";
  }[];
  onUpdate?: (t: Task) => void;
  onDelete?: () => void;
}) {
  const [task, setTask] = useState(initialTask);
  return (
    <TaskEditor
      task={task}
      allTasks={allTasks}
      statusItems={statusItems ?? noStatusItems}
      onUpdate={(t) => {
        setTask(t);
        onUpdate?.(t);
      }}
      onDelete={onDelete ?? vi.fn()}
    />
  );
}

describe("TaskEditor", () => {
  it("renders the task title in collapsed state", () => {
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} />);
    expect(screen.getByText("My Task")).toBeInTheDocument();
  });

  it("shows task id chip in collapsed state", () => {
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} />);
    expect(screen.getByText("pillar-001")).toBeInTheDocument();
  });

  it('shows "Untitled task" placeholder when title is empty', () => {
    render(<StatefulEditor task={{ ...baseTask, title: "" }} allTasks={noOtherTasks} />);
    expect(screen.getByText("Untitled task")).toBeInTheDocument();
  });

  it("expands to show form fields when header is clicked", async () => {
    const user = userEvent.setup();
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} />);

    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /My Task/i }));

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
  });

  it("links start and end date labels to date inputs", async () => {
    const user = userEvent.setup();
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} />);

    await user.click(screen.getByRole("button", { name: /My Task/i }));

    expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
    expect(screen.getByLabelText("End Date")).toBeInTheDocument();
  });

  it("calls onUpdate with updated title when title field changes", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} onUpdate={onUpdate} />);

    await user.click(screen.getByRole("button", { name: /My Task/i }));

    const titleInput = screen.getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");
    await user.tab(); // blur triggers onUpdate

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall.title).toBe("New Title");
  });

  it("calls onDelete when Remove task button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: /My Task/i }));
    await user.click(screen.getByRole("button", { name: /Remove task/i }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renders the dependency combobox input when expanded", async () => {
    const user = userEvent.setup();
    render(<StatefulEditor task={baseTask} allTasks={otherTasksList} />);

    await user.click(screen.getByRole("button", { name: /My Task/i }));

    expect(screen.getByRole("combobox", { name: /Add dependency/i })).toBeInTheDocument();
  });

  it("renders existing dependency as a removable tag", async () => {
    const user = userEvent.setup();
    const taskWithDep = { ...baseTask, dependencies: ["pillar-002"] };
    render(<StatefulEditor task={taskWithDep} allTasks={otherTasksList} />);

    await user.click(screen.getByRole("button", { name: /My Task/i }));

    // The existing dependency appears as a tag chip
    expect(screen.getByText("pillar-002")).toBeInTheDocument();
    // And has a remove button
    expect(screen.getByRole("button", { name: /Remove pillar-002/i })).toBeInTheDocument();
  });

  it("removes a dependency tag when the remove button is clicked", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const taskWithDep = { ...baseTask, dependencies: ["pillar-002"] };
    render(<StatefulEditor task={taskWithDep} allTasks={otherTasksList} onUpdate={onUpdate} />);

    await user.click(screen.getByRole("button", { name: /My Task/i }));
    await user.click(screen.getByRole("button", { name: /Remove pillar-002/i }));

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall.dependencies).toEqual([]);
  });

  it("renders the linked goal combobox when expanded", async () => {
    const user = userEvent.setup();
    render(
      <StatefulEditor task={baseTask} allTasks={noOtherTasks} statusItems={sampleStatusItems} />,
    );

    await user.click(screen.getByRole("button", { name: /My Task/i }));

    expect(screen.getByRole("combobox", { name: /Link goal/i })).toBeInTheDocument();
  });

  it("renders existing linked goal in the combobox input", async () => {
    const user = userEvent.setup();
    const taskWithLinked = { ...baseTask, linked_goal: ["infra-stg-001"] };
    render(
      <StatefulEditor
        task={taskWithLinked}
        allTasks={noOtherTasks}
        statusItems={sampleStatusItems}
      />,
    );

    await user.click(screen.getByRole("button", { name: /My Task/i }));

    expect(screen.getByRole("combobox", { name: /Link goal/i })).toHaveValue("infra-stg-001");
  });

  it("shows selected linked goal option when one is already linked", async () => {
    const user = userEvent.setup();
    const taskWithLinked = { ...baseTask, linked_goal: ["infra-stg-001"] };
    render(
      <StatefulEditor
        task={taskWithLinked}
        allTasks={noOtherTasks}
        statusItems={sampleStatusItems}
      />,
    );

    await user.click(screen.getByRole("button", { name: /My Task/i }));
    const linkedGoalInput = screen.getByRole("combobox", { name: /Link goal/i });
    await user.click(linkedGoalInput);
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("option", { name: /infra-stg-001/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /infra-ltg-001/i })).not.toBeInTheDocument();
  });

  it("shows linked status count badge in collapsed state when task has linked statuses", () => {
    const taskWithLinked = { ...baseTask, linked_goal: ["infra-stg-001", "infra-ts-001"] };
    render(
      <StatefulEditor
        task={taskWithLinked}
        allTasks={noOtherTasks}
        statusItems={sampleStatusItems}
      />,
    );

    expect(screen.getByText("🔗 2")).toBeInTheDocument();
  });

  it("keeps linked goal selection after combobox input blur", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <StatefulEditor
        task={baseTask}
        allTasks={noOtherTasks}
        statusItems={sampleStatusItems}
        onUpdate={onUpdate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /My Task/i }));

    const linkedGoalInput = screen.getByRole("combobox", { name: /Link goal/i });
    await user.click(linkedGoalInput);
    await user.click(screen.getByText("infra-stg-001"));

    await user.tab();

    expect(screen.getByText("🔗 1")).toBeInTheDocument();
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall.linked_goal).toEqual(["infra-stg-001"]);
  });
});
