import { useState, useEffect, useRef } from "react";
import {
  Button,
  TextField,
  Input,
  TextArea,
  Select,
  SelectValue,
  Label,
  Popover,
  ListBox,
  ListBoxItem,
} from "react-aria-components";
import { TaskEditor } from "./TaskEditor";

const STATUS_COLOR: Record<string, string> = {
  todo: "var(--color-todo)",
  wip: "var(--color-wip)",
  done: "var(--color-done)",
  archive: "var(--color-archive)",
};

const EVALUATIONS = [
  "not_started",
  "on_track",
  "needs_attention",
  "at_risk",
  "blocked",
  "exceeds",
] as const;

const EVAL_EMOJI: Record<string, string> = {
  not_started: "⬜",
  on_track: "🟢",
  needs_attention: "🟡",
  at_risk: "🔴",
  blocked: "⛔",
  exceeds: "⭐",
};

interface StatusItem {
  id: string;
  text: string;
  evaluation: string;
  start_date?: string;
  end_date?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dependencies: string[];
  linked_goal: string[];
  description?: string;
  notes?: string;
  created?: string;
  updated?: string;
  start_date?: string;
  end_date?: string;
}

interface Pillar {
  id: string;
  name: string;
  description?: string;
  short_term_goal: StatusItem[];
  long_term_goal: StatusItem[];
  tasks: Task[];
}

interface Props {
  pillars: Pillar[];
  onUpdate: (pillars: Pillar[]) => void;
}

function generateId(prefix: string, existing: string[]) {
  let i = 1;
  while (existing.includes(`${prefix}-${String(i).padStart(3, "0")}`)) i++;
  return `${prefix}-${String(i).padStart(3, "0")}`;
}

function allTasks(pillars: Pillar[]) {
  return pillars.flatMap((p) => p.tasks.map((t) => ({ id: t.id, title: t.title })));
}

function allStatusIdsForPillar(pillar: Pillar): string[] {
  return [
    ...(pillar.short_term_goal || []).map((s) => s.id),
    ...(pillar.long_term_goal || []).map((s) => s.id),
  ];
}

