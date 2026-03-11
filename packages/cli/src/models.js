export const STATUSES = ['todo', 'wip', 'done', 'archive'];

export const EVALUATIONS = [
  'not_started',
  'on_track',
  'needs_attention',
  'at_risk',
  'blocked',
  'exceeds',
];

export const PRIORITIES = ['high', 'medium', 'low'];

export const EVALUATION_EMOJI = {
  not_started: '⬜',
  on_track: '🟢',
  needs_attention: '🟡',
  at_risk: '🔴',
  blocked: '⛔',
  exceeds: '⭐',
};

export const STATUS_LABEL = {
  todo: '📋 todo',
  wip: '🔵 wip',
  done: '✅ done',
  archive: '📦 archive',
};

export const AI_PROVIDERS = [
  'anthropic',
  'openai',
  'github-copilot',
  'ollama',
  'none',
];

export const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  'github-copilot': 'gpt-4o',
  ollama: 'llama3.2',
  none: '',
};

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function generateId(prefix, existingIds = []) {
  let i = 1;
  while (existingIds.includes(`${prefix}-${String(i).padStart(3, '0')}`)) {
    i++;
  }
  return `${prefix}-${String(i).padStart(3, '0')}`;
}

export function defaultTask(id) {
  const date = today();
  return {
    id,
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    created: date,
    updated: date,
    dependencies: [],
    notes: '',
    linked_goal: [],
  };
}

export function defaultStatusItem(id, text = '', evaluation = 'not_started') {
  return { id, text, evaluation };
}

export function generateStatusId(prefix, existingIds = []) {
  let i = 1;
  while (existingIds.includes(`${prefix}-${String(i).padStart(3, '0')}`)) {
    i++;
  }
  return `${prefix}-${String(i).padStart(3, '0')}`;
}

export function defaultPillar(id, name) {
  return {
    id,
    name,
    description: '',
    short_term_goal: [],
    long_term_goal: [],
    tasks: [],
  };
}

export function defaultPlan(title, owner) {
  const date = today();
  return {
    meta: {
      title,
      owner,
      created: date,
      updated: date,
      version: 1,
    },
    ai: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    },
    pillars: [],
  };
}

/** Collect all status item IDs across a pillar's short_term_goal and long_term_goal */
export function allStatusIds(pillar) {
  return [
    ...(pillar.short_term_goal || []).map((s) => s.id),
    ...(pillar.long_term_goal || []).map((s) => s.id),
  ];
}

/** Find a status item by ID within a pillar, return { item, list } or null */
export function findStatusItem(pillar, statusId) {
  for (const item of pillar.short_term_goal || []) {
    if (item.id === statusId) return { item, list: 'short_term_goal' };
  }
  for (const item of pillar.long_term_goal || []) {
    if (item.id === statusId) return { item, list: 'long_term_goal' };
  }
  return null;
}

/** Collect all task IDs across all pillars */
export function allTaskIds(plan) {
  return plan.pillars.flatMap((p) => p.tasks.map((t) => t.id));
}

/** Find a task by ID, return { task, pillar } or null */
export function findTask(plan, taskId) {
  for (const pillar of plan.pillars) {
    const task = pillar.tasks.find((t) => t.id === taskId);
    if (task) return { task, pillar };
  }
  return null;
}

/** Compute per-pillar stats */
export function pillarStats(pillar) {
  const stats = { todo: 0, wip: 0, done: 0, archive: 0, total: 0 };
  for (const task of pillar.tasks) {
    stats[task.status] = (stats[task.status] || 0) + 1;
    stats.total++;
  }
  return stats;
}

/** Compute overall plan stats */
export function planStats(plan) {
  const stats = { todo: 0, wip: 0, done: 0, archive: 0, total: 0 };
  for (const pillar of plan.pillars) {
    for (const task of pillar.tasks) {
      stats[task.status] = (stats[task.status] || 0) + 1;
      stats.total++;
    }
  }
  stats.pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  return stats;
}
