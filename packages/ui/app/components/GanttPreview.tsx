import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Button } from "react-aria-components";

/* ── Types ────────────────────────────────────────────────────────────────── */

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

type ZoomLevel = "weekly" | "monthly" | "quarterly";

interface Props {
  pillars: Pillar[];
}

/* ── Pillar colors ────────────────────────────────────────────────────────── */

const PILLAR_COLORS = [
  { bar: "#3b82f6", barLight: "#dbeafe", text: "#1e40af" },
  { bar: "#8b5cf6", barLight: "#ede9fe", text: "#5b21b6" },
  { bar: "#06b6d4", barLight: "#cffafe", text: "#155e75" },
  { bar: "#f59e0b", barLight: "#fef3c7", text: "#92400e" },
  { bar: "#ef4444", barLight: "#fee2e2", text: "#991b1b" },
  { bar: "#10b981", barLight: "#d1fae5", text: "#065f46" },
  { bar: "#ec4899", barLight: "#fce7f3", text: "#9d174d" },
  { bar: "#6366f1", barLight: "#e0e7ff", text: "#3730a3" },
];

const STATUS_PATTERN: Record<string, string> = {
  done: "solid",
  wip: "solid",
  todo: "dashed",
  archive: "dotted",
};

const STATUS_OPACITY: Record<string, number> = {
  done: 0.5,
  wip: 1,
  todo: 0.7,
  archive: 0.35,
};

