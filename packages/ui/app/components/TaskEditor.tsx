import { useState, useEffect, useRef } from "react";
import {
  Button,
  ComboBox,
  TextField,
  Label,
  Input,
  TextArea,
  Select,
  SelectValue,
  Popover,
  ListBox,
  ListBoxItem,
} from "react-aria-components";

const STATUSES = ["todo", "wip", "done", "archive"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;

const PRIORITY_LABEL: Record<string, string> = {
  high: "P1",
  medium: "P2",
  low: "P3",
};

const PRIORITY_COLOR: Record<string, { color: string; background: string }> = {
  high:   { color: "var(--color-p1)", background: "var(--color-p1-bg)" },
  medium: { color: "var(--color-p2)", background: "var(--color-p2-bg)" },
  low:    { color: "var(--color-p3)", background: "var(--color-p3-bg)" },
};

const STATUS_COLOR: Record<string, string> = {
  todo: "var(--color-todo)",
  wip: "var(--color-wip)",
  done: "var(--color-done)",
  archive: "var(--color-archive)",
};

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dependencies: string[];
  linked_status: string[];
  notes?: string;
  created?: string;
  updated?: string;
}

interface StatusOption {
  id: string;
  text: string;
  evaluation: string;
  list: "short_term" | "long_term";
}

interface Props {
  task: Task;
  allTasks: { id: string; title: string }[];
  statusItems: StatusOption[];
  onUpdate: (updated: Task) => void;
  onDelete: () => void;
}

