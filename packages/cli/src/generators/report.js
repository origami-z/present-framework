import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getTemplatesDir } from '../storage.js';
import { EVALUATION_EMOJI, pillarStats, planStats } from '../models.js';

const STATUS_EMOJI = { todo: '📋', wip: '🔵', done: '✅', archive: '📦' };

Handlebars.registerHelper('statusEmoji', (s) => STATUS_EMOJI[s] || '❓');
Handlebars.registerHelper('evalEmoji', (e) => EVALUATION_EMOJI[e] || '⬜');
Handlebars.registerHelper('joinDeps', (deps) => (deps?.length ? deps.join(', ') : '—'));
Handlebars.registerHelper('or', (a, b) => a || b);

export function generateReport(plan) {
  const templateSrc = readFileSync(join(getTemplatesDir(), 'report.md.hbs'), 'utf8');
  const template = Handlebars.compile(templateSrc);

  const overall = planStats(plan);
  const atRisk = [];
  const blocked = [];
  const recentDone = [];

  const enrichedPillars = plan.pillars.map((pillar) => {
    const stats = pillarStats(pillar);
    for (const task of pillar.tasks) {
      if (task.evaluation === 'at_risk') atRisk.push({ ...task, pillarName: pillar.name });
      if (task.evaluation === 'blocked') blocked.push({ ...task, pillarName: pillar.name });
      if (task.status === 'done') recentDone.push({ ...task, pillarName: pillar.name });
    }
    return { ...pillar, stats };
  });

  return template({
    ...plan,
    pillars: enrichedPillars,
    overall,
    atRisk,
    blocked,
    recentDone: recentDone.slice(-5),
    generatedAt: new Date().toISOString().split('T')[0],
  });
}