/* ── Date helpers ─────────────────────────────────────────────────────────── */

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay() + 1); // Monday
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatMonthShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" });
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function weekLabel(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${day}`;
}

function quarterLabel(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

/* ── Timeline generation ──────────────────────────────────────────────────── */

interface TimelineColumn {
  label: string;
  subLabel?: string;
  start: Date;
  end: Date;
}

function generateTimeline(minDate: Date, maxDate: Date, zoom: ZoomLevel): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  let cursor: Date;

  if (zoom === "weekly") {
    cursor = startOfWeek(minDate);
    while (cursor <= maxDate) {
      const end = addDays(cursor, 6);
      cols.push({ label: weekLabel(cursor), start: new Date(cursor), end });
      cursor = addDays(cursor, 7);
    }
  } else if (zoom === "monthly") {
    cursor = startOfMonth(minDate);
    while (cursor <= maxDate) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const end = addDays(nextMonth, -1);
      cols.push({
        label: formatMonthShort(cursor),
        subLabel: String(cursor.getFullYear()),
        start: new Date(cursor),
        end,
      });
      cursor = nextMonth;
    }
  } else {
    cursor = startOfQuarter(minDate);
    while (cursor <= maxDate) {
      const nextQ = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
      const end = addDays(nextQ, -1);
      cols.push({ label: quarterLabel(cursor), start: new Date(cursor), end });
      cursor = nextQ;
    }
  }

  return cols;
}

/* ── Column widths per zoom ───────────────────────────────────────────────── */

const COL_WIDTH: Record<ZoomLevel, number> = {
  weekly: 100,
  monthly: 140,
  quarterly: 180,
};

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 52;
const LABEL_WIDTH = 260;

/* ── Row data builder ─────────────────────────────────────────────────────── */

interface GanttRow {
  type: "pillar" | "goal" | "task";
  id: string;
  label: string;
  pillarIdx: number;
  startDate: Date | null;
  endDate: Date | null;
  status?: string;
  goalId?: string; // for tasks, which goal group they belong to
  indent: number;
}

function buildRows(
  pillars: Pillar[],
  collapsedGoals: Set<string>,
): { rows: GanttRow[]; minDate: Date; maxDate: Date } {
  const rows: GanttRow[] = [];
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  const updateRange = (d: Date | null) => {
    if (!d) return;
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  };

  pillars.forEach((pillar, pIdx) => {
    // Collect all goals
    const allGoals = [
      ...(pillar.short_term_goal || []).map((g) => ({ ...g, goalType: "short" as const })),
      ...(pillar.long_term_goal || []).map((g) => ({ ...g, goalType: "long" as const })),
    ];

    // Build a map of goalId -> tasks (each task placed under first matching goal only)
    const goalTaskMap = new Map<string, Task[]>();
    const unmappedTasks: Task[] = [];
    const placedTaskIds = new Set<string>();

    for (const task of pillar.tasks) {
      let mapped = false;
      for (const ls of task.linked_goal || []) {
        if (!placedTaskIds.has(task.id) && allGoals.some((g) => g.id === ls)) {
          if (!goalTaskMap.has(ls)) goalTaskMap.set(ls, []);
          goalTaskMap.get(ls)!.push(task);
          placedTaskIds.add(task.id);
          mapped = true;
          break;
        }
      }
      if (!mapped && !placedTaskIds.has(task.id)) {
        unmappedTasks.push(task);
      }
    }

    // Add goals as collapsible groups
    for (const goal of allGoals) {
      const gs = parseDate(goal.start_date);
      const ge = parseDate(goal.end_date);
      updateRange(gs);
      updateRange(ge);

      rows.push({
        type: "goal",
        id: goal.id,
        label: `${goal.goalType === "short" ? "ST" : "LT"}: ${goal.text || goal.id}`,
        pillarIdx: pIdx,
        startDate: gs,
        endDate: ge,
        indent: 0,
      });

      if (!collapsedGoals.has(goal.id)) {
        const tasks = goalTaskMap.get(goal.id) || [];
        for (const task of tasks) {
          const ts = parseDate(task.start_date);
          const te = parseDate(task.end_date);
          updateRange(ts);
          updateRange(te);

          rows.push({
            type: "task",
            id: task.id,
            label: task.title || task.id,
            pillarIdx: pIdx,
            startDate: ts,
            endDate: te,
            status: task.status,
            goalId: goal.id,
            indent: 1,
          });
        }
      }
    }

    // Unmapped tasks
    for (const task of unmappedTasks) {
      const ts = parseDate(task.start_date);
      const te = parseDate(task.end_date);
      updateRange(ts);
      updateRange(te);

      rows.push({
        type: "task",
        id: task.id,
        label: task.title || task.id,
        pillarIdx: pIdx,
        startDate: ts,
        endDate: te,
        status: task.status,
        indent: 0,
      });
    }
  });

  // Default range: 3 months centered on today
  const today = new Date();
  if (!minDate) minDate = addDays(today, -30);
  if (!maxDate) maxDate = addDays(today, 60);

  // Add padding
  minDate = addDays(minDate!, -14);
  maxDate = addDays(maxDate!, 14);

  return { rows, minDate: minDate!, maxDate: maxDate! };
}

/* ── Component ────────────────────────────────────────────────────────────── */

/* ── Filter rows ──────────────────────────────────────────────────────────── */

function filterRows(rows: GanttRow[], query: string): GanttRow[] {
  if (!query) return rows;
  const lower = query.toLowerCase();

  // First pass: find which rows directly match
  const directMatch = new Set<string>();
  for (const row of rows) {
    if (row.label.toLowerCase().includes(lower) || row.id.toLowerCase().includes(lower)) {
      directMatch.add(row.id);
    }
  }

  // Second pass: if a child task matches, include its parent goal
  const goalIdsToKeep = new Set<string>();
  for (const row of rows) {
    if (row.type === "task" && row.goalId && directMatch.has(row.id)) {
      goalIdsToKeep.add(row.goalId);
    }
  }

  // Third pass: if a goal matches directly, include all its child tasks
  const goalsMatchedDirectly = new Set<string>();
  for (const row of rows) {
    if (row.type === "goal" && directMatch.has(row.id)) {
      goalsMatchedDirectly.add(row.id);
    }
  }

  return rows.filter((row) => {
    if (directMatch.has(row.id)) return true;
    // Keep goal if any child matched
    if (row.type === "goal" && goalIdsToKeep.has(row.id)) return true;
    // Keep child tasks if parent goal matched directly
    if (row.type === "task" && row.goalId && goalsMatchedDirectly.has(row.goalId)) return true;
    return false;
  });
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function GanttPreview({ pillars }: Props) {
  const [zoom, setZoom] = useState<ZoomLevel>("monthly");
  const [filterText, setFilterText] = useState("");
  const [collapsedGoals, setCollapsedGoals] = useState<Set<string>>(new Set());
  const [labelWidth, setLabelWidth] = useState(LABEL_WIDTH);
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);
  const resizing = useRef(false);

  // Drag-to-resize left panel
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizing.current = true;
      const startX = e.clientX;
      const startWidth = labelWidth;

      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return;
        const newWidth = Math.max(120, Math.min(600, startWidth + ev.clientX - startX));
        setLabelWidth(newWidth);
      };

      const onUp = () => {
        resizing.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [labelWidth],
  );

  const toggleGoal = useCallback((goalId: string) => {
    setCollapsedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }, []);

  const allGoalIds = useMemo(
    () =>
      pillars.flatMap((pillar) => [
        ...(pillar.short_term_goal || []).map((goal) => goal.id),
        ...(pillar.long_term_goal || []).map((goal) => goal.id),
      ]),
    [pillars],
  );

  const areAllGoalsCollapsed =
    allGoalIds.length > 0 && allGoalIds.every((goalId) => collapsedGoals.has(goalId));

  const toggleAllGoals = useCallback(() => {
    setCollapsedGoals(() =>
      areAllGoalsCollapsed ? new Set<string>() : new Set<string>(allGoalIds),
    );
  }, [allGoalIds, areAllGoalsCollapsed]);

  // Sync vertical scroll between label column and timeline
  const handleTimelineScroll = useCallback(() => {
    if (syncingScroll.current) return;
    syncingScroll.current = true;
    if (scrollRef.current && labelRef.current) {
      labelRef.current.scrollTop = scrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  }, []);

  const handleLabelScroll = useCallback(() => {
    if (syncingScroll.current) return;
    syncingScroll.current = true;
    if (scrollRef.current && labelRef.current) {
      scrollRef.current.scrollTop = labelRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  }, []);

  const {
    rows: allRows,
    minDate,
    maxDate,
  } = useMemo(() => buildRows(pillars, collapsedGoals), [pillars, collapsedGoals]);

  const rows = useMemo(() => filterRows(allRows, filterText), [allRows, filterText]);

  const timeline = useMemo(
    () => generateTimeline(minDate, maxDate, zoom),
    [minDate, maxDate, zoom],
  );

  const colWidth = COL_WIDTH[zoom];
  const totalWidth = timeline.length * colWidth;
  const timelineStart = timeline[0]?.start ?? minDate;
  const timelineEnd = timeline[timeline.length - 1]?.end ?? maxDate;
  const totalDays = diffDays(timelineStart, timelineEnd) + 1 || 1;
  const pxPerDay = totalWidth / totalDays;

  // Scroll to today on mount
  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const todayLeft = todayRef.current.offsetLeft;
      scrollRef.current.scrollLeft = todayLeft - scrollRef.current.clientWidth / 3;
    }
  }, [zoom, pillars.length]);

  const today = new Date();
  const todayOffset = Math.max(0, diffDays(timelineStart, today) * pxPerDay);

  if (pillars.length === 0) {
    return (
      <div style={{ padding: "2rem", color: "var(--color-text-faint)", textAlign: "center" }}>
        No pillars to display. Add pillars and set start/end dates to see the Gantt chart.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span
            style={{
              position: "absolute",
              left: 8,
              fontSize: "0.78em",
              color: "var(--color-text-faint)",
              pointerEvents: "none",
            }}
          >
            &#x1F50D;
          </span>
          <input
            type="text"
            className="field-input"
            placeholder="Filter by name..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ paddingLeft: "1.8rem", fontSize: "0.78em", width: 180, height: 28 }}
          />
          {filterText && (
            <button
              onClick={() => setFilterText("")}
              style={{
                position: "absolute",
                right: 4,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-faint)",
                fontSize: "0.85em",
                padding: "0 4px",
                fontFamily: "inherit",
              }}
            >
              ×
            </button>
          )}
        </div>
        <div style={{ width: 1, height: 18, background: "var(--color-border)" }} />
        <span style={{ fontSize: "0.8em", color: "var(--color-text-muted)", fontWeight: 600 }}>
          Zoom:
        </span>
        <div
          style={{
            display: "flex",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            border: "1px solid var(--color-border)",
          }}
        >
          {(["weekly", "monthly", "quarterly"] as ZoomLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => setZoom(level)}
              style={{
                padding: "4px 12px",
                fontSize: "0.78em",
                fontWeight: 600,
                border: "none",
                borderRight: level !== "quarterly" ? "1px solid var(--color-border)" : "none",
                cursor: "pointer",
                background: zoom === level ? "var(--color-primary)" : "var(--color-surface)",
                color: zoom === level ? "#fff" : "var(--color-text-muted)",
                fontFamily: "inherit",
              }}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
        <span style={{ fontSize: "0.72em", color: "var(--color-text-faint)", marginLeft: "auto" }}>
          {rows.length}
          {filterText ? ` / ${allRows.length}` : ""} items
        </span>
      </div>

      {/* Chart area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        {/* Left labels */}
        <div
          ref={labelRef}
          onScroll={handleLabelScroll}
          style={{ ...labelColumnStyle, width: labelWidth }}
        >
          <div
            style={{
              height: HEADER_HEIGHT,
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "flex-end",
              gap: "0.35rem",
              padding: "0 0.35rem 0.35rem",
            }}
          >
            {allGoalIds.length > 0 && (
              <Button
                aria-label={areAllGoalsCollapsed ? "Expand all groups" : "Collapse all groups"}
                onPress={toggleAllGoals}
                style={{
                  width: 22,
                  height: 22,
                  padding: 0,
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                {areAllGoalsCollapsed ? (
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 3.5h11M2.5 8h11M2.5 12.5h11"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      opacity="0.45"
                    />
                    <path
                      d="M5.5 4.5L8.5 8L5.5 11.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 3.5h11M2.5 8h11M2.5 12.5h11"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      opacity="0.45"
                    />
                    <path
                      d="M4.5 6.5L8 10L11.5 6.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </Button>
            )}
            <span
              style={{
                fontSize: "0.72em",
                fontWeight: 700,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Item
            </span>
          </div>
          {rows.map((row) => {
            const color = PILLAR_COLORS[row.pillarIdx % PILLAR_COLORS.length];
            return (
              <div
                key={row.id}
                style={{
                  height: ROW_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: `${0.5 + row.indent * 1.2}rem`,
                  paddingRight: "0.5rem",
                  borderBottom: "1px solid var(--color-border)",
                  gap: "0.35rem",
                  cursor: row.type === "goal" ? "pointer" : "default",
                  background: row.type === "goal" ? "var(--color-bg)" : "transparent",
                }}
                onClick={() => row.type === "goal" && toggleGoal(row.id)}
              >
                {row.type === "goal" && (
                  <span
                    style={{
                      fontSize: "0.7em",
                      color: "var(--color-text-faint)",
                      flexShrink: 0,
                      width: "1em",
                    }}
                  >
                    {collapsedGoals.has(row.id) ? "▶" : "▼"}
                  </span>
                )}
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color.bar,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: row.type === "goal" ? "0.78em" : "0.76em",
                    fontWeight: row.type === "goal" ? 600 : 400,
                    color: row.type === "goal" ? "var(--color-text)" : "var(--color-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={row.label}
                >
                  {row.label}
                </span>
              </div>
            );
          })}
          <div style={{ height: ROW_HEIGHT * 2 }} />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            width: 5,
            cursor: "col-resize",
            background: "var(--color-border)",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-border)")}
        />

        {/* Right scrollable timeline */}
        <div ref={scrollRef} onScroll={handleTimelineScroll} style={timelineScrollStyle}>
          <div
            style={{
              position: "relative",
              width: totalWidth,
              minHeight: HEADER_HEIGHT + rows.length * ROW_HEIGHT + ROW_HEIGHT * 2,
            }}
          >
            {/* Header row */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 3,
                height: HEADER_HEIGHT,
                display: "flex",
                background: "var(--color-surface)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {timeline.map((col, i) => (
                <div
                  key={i}
                  style={{
                    width: colWidth,
                    flexShrink: 0,
                    borderRight: "1px solid var(--color-border)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: "0 0.4rem 0.3rem",
                  }}
                >
                  {col.subLabel && (
                    <span style={{ fontSize: "0.65em", color: "var(--color-text-faint)" }}>
                      {col.subLabel}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "0.73em",
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {col.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid lines */}
            {timeline.map((_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: i * colWidth,
                  top: HEADER_HEIGHT,
                  bottom: 0,
                  width: colWidth,
                  borderRight: "1px solid var(--color-border)",
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Today marker */}
            <div
              ref={todayRef}
              style={{
                position: "absolute",
                left: todayOffset,
                top: 0,
                bottom: 0,
                width: 2,
                background: "#ef4444",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: todayOffset - 18,
                top: 2,
                background: "#ef4444",
                color: "#fff",
                padding: "1px 5px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.62em",
                fontWeight: 700,
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              Today
            </div>

            {/* Bars */}
            {rows.map((row, rIdx) => {
              const color = PILLAR_COLORS[row.pillarIdx % PILLAR_COLORS.length];
              const y = HEADER_HEIGHT + rIdx * ROW_HEIGHT;

              if (!row.startDate && !row.endDate) {
                return (
                  <div
                    key={row.id}
                    style={{
                      position: "absolute",
                      top: y,
                      left: 0,
                      right: 0,
                      height: ROW_HEIGHT,
                      borderBottom: "1px solid var(--color-border)",
                      background: row.type === "goal" ? "rgba(0,0,0,0.015)" : "transparent",
                    }}
                  />
                );
              }

              const barStart = row.startDate || row.endDate!;
              const barEnd = row.endDate || row.startDate!;
              const x = diffDays(timelineStart, barStart) * pxPerDay;
              const w = Math.max((diffDays(barStart, barEnd) + 1) * pxPerDay, 6);
              const opacity = row.status ? (STATUS_OPACITY[row.status] ?? 1) : 1;
              const isDashed = row.status === "todo" || row.status === "archive";

              return (
                <div
                  key={row.id}
                  style={{
                    position: "absolute",
                    top: y,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                    borderBottom: "1px solid var(--color-border)",
                    background: row.type === "goal" ? "rgba(0,0,0,0.015)" : "transparent",
                  }}
                >
                  <div
                    title={`${row.label}\n${formatDate(barStart)} → ${formatDate(barEnd)}`}
                    style={{
                      position: "absolute",
                      left: x,
                      top: row.type === "goal" ? 4 : 6,
                      width: w,
                      height: row.type === "goal" ? ROW_HEIGHT - 8 : ROW_HEIGHT - 12,
                      background: row.type === "goal" ? color.barLight : color.bar,
                      borderRadius: "var(--radius-sm)",
                      opacity,
                      border: isDashed
                        ? `2px dashed ${color.bar}`
                        : row.type === "goal"
                          ? `1.5px solid ${color.bar}`
                          : "none",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 6,
                      overflow: "hidden",
                    }}
                  >
                    {w > 30 && (
                      <span
                        style={{
                          fontSize: "0.68em",
                          fontWeight: 600,
                          color: row.type === "goal" ? color.text : "#fff",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {row.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────────── */

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  flexShrink: 0,
};

const labelColumnStyle: React.CSSProperties = {
  flexShrink: 0,
  overflowY: "auto",
  overflowX: "hidden",
  background: "var(--color-surface)",
};

const timelineScrollStyle: React.CSSProperties = {
  flex: 1,
  overflowX: "auto",
  overflowY: "auto",
  position: "relative",
};
