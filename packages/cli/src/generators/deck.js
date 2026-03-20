import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";
import { getTemplatesDir } from "../storage.js";
import { EVALUATION_EMOJI, pillarStats, planStats } from "../models.js";

const STATUS_BADGE = {
  todo: { bg: "#e0e0e0", color: "#333", label: "TODO" },
  wip: { bg: "#1976d2", color: "#fff", label: "WIP" },
  done: { bg: "#388e3c", color: "#fff", label: "DONE" },
  archive: { bg: "#9e9e9e", color: "#fff", label: "ARCH" },
};

const PRIORITY_BADGE = {
  high: { bg: "#fee2e2", color: "#991b1b", label: "HIGH" },
  medium: { bg: "#ffedd5", color: "#92400e", label: "MED" },
  low: { bg: "#e0e7ff", color: "#3730a3", label: "LOW" },
};

const DEFAULT_DECK_OPTIONS = {
  recentMonths: 1,
  nextMonths: 3,
  referenceDate: null,
};

const ACTIVE_TASK_STATUSES = new Set(["todo", "wip"]);
const RISK_EVALUATIONS = new Set(["blocked", "at_risk", "needs_attention"]);
const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

Handlebars.registerHelper("evalEmoji", (e) => EVALUATION_EMOJI[e] || "⬜");
Handlebars.registerHelper("statusBadge", (s) => {
  const b = STATUS_BADGE[s] || STATUS_BADGE.todo;
  return new Handlebars.SafeString(
    `<span style="background:${b.bg};color:${b.color};padding:2px 8px;border-radius:4px;font-size:0.75em;font-weight:600">${b.label}</span>`,
  );
});
Handlebars.registerHelper("priorityBadge", (p) => {
  const b = PRIORITY_BADGE[p] || PRIORITY_BADGE.low;
  return new Handlebars.SafeString(
    `<span style="background:${b.bg};color:${b.color};padding:2px 8px;border-radius:4px;font-size:0.75em;font-weight:600">${b.label}</span>`,
  );
});
Handlebars.registerHelper("joinDeps", (deps) => (deps?.length ? deps.join(", ") : "—"));
Handlebars.registerHelper("formatDate", (date) => {
  if (!date) return "Undated";
  const parsed = parseDate(date);
  if (!parsed) return date;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
});
Handlebars.registerHelper("inc", (value) => Number(value) + 1);
Handlebars.registerHelper("linkifyText", (value) => {
  if (!value) return "";

  const escaped = Handlebars.escapeExpression(String(value));
  const linked = escaped
    .replace(/(^|[\s(>])((?:https?:\/\/|www\.)[^\s<]+)/g, (match, prefix, rawUrl) => {
      const trimmedUrl = rawUrl.replace(/[),.;!?]+$/g, "");
      const trailing = rawUrl.slice(trimmedUrl.length);
      const href = trimmedUrl.startsWith("www.") ? `https://${trimmedUrl}` : trimmedUrl;
      return `${prefix}<a href="${href}" target="_blank" rel="noopener noreferrer">${trimmedUrl}</a>${trailing}`;
    })
    .replace(/\n/g, "<br />");

  return new Handlebars.SafeString(linked);
});

