import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  defaultPillar,
  defaultTask,
  generateId,
  allTaskIds,
  STATUSES,
  EVALUATIONS,
  PRIORITIES,
} from '../models.js';
import { loadPlan, savePlan } from '../storage.js';

export function addCommand(program) {
  const add = program.command('add').description('Add pillars or tasks to the plan');

  add
    .command('pillar')
    .description('Add a new pillar')
    .action(async () => {
      const plan = loadPlan();

      const { name, description } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Pillar name (e.g. "Security", "Developer Experience"):',
          validate: (v) => v.trim().length > 0 || 'Name is required',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Short description (optional):',
        },
      ]);

      const existingIds = plan.pillars.map((p) => p.id);
      const suggestedId = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 16);

      const { id } = await inquirer.prompt([
        {
          type: 'input',
          name: 'id',
          message: 'Pillar ID:',
          default: generateId(suggestedId, existingIds),
          validate: (v) => {
            if (!v.trim()) return 'ID is required';
            if (existingIds.includes(v.trim())) return `ID "${v}" already exists`;
            if (!/^[a-z0-9-]+$/.test(v.trim())) return 'ID must be lowercase alphanumeric with hyphens';
            return true;
          },
        },
      ]);

      const pillar = defaultPillar(id.trim(), name.trim());
      pillar.description = description.trim();
      plan.pillars.push(pillar);
      savePlan(plan);

      console.log(chalk.green(`\n✅ Pillar "${pillar.name}" added (id: ${pillar.id})`));
      console.log(chalk.dim(`   Run: present add task ${pillar.id}\n`));
    });

  add
    .command('task <pillar-id>')
    .description('Add a task to a pillar')
    .action(async (pillarId) => {
      const plan = loadPlan();
      const pillar = plan.pillars.find((p) => p.id === pillarId);
      if (!pillar) {
        console.error(chalk.red(`Pillar "${pillarId}" not found.`));
        console.log(chalk.dim('Available pillars: ' + plan.pillars.map((p) => p.id).join(', ')));
        process.exit(1);
      }

      const existing = allTaskIds(plan);

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'title',
          message: 'Task title:',
          validate: (v) => v.trim().length > 0 || 'Title is required',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description (optional):',
        },
        {
          type: 'list',
          name: 'status',
          message: 'Status:',
          choices: STATUSES,
          default: 'todo',
        },
        {
          type: 'list',
          name: 'evaluation',
          message: 'Evaluation:',
          choices: [
            { name: '⬜ not_started', value: 'not_started' },
            { name: '🟢 on_track', value: 'on_track' },
            { name: '🟡 needs_attention', value: 'needs_attention' },
            { name: '🔴 at_risk', value: 'at_risk' },
            { name: '⛔ blocked', value: 'blocked' },
            { name: '⭐ exceeds', value: 'exceeds' },
          ],
          default: 'not_started',
        },
        {
          type: 'list',
          name: 'priority',
          message: 'Priority:',
          choices: PRIORITIES,
          default: 'medium',
        },
        {
          type: 'checkbox',
          name: 'dependencies',
          message: 'Dependencies (tasks this depends on):',
          choices: existing.map((id) => ({ name: id, value: id })),
          when: existing.length > 0,
        },
        {
          type: 'input',
          name: 'notes',
          message: 'Notes (optional):',
        },
      ]);

      const suggestedPrefix = pillarId.slice(0, 8);
      const taskId = generateId(suggestedPrefix, existing);

      const task = defaultTask(taskId);
      task.title = answers.title.trim();
      task.description = answers.description?.trim() || '';
      task.status = answers.status;
      task.evaluation = answers.evaluation;
      task.priority = answers.priority;
      task.dependencies = answers.dependencies || [];
      task.notes = answers.notes?.trim() || '';

      pillar.tasks.push(task);
      savePlan(plan);

      console.log(chalk.green(`\n✅ Task "${task.title}" added to "${pillar.name}" (id: ${task.id})\n`));
    });
}
