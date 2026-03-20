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
  onItemSelect?: (target: {
    type: "pillar" | "goal" | "task";
    pillarId: string;
    goalId?: string;
    taskId?: string;
  }) => void;
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
const PILLAR_STRIP_WIDTH = 16;

/* ── Row data builder ─────────────────────────────────────────────────────── */

interface GanttRow {
  type: "pillar" | "goal" | "task";
  id: string;
  label: string;
  pillarIdx: number;
  pillarId: string;
  startDate: Date | null;
  endDate: Date | null;
  status?: string;
  goalId?: string; // for tasks, which goal group they belong to
  indent: number;
}

interface BarMetrics {
  x: number;
  w: number;
  y: number;
  barStart: Date;
  barEnd: Date;
}

interface PillarStripSection {
  pillarId: string;
  pillarName: string;
  pillarIdx: number;
  startRow: number;
  rowCount: number;
}

function getRowBarMetrics(
  row: GanttRow,
  rowIndex: number,
  timelineStart: Date,
  pxPerDay: number,
): BarMetrics | null {
  if (!row.startDate && !row.endDate) return null;

  const barStart = row.startDate || row.endDate!;
  const barEnd = row.endDate || row.startDate!;
  const x = diffDays(timelineStart, barStart) * pxPerDay;
  const w = Math.max((diffDays(barStart, barEnd) + 1) * pxPerDay, 6);
  const y = HEADER_HEIGHT + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

  return { x, w, y, barStart, barEnd };
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
        pillarId: pillar.id,
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
            pillarId: pillar.id,
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
        pillarId: pillar.id,
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

function normalizeStatus(status?: string): string {
  const normalized = status?.trim().toLowerCase();
  return normalized || "unspecified";
}

function statusLabel(status: string): string {
  if (status === "wip") return "WIP";
  if (status === "todo") return "To do";
  if (status === "done") return "Done";
  if (status === "unspecified") return "Unspecified";
  return status.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function filterRowsByStatus(rows: GanttRow[], hiddenStatuses: Set<string>): GanttRow[] {
  if (hiddenStatuses.size === 0) return rows;

  const taskVisibleById = new Map<string, boolean>();
  const visibleTasksByGoalId = new Map<string, number>();
  const totalTasksByGoalId = new Map<string, number>();

  for (const row of rows) {
    if (row.type !== "task") continue;

    const isVisible = !hiddenStatuses.has(normalizeStatus(row.status));
    taskVisibleById.set(row.id, isVisible);

    if (row.goalId) {
      totalTasksByGoalId.set(row.goalId, (totalTasksByGoalId.get(row.goalId) ?? 0) + 1);
      if (isVisible) {
        visibleTasksByGoalId.set(row.goalId, (visibleTasksByGoalId.get(row.goalId) ?? 0) + 1);
      }
    }
  }

  return rows.filter((row) => {
    if (row.type === "task") return taskVisibleById.get(row.id) ?? true;
    if (row.type === "goal") {
      const totalChildren = totalTasksByGoalId.get(row.id) ?? 0;
      if (totalChildren === 0) return true;
      return (visibleTasksByGoalId.get(row.id) ?? 0) > 0;
    }
    return true;
  });
}

function filterRowsByFocusWindow(rows: GanttRow[], enabled: boolean): GanttRow[] {
  if (!enabled) return rows;

  const today = new Date();
  const windowStart = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  const windowEnd = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const overlapsWindow = (startDate: Date | null, endDate: Date | null) => {
    const start = startDate || endDate;
    const end = endDate || startDate;
    if (!start || !end) return false;
    return start <= windowEnd && end >= windowStart;
  };

  const visibleTaskIds = new Set(
    rows
      .filter((row) => row.type === "task" && overlapsWindow(row.startDate, row.endDate))
      .map((row) => row.id),
  );

  const visibleGoalIdsByTask = new Set(
    rows
      .filter((row) => row.type === "task" && row.goalId && visibleTaskIds.has(row.id))
      .map((row) => row.goalId as string),
  );

  return rows.filter((row) => {
    if (row.type === "task") return visibleTaskIds.has(row.id);
    if (row.type === "goal") {
      return visibleGoalIdsByTask.has(row.id) || overlapsWindow(row.startDate, row.endDate);
    }
    return false;
  });
}

function collectReachableTaskIds(
  startTaskId: string,
  getNextIds: (taskId: string) => string[],
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextIds = getNextIds(current);

    for (const nextId of nextIds) {
      if (nextId === startTaskId || visited.has(nextId)) continue;
      visited.add(nextId);
      queue.push(nextId);
    }
  }

  return visited;
}

function buildPillarStripSections(rows: GanttRow[], pillars: Pillar[]): PillarStripSection[] {
  const sections: PillarStripSection[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const pillar = pillars[row.pillarIdx];

    if (!pillar) continue;

    const previous = sections[sections.length - 1];
    if (previous && previous.pillarId === row.pillarId) {
      previous.rowCount += 1;
      continue;
    }

    sections.push({
      pillarId: row.pillarId,
      pillarName: pillar.name || row.pillarId,
      pillarIdx: row.pillarIdx,
      startRow: index,
      rowCount: 1,
    });
  }

  return sections;
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function GanttPreview({ pillars, onItemSelect }: Props) {
  const [zoom, setZoom] = useState<ZoomLevel>("monthly");
  const [filterText, setFilterText] = useState("");
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());
  const [focusWindowEnabled, setFocusWindowEnabled] = useState(false);
  const [collapsedGoals, setCollapsedGoals] = useState<Set<string>>(new Set());
  const [dependencyFocusTaskId, setDependencyFocusTaskId] = useState<string | null>(null);
  const [upstreamTaskIds, setUpstreamTaskIds] = useState<Set<string>>(new Set());
  const [downstreamTaskIds, setDownstreamTaskIds] = useState<Set<string>>(new Set());
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

  const taskDependencyGraph = useMemo(() => {
    const tasks = pillars.flatMap((pillar) => pillar.tasks || []);
    const taskById = new Map<string, Task>();
    const reverseDependencies = new Map<string, Set<string>>();

    for (const task of tasks) {
      taskById.set(task.id, task);
    }

    for (const task of tasks) {
      for (const dependencyId of task.dependencies || []) {
        if (!reverseDependencies.has(dependencyId)) {
          reverseDependencies.set(dependencyId, new Set<string>());
        }
        reverseDependencies.get(dependencyId)!.add(task.id);
      }
    }

    return { taskById, reverseDependencies };
  }, [pillars]);

  const clearDependencyFocus = useCallback(() => {
    setDependencyFocusTaskId(null);
    setUpstreamTaskIds(new Set());
    setDownstreamTaskIds(new Set());
  }, []);

  const handleRowSelect = useCallback(
    (row: GanttRow) => {
      if (!onItemSelect) return;

      if (row.type === "task") {
        onItemSelect({
          type: "task",
          pillarId: row.pillarId,
          taskId: row.id,
          goalId: row.goalId,
        });
        return;
      }

      if (row.type === "goal") {
        onItemSelect({
          type: "goal",
          pillarId: row.pillarId,
          goalId: row.id,
        });
        return;
      }

      onItemSelect({ type: "pillar", pillarId: row.pillarId });
    },
    [onItemSelect],
  );

  const focusTaskDependencies = useCallback(
    (taskId: string) => {
      if (dependencyFocusTaskId === taskId) {
        clearDependencyFocus();
        return;
      }

      const upstream = collectReachableTaskIds(
        taskId,
        (id) => taskDependencyGraph.taskById.get(id)?.dependencies || [],
      );
      const downstream = collectReachableTaskIds(taskId, (id) =>
        Array.from(taskDependencyGraph.reverseDependencies.get(id) || []),
      );

      setDependencyFocusTaskId(taskId);
      setUpstreamTaskIds(upstream);
      setDownstreamTaskIds(downstream);
    },
    [clearDependencyFocus, dependencyFocusTaskId, taskDependencyGraph],
  );

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

  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();

    for (const pillar of pillars) {
      for (const task of pillar.tasks || []) {
        statuses.add(normalizeStatus(task.status));
      }
    }

    return Array.from(statuses).sort((a, b) => statusLabel(a).localeCompare(statusLabel(b)));
  }, [pillars]);

  useEffect(() => {
    setHiddenStatuses((prev) => {
      let changed = false;
      const next = new Set<string>();

      for (const status of prev) {
        if (availableStatuses.includes(status)) {
          next.add(status);
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [availableStatuses]);

  const focusRows = useMemo(
    () => filterRowsByFocusWindow(allRows, focusWindowEnabled),
    [allRows, focusWindowEnabled],
  );
  const statusRows = useMemo(
    () => filterRowsByStatus(focusRows, hiddenStatuses),
    [focusRows, hiddenStatuses],
  );
  const rows = useMemo(() => filterRows(statusRows, filterText), [filterText, statusRows]);

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
  const hasDependencyFocus = dependencyFocusTaskId !== null;

  const highlightedTaskIds = useMemo(() => {
    const ids = new Set<string>();
    if (dependencyFocusTaskId) ids.add(dependencyFocusTaskId);
    for (const id of upstreamTaskIds) ids.add(id);
    for (const id of downstreamTaskIds) ids.add(id);
    return ids;
  }, [dependencyFocusTaskId, downstreamTaskIds, upstreamTaskIds]);

  const taskRowMetaById = useMemo(() => {
    const meta = new Map<string, { row: GanttRow; rowIndex: number }>();
    rows.forEach((row, rowIndex) => {
      if (row.type === "task") {
        meta.set(row.id, { row, rowIndex });
      }
    });
    return meta;
  }, [rows]);

  const pillarStripSections = useMemo(
    () => buildPillarStripSections(rows, pillars),
    [rows, pillars],
  );

  const dependencyArrows = useMemo(() => {
    if (!hasDependencyFocus) return [] as { d: string; isPrimary: boolean }[];

    const arrows: { d: string; isPrimary: boolean }[] = [];

    for (const [taskId, taskMeta] of taskRowMetaById) {
      if (!highlightedTaskIds.has(taskId)) continue;

      const task = taskDependencyGraph.taskById.get(taskId);
      if (!task) continue;

      for (const dependencyId of task.dependencies || []) {
        if (!highlightedTaskIds.has(dependencyId)) continue;

        const dependencyMeta = taskRowMetaById.get(dependencyId);
        if (!dependencyMeta) continue;

        const from = getRowBarMetrics(
          dependencyMeta.row,
          dependencyMeta.rowIndex,
          timelineStart,
          pxPerDay,
        );
        const to = getRowBarMetrics(taskMeta.row, taskMeta.rowIndex, timelineStart, pxPerDay);

        if (!from || !to) continue;

        const startX = from.x + Math.max(from.w - pxPerDay * 0.5, 1);
        const endX = to.x + Math.min(pxPerDay * 0.5, Math.max(to.w * 0.35, 1));
        const startY = from.y;
        const endY = to.y;
        const direction = endX >= startX ? 1 : -1;
        const offset = Math.min(56, Math.max(18, Math.abs(endX - startX) / 2.4));
        const c1x = startX + direction * offset;
        const c2x = endX - direction * offset;
        const d = `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`;
        const isPrimary =
          dependencyId === dependencyFocusTaskId || taskId === dependencyFocusTaskId;

        arrows.push({ d, isPrimary });
      }
    }

    return arrows;
  }, [
    dependencyFocusTaskId,
    hasDependencyFocus,
    highlightedTaskIds,
    pxPerDay,
    taskDependencyGraph.taskById,
    taskRowMetaById,
    timelineStart,
  ]);

  // Scroll to today on mount
  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const todayLeft = todayRef.current.offsetLeft;
      scrollRef.current.scrollLeft = todayLeft - scrollRef.current.clientWidth / 3;
    }
  }, [zoom, pillars.length]);

  const today = new Date();
  const todayOffset = Math.max(0, diffDays(timelineStart, today) * pxPerDay);
  const hiddenStatusCount = hiddenStatuses.size;

  const toggleStatusVisibility = useCallback((status: string) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const showAllStatuses = useCallback(() => {
    setHiddenStatuses(new Set());
  }, []);

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
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
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
              aria-label="Filter by name"
              type="text"
              className="field-input"
              placeholder="Filter by name..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{ paddingLeft: "1.8rem", fontSize: "0.78em", width: 180, height: 28 }}
            />
            {filterText && (
              <button
                aria-label="Clear filter"
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
        </div>
        <div style={{ width: 1, height: 18, background: "var(--color-border)" }} />
        <span
          id="gantt-zoom-label"
          style={{ fontSize: "0.8em", color: "var(--color-text-muted)", fontWeight: 600 }}
        >
          Zoom:
        </span>
        <div
          role="group"
          aria-labelledby="gantt-zoom-label"
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
        <div style={{ width: 1, height: 18, background: "var(--color-border)" }} />
        {availableStatuses.length > 0 && (
          <>
            <span
              id="gantt-status-label"
              style={{ fontSize: "0.8em", color: "var(--color-text-muted)", fontWeight: 600 }}
            >
              Status:
            </span>
            <div
              role="group"
              aria-labelledby="gantt-status-label"
              style={{
                display: "flex",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                border: "1px solid var(--color-border)",
              }}
            >
              {availableStatuses.map((status, index) => {
                const hidden = hiddenStatuses.has(status);
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={!hidden}
                    onClick={() => toggleStatusVisibility(status)}
                    style={{
                      padding: "4px 12px",
                      fontSize: "0.78em",
                      fontWeight: 600,
                      border: "none",
                      borderRight:
                        index !== availableStatuses.length - 1
                          ? "1px solid var(--color-border)"
                          : "none",
                      cursor: "pointer",
                      background: hidden ? "var(--color-surface)" : "var(--color-primary)",
                      color: hidden ? "var(--color-text-muted)" : "#fff",
                      fontFamily: "inherit",
                    }}
                  >
                    {statusLabel(status)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={showAllStatuses}
              disabled={hiddenStatuses.size === 0}
              style={{
                padding: "4px 10px",
                fontSize: "0.78em",
                fontWeight: 600,
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                cursor: hiddenStatuses.size === 0 ? "default" : "pointer",
                background: "var(--color-surface)",
                color:
                  hiddenStatuses.size === 0 ? "var(--color-text-faint)" : "var(--color-text-muted)",
                fontFamily: "inherit",
                opacity: hiddenStatuses.size === 0 ? 0.7 : 1,
              }}
            >
              Show all
            </button>
            <div style={{ width: 1, height: 18, background: "var(--color-border)" }} />
          </>
        )}
        <button
          onClick={() => setFocusWindowEnabled((prev) => !prev)}
          aria-pressed={focusWindowEnabled}
          title="Show only tasks within one month before and after today"
          style={{
            padding: "4px 10px",
            fontSize: "0.78em",
            fontWeight: 600,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            background: focusWindowEnabled ? "var(--color-primary)" : "var(--color-surface)",
            color: focusWindowEnabled ? "#fff" : "var(--color-text-muted)",
            fontFamily: "inherit",
          }}
        >
          ±1M
        </button>
        <span style={{ fontSize: "0.72em", color: "var(--color-text-faint)", marginLeft: "auto" }}>
          {rows.length}
          {filterText || focusWindowEnabled ? ` / ${allRows.length}` : ""} items
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
              position: "relative",
              minHeight: HEADER_HEIGHT + rows.length * ROW_HEIGHT + ROW_HEIGHT * 2,
            }}
          >
            <div
              style={{
                height: HEADER_HEIGHT,
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "flex-end",
                gap: "0.35rem",
                padding: `0 0.35rem 0.35rem ${PILLAR_STRIP_WIDTH + 6}px`,
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

            {pillarStripSections.map((section) => {
              const color = PILLAR_COLORS[section.pillarIdx % PILLAR_COLORS.length];

              return (
                <div
                  key={section.pillarId}
                  aria-label={`Pillar ${section.pillarName}`}
                  title={section.pillarName}
                  style={{
                    position: "absolute",
                    top: HEADER_HEIGHT + section.startRow * ROW_HEIGHT,
                    left: 0,
                    width: PILLAR_STRIP_WIDTH,
                    height: section.rowCount * ROW_HEIGHT,
                    background: color.bar,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRight: "1px solid rgba(255,255,255,0.28)",
                    borderBottom: "1px solid var(--color-border)",
                    zIndex: 1,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      fontSize: "0.6em",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      opacity: 0.95,
                    }}
                  >
                    {section.pillarName}
                  </span>
                </div>
              );
            })}

            {rows.map((row) => {
              const color = PILLAR_COLORS[row.pillarIdx % PILLAR_COLORS.length];
              const isFocusedTask = row.type === "task" && dependencyFocusTaskId === row.id;
              const isUpstreamTask = row.type === "task" && upstreamTaskIds.has(row.id);
              const isDownstreamTask = row.type === "task" && downstreamTaskIds.has(row.id);
              const isDependencyHighlightedTask =
                isFocusedTask || isUpstreamTask || isDownstreamTask;
              return (
                <div
                  key={row.id}
                  style={{
                    height: ROW_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    marginLeft: PILLAR_STRIP_WIDTH,
                    paddingLeft: `${0.5 + row.indent * 1.2}rem`,
                    paddingRight: "0.5rem",
                    borderBottom: "1px solid var(--color-border)",
                    gap: "0.35rem",
                    cursor: row.type === "goal" ? "pointer" : "default",
                    background: row.type === "goal" ? "var(--color-bg)" : "transparent",
                    borderLeft: isFocusedTask
                      ? "3px solid var(--color-primary)"
                      : isUpstreamTask
                        ? "3px dashed var(--color-text-faint)"
                        : isDownstreamTask
                          ? "3px solid var(--color-text-faint)"
                          : "3px solid transparent",
                    opacity:
                      row.type === "task" && hasDependencyFocus && !isDependencyHighlightedTask
                        ? 0.5
                        : 1,
                    position: "relative",
                    zIndex: 2,
                  }}
                  onClick={() => row.type === "goal" && toggleGoal(row.id)}
                  onDoubleClick={() => row.type === "task" && focusTaskDependencies(row.id)}
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
            <div style={{ height: ROW_HEIGHT * 2, marginLeft: PILLAR_STRIP_WIDTH }} />
          </div>
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
              const barMetrics = getRowBarMetrics(row, rIdx, timelineStart, pxPerDay);
              const isFocusedTask = row.type === "task" && dependencyFocusTaskId === row.id;
              const isUpstreamTask = row.type === "task" && upstreamTaskIds.has(row.id);
              const isDownstreamTask = row.type === "task" && downstreamTaskIds.has(row.id);
              const isDependencyHighlightedTask =
                isFocusedTask || isUpstreamTask || isDownstreamTask;
              const inactiveTaskOpacity =
                row.type === "task" && hasDependencyFocus && !isDependencyHighlightedTask
                  ? 0.35
                  : 1;

              if (!barMetrics) {
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

              const { barStart, barEnd, x, w } = barMetrics;
              const opacity =
                (row.status ? (STATUS_OPACITY[row.status] ?? 1) : 1) * inactiveTaskOpacity;
              const isDashed = row.status === "todo" || row.status === "archive";
              const showCompletedTick = row.type === "task" && row.status === "done";

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
                    onClick={() => handleRowSelect(row)}
                    onDoubleClick={() => row.type === "task" && focusTaskDependencies(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleRowSelect(row);
                      }
                    }}
                    role="button"
                    tabIndex={0}
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
                      outline: isFocusedTask
                        ? "2px solid var(--color-primary)"
                        : isUpstreamTask
                          ? "2px dashed var(--color-text-faint)"
                          : isDownstreamTask
                            ? "2px solid var(--color-text-faint)"
                            : "none",
                      outlineOffset: -1,
                      zIndex: isDependencyHighlightedTask ? 2 : 1,
                      cursor: "pointer",
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
                    {showCompletedTick && (
                      <span
                        aria-label="Completed"
                        title="Completed"
                        style={{
                          marginLeft: "auto",
                          marginRight: 6,
                          color: "#fff",
                          fontSize: "0.75em",
                          lineHeight: 1,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Dependency arrows */}
            {dependencyArrows.length > 0 && (
              <svg
                width={totalWidth}
                height={HEADER_HEIGHT + rows.length * ROW_HEIGHT + ROW_HEIGHT * 2}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              >
                <defs>
                  <marker
                    id="gantt-arrowhead-muted"
                    viewBox="0 0 8 8"
                    refX="6"
                    refY="4"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="var(--color-text-faint)" />
                  </marker>
                  <marker
                    id="gantt-arrowhead-primary"
                    viewBox="0 0 8 8"
                    refX="6"
                    refY="4"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="var(--color-primary)" />
                  </marker>
                </defs>

                {dependencyArrows.map((arrow, idx) => (
                  <path
                    key={idx}
                    d={arrow.d}
                    fill="none"
                    stroke={arrow.isPrimary ? "var(--color-primary)" : "var(--color-text-faint)"}
                    strokeWidth={arrow.isPrimary ? 1.5 : 1.15}
                    opacity={arrow.isPrimary ? 0.9 : 0.7}
                    markerEnd={
                      arrow.isPrimary
                        ? "url(#gantt-arrowhead-primary)"
                        : "url(#gantt-arrowhead-muted)"
                    }
                  />
                ))}
              </svg>
            )}
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