function parseDate(value) {
  if (!value || typeof value !== "string") return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonths(date, months) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

function clampPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeDeckOptions(options = {}) {
  const referenceDate =
    options.referenceDate instanceof Date
      ? startOfDay(options.referenceDate)
      : parseDate(options.referenceDate) || startOfDay(new Date());

  return {
    recentMonths: clampPositiveInteger(options.recentMonths, DEFAULT_DECK_OPTIONS.recentMonths),
    nextMonths: clampPositiveInteger(options.nextMonths, DEFAULT_DECK_OPTIONS.nextMonths),
    referenceDate,
  };
}

function isWithinWindow(dateValue, start, end) {
  const date = parseDate(dateValue);
  if (!date) return false;
  return date >= start && date <= end;
}

function compareByDateDesc(a, b, field) {
  const aDate = parseDate(a[field]);
  const bDate = parseDate(b[field]);
  if (aDate && bDate) return bDate - aDate;
  if (aDate) return -1;
  if (bDate) return 1;
  return 0;
}

function priorityWeight(priority) {
  return PRIORITY_WEIGHT[priority] ?? PRIORITY_WEIGHT.low;
}

function comparePriority(a, b) {
  return priorityWeight(a.priority) - priorityWeight(b.priority);
}

function highestPriority(tasks) {
  return tasks.reduce(
    (best, task) => (priorityWeight(task.priority) < priorityWeight(best) ? task.priority : best),
    "low",
  );
}

function compareUpcoming(a, b) {
  const priorityOrder = comparePriority(a, b);
  if (priorityOrder !== 0) return priorityOrder;

  if (a.status === "wip" && b.status !== "wip") return -1;
  if (a.status !== "wip" && b.status === "wip") return 1;

  const dateOrder = compareByDateDesc(b, a, "start_date");
  if (dateOrder !== 0) return dateOrder;

  return a.title.localeCompare(b.title);
}

function progressLabel(progress) {
  if (progress.wip > 0) return "In progress";
  if (progress.todo > 0) return "Planned";
  if (progress.done > 0) return "Delivered";
  return "Not started";
}

function buildGoalMap(pillar) {
  const goalMap = new Map();
  for (const goal of [...(pillar.short_term_goal || []), ...(pillar.long_term_goal || [])]) {
    goalMap.set(goal.id, goal);
  }
  return goalMap;
}

function collectRecentDone(plan, recentStart, referenceDate) {
  return plan.pillars
    .flatMap((pillar) =>
      pillar.tasks
        .filter(
          (task) =>
            task.status === "done" && isWithinWindow(task.end_date, recentStart, referenceDate),
        )
        .map((task) => ({
          ...task,
          pillarId: pillar.id,
          pillarName: pillar.name,
        })),
    )
    .sort((a, b) => compareByDateDesc(a, b, "end_date"));
}

function collectNextUp(plan, referenceDate, nextEnd) {
  return plan.pillars
    .flatMap((pillar) =>
      pillar.tasks
        .filter((task) => {
          if (task.status === "wip") return true;
          return task.status === "todo" && isWithinWindow(task.start_date, referenceDate, nextEnd);
        })
        .map((task) => ({
          ...task,
          pillarId: pillar.id,
          pillarName: pillar.name,
          timingLabel: task.status === "wip" ? "Already in progress" : task.start_date || "Undated",
        })),
    )
    .sort(compareUpcoming);
}

function collectOngoingGoals(plan) {
  return plan.pillars
    .flatMap((pillar) => {
      const goalMap = buildGoalMap(pillar);
      const goalProgress = new Map();

      for (const task of pillar.tasks) {
        if (!ACTIVE_TASK_STATUSES.has(task.status)) continue;

        for (const goalId of task.linked_goal || []) {
          const goal = goalMap.get(goalId);
          if (!goal) continue;

          if (!goalProgress.has(goalId)) {
            const linkedTasks = pillar.tasks.filter((candidate) =>
              (candidate.linked_goal || []).includes(goalId),
            );
            const activeTasks = linkedTasks.filter((linkedTask) =>
              ACTIVE_TASK_STATUSES.has(linkedTask.status),
            );
            const progress = linkedTasks.reduce(
              (acc, linkedTask) => {
                acc[linkedTask.status] = (acc[linkedTask.status] || 0) + 1;
                acc.total += 1;
                return acc;
              },
              { todo: 0, wip: 0, done: 0, archive: 0, total: 0 },
            );

            goalProgress.set(goalId, {
              ...goal,
              pillarId: pillar.id,
              pillarName: pillar.name,
              priority: highestPriority(activeTasks.length > 0 ? activeTasks : linkedTasks),
              linkedTasks,
              activeTasks,
              progress,
              progressPct:
                progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0,
              progressLabel: progressLabel(progress),
            });
          }
        }
      }

      return Array.from(goalProgress.values());
    })
    .sort((a, b) => {
      const priorityOrder = comparePriority(a, b);
      if (priorityOrder !== 0) return priorityOrder;

      const riskDelta =
        Number(RISK_EVALUATIONS.has(b.evaluation)) - Number(RISK_EVALUATIONS.has(a.evaluation));
      if (riskDelta !== 0) return riskDelta;
      if (b.progress.wip !== a.progress.wip) return b.progress.wip - a.progress.wip;
      return a.text.localeCompare(b.text);
    });
}

function buildHighlights(recentDone, nextUp, ongoingGoals) {
  const highlights = [];

  if (recentDone.length > 0) {
    const latest = recentDone[0];
    highlights.push(`Delivered ${recentDone.length} initiatives recently, led by ${latest.title}.`);
  }

  const activeWip = nextUp.filter((task) => task.status === "wip");
  if (activeWip.length > 0) {
    highlights.push(`${activeWip.length} initiatives are already in flight for the next window.`);
  }

  const atRiskGoals = ongoingGoals.filter((goal) => RISK_EVALUATIONS.has(goal.evaluation));
  if (atRiskGoals.length > 0) {
    highlights.push(`${atRiskGoals.length} ongoing goals need leadership attention.`);
  }

  return highlights;
}

function buildAppendixPillars(plan, recentDone, nextUp, ongoingGoals) {
  return plan.pillars.map((pillar) => {
    const stats = pillarStats(pillar);
    const pillarRecentDone = recentDone.filter((task) => task.pillarId === pillar.id).slice(0, 3);
    const pillarNextUp = nextUp.filter((task) => task.pillarId === pillar.id).slice(0, 4);
    const pillarGoals = ongoingGoals.filter((goal) => goal.pillarId === pillar.id).slice(0, 3);

    return {
      ...pillar,
      stats,
      pillarRecentDone,
      pillarNextUp,
      pillarGoals,
      hasAppendixContent:
        pillarRecentDone.length > 0 ||
        pillarNextUp.length > 0 ||
        pillarGoals.length > 0 ||
        (pillar.short_term_goal || []).length > 0 ||
        (pillar.long_term_goal || []).length > 0,
    };
  });
}

function buildExecutiveSummary(plan, options) {
  const normalized = normalizeDeckOptions(options);
  const recentStart = addMonths(normalized.referenceDate, -normalized.recentMonths);
  const nextEnd = addMonths(normalized.referenceDate, normalized.nextMonths);
  const recentDone = collectRecentDone(plan, recentStart, normalized.referenceDate);
  const nextUp = collectNextUp(plan, normalized.referenceDate, nextEnd);
  const ongoingGoals = collectOngoingGoals(plan);

  return {
    options: {
      recentMonths: normalized.recentMonths,
      nextMonths: normalized.nextMonths,
      referenceDate: normalized.referenceDate.toISOString().split("T")[0],
      recentLabel: `Last ${normalized.recentMonths} month${normalized.recentMonths === 1 ? "" : "s"}`,
      nextLabel: `Next ${normalized.nextMonths} month${normalized.nextMonths === 1 ? "" : "s"}`,
    },
    highlights: buildHighlights(recentDone, nextUp, ongoingGoals),
    recentDone,
    recentDoneTop: recentDone.slice(0, 6),
    nextUp,
    nextUpTop: nextUp.slice(0, 6),
    nextUpWip: nextUp.filter((task) => task.status === "wip"),
    nextUpPlanned: nextUp.filter((task) => task.status === "todo"),
    ongoingGoals,
    ongoingGoalsTop: ongoingGoals.slice(0, 6),
    appendixPillars: buildAppendixPillars(plan, recentDone, nextUp, ongoingGoals),
  };
}

export function generateDeck(plan, options = {}) {
  const templateSrc = readFileSync(join(getTemplatesDir(), "deck.html.hbs"), "utf8");
  const template = Handlebars.compile(templateSrc);

  const overall = planStats(plan);
  const summary = buildExecutiveSummary(plan, options);

  return template({
    ...plan,
    overall,
    generatedAt: new Date().toISOString().split("T")[0],
    summary,
  });
}