function StatusBulletItemRow({
  item,
  idx,
  moveLabel,
  allIds,
  onUpdate,
  onRemove,
  onMove,
  onRenameId,
}: {
  item: StatusItem;
  idx: number;
  moveLabel: string;
  allIds: string[];
  onUpdate: (idx: number, partial: Partial<StatusItem>) => void;
  onRemove: (idx: number) => void;
  onMove: (idx: number) => void;
  onRenameId: (idx: number, oldId: string, newId: string) => void;
}) {
  const [localText, setLocalText] = useState(item.text);
  const [editingId, setEditingId] = useState(false);
  const [idDraft, setIdDraft] = useState(item.id);
  const [idError, setIdError] = useState<string | null>(null);
  const justCommittedRef = useRef(false);
  const idInputRef = useRef<HTMLInputElement>(null);
  const dateFieldIdBase = `goal-dates-${item.id}-${idx}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const startDateInputId = `${dateFieldIdBase}-start`;
  const endDateInputId = `${dateFieldIdBase}-end`;

  useEffect(() => {
    setLocalText(item.text);
  }, [item.id]);

  useEffect(() => {
    setIdDraft(item.id);
  }, [item.id]);

  const handleCommit = () => {
    const newId = idDraft.trim();
    if (newId === item.id) {
      justCommittedRef.current = true;
      setEditingId(false);
      setIdError(null);
      return;
    }
    if (!newId) {
      setIdError("ID cannot be empty");
      return;
    }
    const otherIds = allIds.filter((id) => id !== item.id);
    if (otherIds.includes(newId)) {
      setIdError(`"${newId}" already exists`);
      return;
    }
    justCommittedRef.current = true;
    setIdError(null);
    setEditingId(false);
    onRenameId(idx, item.id, newId);
  };

  const handleBlur = () => {
    if (justCommittedRef.current) {
      justCommittedRef.current = false;
      return;
    }
    const newId = idDraft.trim();
    if (newId === item.id) {
      setIdError(null);
      setEditingId(false);
      return;
    }
    if (!newId) {
      setIdError("ID cannot be empty");
      setTimeout(() => idInputRef.current?.focus(), 0);
      return;
    }
    const otherIds = allIds.filter((id) => id !== item.id);
    if (otherIds.includes(newId)) {
      setIdError(`"${newId}" already exists`);
      setTimeout(() => idInputRef.current?.focus(), 0);
      return;
    }
    // Valid new ID → commit
    setIdError(null);
    setEditingId(false);
    onRenameId(idx, item.id, newId);
  };

  const cancelIdEdit = () => {
    justCommittedRef.current = true;
    setIdDraft(item.id);
    setIdError(null);
    setEditingId(false);
  };

  return (
    <div style={{ marginBottom: "0.35rem" }}>
      <div style={statusItemRow}>
        <Select
          selectedKey={item.evaluation || "not_started"}
          onSelectionChange={(key) => onUpdate(idx, { evaluation: key as string })}
          aria-label={`Evaluation for ${item.id}`}
        >
          <Button className="eval-btn" style={evalBtnStyle}>
            <SelectValue>{EVAL_EMOJI[item.evaluation] || "⬜"}</SelectValue>
          </Button>
          <Popover className="select-popover">
            <ListBox className="select-listbox">
              {EVALUATIONS.map((e) => (
                <ListBoxItem key={e} id={e} className="select-item">
                  {EVAL_EMOJI[e]} {e}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
        <TextField
          value={localText}
          onChange={setLocalText}
          style={{ flex: 1 }}
          aria-label={`Goal text for ${item.id}`}
        >
          <Input
            className="field-input-inline"
            placeholder="Goal bullet point..."
            onBlur={() => onUpdate(idx, { text: localText })}
          />
        </TextField>
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {editingId ? (
            <>
              <input
                ref={idInputRef}
                className={`goal-id-edit-input${idError ? " error" : ""}`}
                value={idDraft}
                onChange={(e) => {
                  setIdDraft(e.target.value);
                  setIdError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCommit();
                  }
                  if (e.key === "Escape") cancelIdEdit();
                }}
                // Keep the input width snug to its content
                style={{ width: `${item.id.length + 2}ch` }}
                onBlur={handleBlur}
                autoFocus
                aria-label="Rename goal ID"
              />
              {idError && <span className="goal-id-error">{idError}</span>}
            </>
          ) : (
            <span
              className="goal-id-label"
              onDoubleClick={() => {
                setIdDraft(item.id);
                setIdError(null);
                setEditingId(true);
              }}
              title="Double-click to rename"
            >
              {item.id}
            </span>
          )}
        </div>
        <Button
          className="btn btn-icon"
          onPress={() => onMove(idx)}
          aria-label={`Move to ${moveLabel}`}
          style={{ fontSize: "0.75em", padding: "0 0.3rem" }}
        >
          {moveLabel === "Long-term" ? "→" : "←"}
        </Button>
        <Button
          className="btn btn-icon"
          onPress={() => onRemove(idx)}
          aria-label={`Remove ${item.id}`}
          style={{ fontSize: "0.75em", padding: "0 0.3rem" }}
        >
          ×
        </Button>
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.35rem",
          marginLeft: "2rem",
          marginTop: "0.15rem",
          alignItems: "center",
        }}
      >
        <label
          htmlFor={startDateInputId}
          style={{ fontSize: "0.7em", color: "var(--color-text-faint)" }}
        >
          Start
        </label>
        <input
          id={startDateInputId}
          type="date"
          className="field-input-inline"
          style={{ width: "auto", fontSize: "0.75em", padding: "1px 4px" }}
          value={item.start_date || ""}
          onChange={(e) => onUpdate(idx, { start_date: e.target.value || undefined })}
        />
        <label
          htmlFor={endDateInputId}
          style={{
            fontSize: "0.7em",
            color: "var(--color-text-faint)",
            marginLeft: "0.25rem",
          }}
        >
          End
        </label>
        <input
          id={endDateInputId}
          type="date"
          className="field-input-inline"
          style={{ width: "auto", fontSize: "0.75em", padding: "1px 4px" }}
          value={item.end_date || ""}
          onChange={(e) => onUpdate(idx, { end_date: e.target.value || undefined })}
        />
        {(item.start_date || item.end_date) && (
          <Button
            className="btn btn-icon"
            onPress={() => onUpdate(idx, { start_date: undefined, end_date: undefined })}
            aria-label="Clear dates"
            style={{ fontSize: "0.7em", padding: "0 0.2rem" }}
          >
            ×
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBulletList({
  label,
  moveLabel,
  items,
  pillarId,
  idPrefix,
  allIds,
  onUpdate,
  onMove,
  onRenameId,
}: {
  label: string;
  moveLabel: string;
  items: StatusItem[];
  pillarId: string;
  idPrefix: string;
  allIds: string[];
  onUpdate: (items: StatusItem[]) => void;
  onMove: (item: StatusItem, updatedSourceItems: StatusItem[]) => void;
  onRenameId: (oldId: string, newId: string) => void;
}) {
  const addItem = () => {
    const id = generateId(`${pillarId}-${idPrefix}`, allIds);
    onUpdate([...items, { id, text: "", evaluation: "not_started" }]);
  };

  const updateItem = (idx: number, partial: Partial<StatusItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...partial };
    onUpdate(next);
  };

  const removeItem = (idx: number) => {
    onUpdate(items.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number) => {
    const item = items[idx];
    const updatedSourceItems = items.filter((_, i) => i !== idx);
    onMove(item, updatedSourceItems);
  };

  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.25rem",
        }}
      >
        <span className="field-label" style={{ marginBottom: 0 }}>
          {label}
        </span>
        <Button
          className="btn btn-secondary"
          onPress={addItem}
          style={{ fontSize: "0.75em", padding: "0.2rem 0.5rem" }}
        >
          Add
        </Button>
      </div>
      {items.map((item, idx) => (
        <StatusBulletItemRow
          key={item.id}
          item={item}
          idx={idx}
          moveLabel={moveLabel}
          allIds={allIds}
          onUpdate={updateItem}
          onRemove={removeItem}
          onMove={moveItem}
          onRenameId={(_, oldId, newId) => onRenameId(oldId, newId)}
        />
      ))}
    </div>
  );
}

export function PillarList({ pillars, onUpdate }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newPillarName, setNewPillarName] = useState("");
  const [addingPillar, setAddingPillar] = useState(false);
  const [localDescriptions, setLocalDescriptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(pillars.map((p) => [p.id, p.description || ""])),
  );
  const [reorderMode, setReorderMode] = useState<Record<string, boolean>>({});
  const dragIdx = useRef<number | null>(null);

  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const updatePillar = (idx: number, updated: Pillar) => {
    const next = [...pillars];
    next[idx] = updated;
    onUpdate(next);
  };

  const removePillar = (idx: number) => {
    if (!confirm(`Remove pillar "${pillars[idx].name}" and all its tasks?`)) return;
    onUpdate(pillars.filter((_, i) => i !== idx));
  };

  const addTask = (pillarIdx: number) => {
    const pillar = pillars[pillarIdx];
    const existing = allTasks(pillars).map((t) => t.id);
    const prefix = pillar.id.slice(0, 8);
    const id = generateId(prefix, existing);
    const date = new Date().toISOString().split("T")[0];
    const newTask: Task = {
      id,
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      dependencies: [],
      linked_goal: [],
      notes: "",
      created: date,
      updated: date,
    };
    updatePillar(pillarIdx, { ...pillar, tasks: [...pillar.tasks, newTask] });
  };

  const addPillar = () => {
    if (!newPillarName.trim()) return;
    const name = newPillarName.trim();
    const id = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 16);
    const existingIds = pillars.map((p) => p.id);
    let finalId = id;
    let i = 2;
    while (existingIds.includes(finalId)) finalId = `${id}-${i++}`;
    onUpdate([
      ...pillars,
      {
        id: finalId,
        name,
        description: "",
        short_term_goal: [],
        long_term_goal: [],
        tasks: [],
      },
    ]);
    setNewPillarName("");
    setAddingPillar(false);
  };

  const handleRenameGoalId = (pillarIdx: number, oldId: string, newId: string) => {
    const pillar = pillars[pillarIdx];
    const renameInList = (items: StatusItem[]) =>
      items.map((item) => (item.id === oldId ? { ...item, id: newId } : item));
    const updatedTasks = pillar.tasks.map((task) => ({
      ...task,
      linked_goal: task.linked_goal.map((id: string) => (id === oldId ? newId : id)),
    }));
    updatePillar(pillarIdx, {
      ...pillar,
      short_term_goal: renameInList(pillar.short_term_goal || []),
      long_term_goal: renameInList(pillar.long_term_goal || []),
      tasks: updatedTasks,
    });
  };

  const all = allTasks(pillars);

  return (
    <div>
      {pillars.map((pillar, idx) => {
        const isCollapsed = collapsed[pillar.id];
        const stats = {
          done: pillar.tasks.filter((t) => t.status === "done").length,
          wip: pillar.tasks.filter((t) => t.status === "wip").length,
          todo: pillar.tasks.filter((t) => t.status === "todo").length,
        };
        const statusIds = allStatusIdsForPillar(pillar);
        const statusItems = [
          ...(pillar.short_term_goal || []).map((s) => ({
            ...s,
            list: "short_term" as const,
          })),
          ...(pillar.long_term_goal || []).map((s) => ({
            ...s,
            list: "long_term" as const,
          })),
        ];

        return (
          <div key={pillar.id} style={pillarCard}>
            <div style={pillarHeaderRow}>
              <Button
                onPress={() => toggle(pillar.id)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  padding: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95em" }}>{pillar.name}</span>
                  <span className="pillar-id-badge">{pillar.id}</span>
                  <span
                    style={{
                      color: "var(--color-text-faint)",
                      fontSize: "0.8em",
                      marginLeft: "0.5rem",
                    }}
                  >
                    {isCollapsed ? "▶" : "▼"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.75em",
                    color: "var(--color-text-muted)",
                    marginTop: "0.2rem",
                  }}
                >
                  ✅ {stats.done} &nbsp; 🔵 {stats.wip} &nbsp; 📋 {stats.todo}
                  {pillar.description && (
                    <span style={{ marginLeft: "0.75rem", fontStyle: "italic" }}>
                      {pillar.description}
                    </span>
                  )}
                </div>
              </Button>
              <Button
                className="btn btn-icon"
                onPress={() => removePillar(idx)}
                aria-label={`Remove pillar ${pillar.name}`}
              >
                🗑
              </Button>
            </div>

            {!isCollapsed && (
              <div style={{ padding: "0.5rem 0.75rem" }}>
                <TextField
                  value={localDescriptions[pillar.id] ?? ""}
                  onChange={(v) =>
                    setLocalDescriptions((prev) => ({
                      ...prev,
                      [pillar.id]: v,
                    }))
                  }
                  aria-label={`Pillar description for ${pillar.name}`}
                >
                  <TextArea
                    className="field-input-inline"
                    placeholder="Pillar description (optional)"
                    rows={3}
                    style={{ marginBottom: "0.5rem", resize: "vertical" }}
                    onBlur={() =>
                      updatePillar(idx, {
                        ...pillar,
                        description: localDescriptions[pillar.id] ?? "",
                      })
                    }
                  />
                </TextField>

                <StatusBulletList
                  label="📋 Short-term Goals"
                  moveLabel="Long-term"
                  items={pillar.short_term_goal || []}
                  pillarId={pillar.id}
                  idPrefix="stg"
                  allIds={statusIds}
                  onUpdate={(items) => updatePillar(idx, { ...pillar, short_term_goal: items })}
                  onMove={(item, updatedSourceItems) =>
                    updatePillar(idx, {
                      ...pillar,
                      short_term_goal: updatedSourceItems,
                      long_term_goal: [...(pillar.long_term_goal || []), item],
                    })
                  }
                  onRenameId={(oldId, newId) => handleRenameGoalId(idx, oldId, newId)}
                />

                <StatusBulletList
                  label="🔭 Long-term Goals"
                  moveLabel="Short-term"
                  items={pillar.long_term_goal || []}
                  pillarId={pillar.id}
                  idPrefix="ltg"
                  allIds={statusIds}
                  onUpdate={(items) => updatePillar(idx, { ...pillar, long_term_goal: items })}
                  onMove={(item, updatedSourceItems) =>
                    updatePillar(idx, {
                      ...pillar,
                      long_term_goal: updatedSourceItems,
                      short_term_goal: [...(pillar.short_term_goal || []), item],
                    })
                  }
                  onRenameId={(oldId, newId) => handleRenameGoalId(idx, oldId, newId)}
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span className="field-label" style={{ marginBottom: 0 }}>
                    Tasks
                  </span>
                  <Button
                    className={`btn ${reorderMode[pillar.id] ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.75em", padding: "0.15em 0.5em" }}
                    onPress={() =>
                      setReorderMode((prev) => ({
                        ...prev,
                        [pillar.id]: !prev[pillar.id],
                      }))
                    }
                  >
                    {reorderMode[pillar.id] ? "Done" : "Reorder"}
                  </Button>
                </div>

                {reorderMode[pillar.id]
                  ? pillar.tasks.map((task, tIdx) => (
                      <button
                        key={task.id}
                        type="button"
                        draggable
                        onDragStart={() => {
                          dragIdx.current = tIdx;
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIdx.current === null || dragIdx.current === tIdx) return;
                          const tasks = [...pillar.tasks];
                          const [moved] = tasks.splice(dragIdx.current, 1);
                          tasks.splice(tIdx, 0, moved);
                          dragIdx.current = tIdx;
                          updatePillar(idx, { ...pillar, tasks });
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.5rem 0.75rem",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-md)",
                          marginBottom: "0.4rem",
                          background: "var(--color-surface)",
                          cursor: "grab",
                          width: "100%",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--color-text-faint)",
                            fontSize: "1.1em",
                            lineHeight: 1,
                          }}
                        >
                          ⠿
                        </span>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: STATUS_COLOR[task.status] || "#999",
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            flex: 1,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {task.title || (
                            <em style={{ color: "var(--color-text-faint)" }}>Untitled task</em>
                          )}
                        </span>
                        <span className="id-chip">{task.id}</span>
                      </button>
                    ))
                  : pillar.tasks.map((task, tIdx) => (
                      <TaskEditor
                        key={task.id}
                        task={task}
                        allTasks={all}
                        statusItems={statusItems}
                        onUpdate={(updated) => {
                          const tasks = [...pillar.tasks];
                          tasks[tIdx] = updated;
                          updatePillar(idx, { ...pillar, tasks });
                        }}
                        onDelete={() => {
                          const tasks = pillar.tasks.filter((_, i) => i !== tIdx);
                          updatePillar(idx, { ...pillar, tasks });
                        }}
                      />
                    ))}

                <Button className="btn btn-add-task" onPress={() => addTask(idx)}>
                  + Add Task
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {addingPillar ? (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <TextField
            value={newPillarName}
            onChange={setNewPillarName}
            style={{ flex: 1 }}
            aria-label="New pillar name"
          >
            <Input
              className="field-input"
              placeholder="Pillar name (e.g. Security)"
              onKeyDown={(e) => {
                if (e.key === "Enter") addPillar();
                if (e.key === "Escape") setAddingPillar(false);
              }}
              autoFocus
            />
          </TextField>
          <Button className="btn btn-primary" onPress={addPillar}>
            Add
          </Button>
          <Button className="btn btn-secondary" onPress={() => setAddingPillar(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          className="btn btn-secondary"
          style={{ marginTop: "0.75rem", width: "100%" }}
          onPress={() => setAddingPillar(true)}
        >
          + Add Pillar
        </Button>
      )}
    </div>
  );
}

const pillarCard: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  marginBottom: "0.75rem",
  overflow: "clip",
  background: "var(--color-surface)",
};

const pillarHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: "0.75rem",
  background: "var(--color-bg)",
  borderBottom: "1px solid var(--color-border)",
  gap: "0.5rem",
};

const statusItemRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
  marginBottom: "0.25rem",
};

const statusBullet: React.CSSProperties = {
  fontSize: "0.9em",
  color: "var(--color-text-muted)",
  flexShrink: 0,
};

const evalBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  cursor: "pointer",
  padding: "0.15em 0.3em",
  fontSize: "0.85em",
  lineHeight: 1,
  flexShrink: 0,
};
