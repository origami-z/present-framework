import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getTemplatesDir } from '../storage.js';
import { EVALUATION_EMOJI, pillarStats, planStats } from '../models.js';

const STATUS_BADGE = {
  todo: { bg: '#e0e0e0', color: '#333', label: 'TODO' },
  wip: { bg: '#1976d2', color: '#fff', label: 'WIP' },
  done: { bg: '#388e3c', color: '#fff', label: 'DONE' },
  archive: { bg: '#9e9e9e', color: '#fff', label: 'ARCH' },
};

const PRIORITY_BADGE = {
  high:   { bg: '#fee2e2', color: '#991b1b', label: 'HIGH' },
  medium: { bg: '#ffedd5', color: '#92400e', label: 'MED'  },
  low:    { bg: '#e0e7ff', color: '#3730a3', label: 'LOW'  },
};

Handlebars.registerHelper('evalEmoji', (e) => EVALUATION_EMOJI[e] || '⬜');
Handlebars.registerHelper('statusBadge', (s) => {
  const b = STATUS_BADGE[s] || STATUS_BADGE.todo;
  return new Handlebars.SafeString(
    `<span style="background:${b.bg};color:${b.color};padding:2px 8px;border-radius:4px;font-size:0.75em;font-weight:600">${b.label}</span>`
  );
});
Handlebars.registerHelper('priorityBadge', (p) => {
  const b = PRIORITY_BADGE[p] || PRIORITY_BADGE.low;
  return new Handlebars.SafeString(
    `<span style="background:${b.bg};color:${b.color};padding:2px 8px;border-radius:4px;font-size:0.75em;font-weight:600">${b.label}</span>`
  );
});
Handlebars.registerHelper('joinDeps', (deps) => (deps?.length ? deps.join(', ') : '—'));

export function generateDeck(plan) {
  const templateSrc = readFileSync(join(getTemplatesDir(), 'deck.html.hbs'), 'utf8');
  const template = Handlebars.compile(templateSrc);

  const overall = planStats(plan);

  const enrichedPillars = plan.pillars.map((pillar) => ({
    ...pillar,
    stats: pillarStats(pillar),
    keyTasks: pillar.tasks.filter((t) => t.status !== 'archive'),
    hasStatus:    (pillar.short_term_goal?.length > 0) || (pillar.long_term_goal?.length > 0),
    hasShortGoal: (pillar.short_term_goal?.length > 0),
    hasLongGoal:  (pillar.long_term_goal?.length > 0),
    goalsLayout:  (pillar.short_term_goal?.length > 0 && pillar.long_term_goal?.length > 0)
      ? 'two-col' : 'one-col',
  }));

  return template({
    ...plan,
    pillars: enrichedPillars,
    overall,
    generatedAt: new Date().toISOString().split('T')[0],
  });
}
