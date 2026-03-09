import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const SCHEMA_COMMENT =
  '# yaml-language-server: $schema=../schema/plan.schema.json\n' +
  '# Edit this file directly — IDE autocomplete is enabled via the schema above.\n' +
  '#\n' +
  '# COPILOT CHAT TIPS:\n' +
  '#   "Suggest 3 more tasks for the <pillar> pillar"\n' +
  '#   "What dependencies am I missing between these tasks?"\n' +
  '#   "Update <task-id> status to wip and evaluation to on_track"\n' +
  '#   "Summarize my current plan progress"\n\n';

const PLAN_FOLDER = process.env.PLAN_FOLDER || 'data';

/** Walk up from cwd to find the project root (directory containing <PLAN_FOLDER>/plan.yaml) */
function findProjectRoot() {
  let dir = process.cwd();
  const root = dirname(dir); // stop condition
  while (dir !== root) {
    if (existsSync(join(dir, PLAN_FOLDER, 'plan.yaml'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

export function getProjectRoot() {
  return findProjectRoot();
}

export function getPlanFolderPath() {
  return join(findProjectRoot(), PLAN_FOLDER);
}

export function getPlanPath() {
  return join(findProjectRoot(), PLAN_FOLDER, 'plan.yaml');
}

export function getOutputDir() {
  return join(getPlanFolderPath(), 'output');
}

export function getIterationsDir() {
  return join(getPlanFolderPath(), 'iterations');
}

export function getTemplatesDir() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return join(__dirname, '../../../templates');
}

/** Migrate plan from old current_status/target_status fields to short_term_goal/long_term_goal.
 *  Returns true if any pillar was migrated. */
function migrateGoalFields(plan) {
  let migrated = false;
  for (const pillar of plan.pillars || []) {
    if (pillar.current_status !== undefined || pillar.target_status !== undefined) {
      migrated = true;
      pillar.short_term_goal = [
        ...(pillar.current_status || []),
        ...(pillar.target_status || []),
      ];
      pillar.long_term_goal = pillar.long_term_goal || [];
      delete pillar.current_status;
      delete pillar.target_status;
    }
  }
  return migrated;
}

export function loadPlan() {
  const path = getPlanPath();
  if (!existsSync(path)) {
    throw new Error(`No plan.yaml found. Run 'present init' to create one.`);
  }
  const raw = readFileSync(path, 'utf8');
  const plan = yaml.load(raw);

  if (migrateGoalFields(plan)) {
    console.log(
      '\n⚙️  Auto-migrated plan.yaml: "current_status" and "target_status" per pillar\n' +
      '   have been renamed to "short_term_goal" and "long_term_goal".\n' +
      '   All items were merged into "short_term_goal" — move any long-horizon goals\n' +
      '   to "long_term_goal" when ready.\n'
    );
    savePlan(plan);
  }

  return plan;
}

export function savePlan(plan) {
  const path = getPlanPath();
  plan.meta.updated = new Date().toISOString().split('T')[0];
  mkdirSync(dirname(path), { recursive: true });
  const raw = yaml.dump(plan, { lineWidth: 120, quotingType: '"', forceQuotes: false });
  writeFileSync(path, SCHEMA_COMMENT + raw, 'utf8');
}

export function ensureOutputDir() {
  mkdirSync(getOutputDir(), { recursive: true });
}

export function writeOutput(filename, content) {
  ensureOutputDir();
  writeFileSync(join(getOutputDir(), filename), content, 'utf8');
}

/** Create a dated iteration snapshot directory */
export function createIterationDir() {
  const base = join(getIterationsDir(), new Date().toISOString().split('T')[0]);
  let dir = base;
  let suffix = 1;
  while (existsSync(dir)) {
    suffix++;
    dir = `${base}-v${suffix}`;
  }
  mkdirSync(join(dir, 'output'), { recursive: true });
  return dir;
}

/** Copy current plan.yaml into the iteration directory */
export function snapshotPlan(iterDir) {
  copyFileSync(getPlanPath(), join(iterDir, 'plan.yaml'));
}

/** Write artifact to an iteration's output directory */
export function writeIterationOutput(iterDir, filename, content) {
  writeFileSync(join(iterDir, 'output', filename), content, 'utf8');
}