function DepsComboBox({
  selected,
  options,
  onChange,
}: {
  selected: string[];
  options: { id: string; title: string }[];
  onChange: (ids: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  // Exclude already-selected items; apply text filter
  const filteredOptions = options.filter(
    (o) =>
      !selected.includes(o.id) &&
      (o.id.toLowerCase().includes(inputValue.toLowerCase()) ||
        o.title.toLowerCase().includes(inputValue.toLowerCase())),
  );

  return (
    <div className="deps-combobox">
      <ComboBox
        inputValue={inputValue}
        onInputChange={setInputValue}
        selectedKey={null}
        onSelectionChange={(key) => {
          if (key) {
            onChange([...selected, key as string]);
            setInputValue("");
          }
        }}
        allowsCustomValue
        aria-label="Add dependency"
      >
        <div className="deps-input-row">
          <Input className="field-input" placeholder="Search tasks…" />
          <Button className="select-btn">
            <span aria-hidden className="select-arrow">
              ▼
            </span>
          </Button>
        </div>
        <Popover className="select-popover">
          <ListBox className="select-listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(({ id, title }) => (
                <ListBoxItem key={id} id={id} className="select-item">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.85em",
                    }}
                  >
                    {id}
                  </span>
                  {title && (
                    <span
                      style={{
                        color: "var(--color-text-muted)",
                        marginLeft: "0.4em",
                      }}
                    >
                      — {title}
                    </span>
                  )}
                </ListBoxItem>
              ))
            ) : (
              <ListBoxItem
                isDisabled
                id="_none"
                className="select-item"
                style={{ color: "var(--color-text-faint)" }}
              >
                {inputValue ? "No matches" : "No other tasks"}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
      {selected.length > 0 && (
        <div className="deps-tags">
          {selected.map((id) => {
            const task = options.find((o) => o.id === id);
            return (
              <span key={id} className="dep-tag" title={task?.title}>
                {id}
                <button
                  className="dep-tag-remove"
                  onClick={() => onChange(selected.filter((s) => s !== id))}
                  aria-label={`Remove ${id}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LinkedStatusComboBox({
  selected,
  options,
  onChange,
}: {
  selected: string[];
  options: StatusOption[];
  onChange: (ids: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const filteredOptions = options.filter(
    (o) =>
      !selected.includes(o.id) &&
      (o.id.toLowerCase().includes(inputValue.toLowerCase()) ||
        o.text.toLowerCase().includes(inputValue.toLowerCase())),
  );

  return (
    <div className="deps-combobox">
      <ComboBox
        inputValue={inputValue}
        onInputChange={setInputValue}
        selectedKey={null}
        onSelectionChange={(key) => {
          if (key) {
            onChange([...selected, key as string]);
            setInputValue("");
          }
        }}
        allowsCustomValue
        aria-label="Link status"
      >
        <div className="deps-input-row">
          <Input className="field-input" placeholder="Search status items…" />
          <Button className="select-btn">
            <span aria-hidden className="select-arrow">
              ▼
            </span>
          </Button>
        </div>
        <Popover className="select-popover">
          <ListBox className="select-listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(({ id, text, list }) => (
                <ListBoxItem key={id} id={id} className="select-item">
                  <span style={{ fontSize: "0.8em", marginRight: "0.3em" }}>
                    {list === "short_term" ? "📋" : "🔭"}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.85em",
                    }}
                  >
                    {id}
                  </span>
                  {text && (
                    <span
                      style={{
                        color: "var(--color-text-muted)",
                        marginLeft: "0.4em",
                      }}
                    >
                      — {text}
                    </span>
                  )}
                </ListBoxItem>
              ))
            ) : (
              <ListBoxItem
                isDisabled
                id="_none"
                className="select-item"
                style={{ color: "var(--color-text-faint)" }}
              >
                {inputValue ? "No matches" : "No status items"}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
      {selected.length > 0 && (
        <div className="deps-tags">
          {selected.map((id) => {
            const item = options.find((o) => o.id === id);
            return (
              <span key={id} className="dep-tag" title={item?.text}>
                {item?.list === "short_term" ? "📋" : "🔭"} {id}
                <button
                  className="dep-tag-remove"
                  onClick={() => onChange(selected.filter((s) => s !== id))}
                  aria-label={`Remove ${id}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EnumSelect<T extends string>({
  label,
  value,
  options,
  renderOption,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  renderOption: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <Select selectedKey={value} onSelectionChange={(key) => onChange(key as T)}>
      <Label className="field-label">{label}</Label>
      <Button className="select-btn">
        <SelectValue />
        <span aria-hidden className="select-arrow">
          ▼
        </span>
      </Button>
      <Popover className="select-popover">
        <ListBox className="select-listbox">
          {options.map((opt) => (
            <ListBoxItem key={opt} id={opt} className="select-item">
              {renderOption(opt)}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

export function TaskEditor({ task, allTasks, statusItems, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDescription, setLocalDescription] = useState(task.description || "");
  const [localNotes, setLocalNotes] = useState(task.notes || "");
  const taskIdRef = useRef(task.id);

  useEffect(() => {
    if (task.id !== taskIdRef.current) {
      taskIdRef.current = task.id;
      setLocalTitle(task.title);
      setLocalDescription(task.description || "");
      setLocalNotes(task.notes || "");
    }
  }, [task.id]);

  const update = (field: keyof Task, value: any) => {
    onUpdate({
      ...task,
      [field]: value,
      updated: new Date().toISOString().split("T")[0],
    });
  };

  const otherTasks = allTasks.filter((t) => t.id !== task.id);

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        marginBottom: "0.4rem",
        overflow: "clip",
        background: "var(--color-surface)",
      }}
    >
      <Button
        onPress={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "0.5rem 0.75rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flex: 1,
            minWidth: 0,
          }}
        >
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
              fontSize: "0.7em",
              fontWeight: 600,
              borderRadius: "var(--radius-md)",
              padding: "0.1em 0.35em",
              flexShrink: 0,
              fontFamily: "var(--font-mono)",
              ...PRIORITY_COLOR[task.priority],
            }}
          >
            {PRIORITY_LABEL[task.priority] ?? task.priority}
          </span>
          <span
            style={{
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title || (
              <em style={{ color: "var(--color-text-faint)" }}>
                Untitled task
              </em>
            )}
          </span>
          {(task.linked_status?.length ?? 0) > 0 && (
            <span
              style={{
                fontSize: "0.7em",
                color: "var(--color-text-muted)",
                background: "var(--color-bg)",
                borderRadius: "var(--radius-md)",
                padding: "0.1em 0.35em",
              }}
              title={`Linked to ${task.linked_status.length} status item(s)`}
            >
              🔗 {task.linked_status.length}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexShrink: 0,
          }}
        >
          <span className="id-chip">{task.id}</span>
          <span style={{ color: "var(--color-text-faint)", fontSize: "0.8em" }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </Button>

      {expanded && (
        <div
          style={{
            padding: "0.75rem",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-bg)",
          }}
        >
          <TextField
            className="field"
            value={localTitle}
            onChange={setLocalTitle}
          >
            <Label className="field-label">Title</Label>
            <Input className="field-input" placeholder="Task title" onBlur={() => update("title", localTitle)} />
          </TextField>

          <TextField
            className="field"
            value={localDescription}
            onChange={setLocalDescription}
          >
            <Label className="field-label">Description</Label>
            <TextArea
              className="field-textarea"
              placeholder="Optional description"
              style={{ minHeight: 60 }}
              onBlur={() => update("description", localDescription)}
            />
          </TextField>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              marginBottom: "0.5rem",
            }}
          >
            <EnumSelect
              label="Status"
              value={task.status as any}
              options={STATUSES}
              renderOption={(s) => s}
              onChange={(v) => update("status", v)}
            />
            <EnumSelect
              label="Priority"
              value={task.priority as any}
              options={PRIORITIES}
              renderOption={(p) => `${PRIORITY_LABEL[p] ?? p} – ${p}`}
              onChange={(v) => update("priority", v)}
            />
          </div>

          <div className="field">
            <span className="field-label">Dependencies</span>
            <DepsComboBox
              selected={task.dependencies}
              options={otherTasks}
              onChange={(deps) => update("dependencies", deps)}
            />
          </div>

          <div className="field">
            <span className="field-label">Linked Status</span>
            <LinkedStatusComboBox
              selected={task.linked_status || []}
              options={statusItems}
              onChange={(ids) => update("linked_status", ids)}
            />
          </div>

          <TextField
            className="field"
            value={localNotes}
            onChange={setLocalNotes}
          >
            <Label className="field-label">Notes</Label>
            <TextArea
              className="field-textarea"
              placeholder="Notes, links, blockers..."
              style={{ minHeight: 50 }}
              onBlur={() => update("notes", localNotes)}
            />
          </TextField>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "0.25rem",
            }}
          >
            <Button className="btn btn-danger" onPress={onDelete}>
              🗑 Remove task
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
