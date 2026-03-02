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

export function loadPlan() {
  const path = getPlanPath();
  if (!existsSync(path)) {
    throw new Error(`No plan.yaml found. Run 'present init' to create one.`);
  }
  const raw = readFileSync(path, 'utf8');
  return yaml.load(raw);
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
