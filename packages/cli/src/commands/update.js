import chalk from 'chalk';
import { loadPlan, savePlan } from '../storage.js';
import { findTask, STATUSES, EVALUATIONS, PRIORITIES, today } from '../models.js';

export function updateCommand(program) {
  program
    .command('update <task-id>')
    .description('Update a task\'s status, evaluation, priority, or notes')
    .option('-s, --status <status>', `New status (${STATUSES.join('|')})`)
    .option('-e, --evaluation <eval>', `New evaluation (${EVALUATIONS.join('|')})`)
    .option('-p, --priority <priority>', `New priority (${PRIORITIES.join('|')})`)
    .option('-n, --notes <notes>', 'Update notes')
    .option('-d, --deps <ids>', 'Comma-separated dependency IDs (replaces existing)')
    .action((taskId, opts) => {
      const plan = loadPlan();
      const found = findTask(plan, taskId);
      if (!found) {
        console.error(chalk.red(`Task "${taskId}" not found.`));
        process.exit(1);
      }

      const { task } = found;
      let changed = false;

      if (opts.status) {
        if (!STATUSES.includes(opts.status)) {
          console.error(chalk.red(`Invalid status "${opts.status}". Valid: ${STATUSES.join(', ')}`));
          process.exit(1);
        }
        task.status = opts.status;
        changed = true;
      }

      if (opts.evaluation) {
        if (!EVALUATIONS.includes(opts.evaluation)) {
          console.error(chalk.red(`Invalid evaluation "${opts.evaluation}". Valid: ${EVALUATIONS.join(', ')}`));
          process.exit(1);
        }
        task.evaluation = opts.evaluation;
        changed = true;
      }

      if (opts.priority) {
        if (!PRIORITIES.includes(opts.priority)) {
          console.error(chalk.red(`Invalid priority "${opts.priority}". Valid: ${PRIORITIES.join(', ')}`));
          process.exit(1);
        }
        task.priority = opts.priority;
        changed = true;
      }

      if (opts.notes !== undefined) {
        task.notes = opts.notes;
        changed = true;
      }

      if (opts.deps !== undefined) {
        task.dependencies = opts.deps ? opts.deps.split(',').map((d) => d.trim()) : [];
        changed = true;
      }

      if (!changed) {
        console.log(chalk.yellow('No changes specified. Use --status, --evaluation, --priority, --notes, or --deps.'));
        return;
      }

      task.updated = today();
      savePlan(plan);

      console.log(chalk.green(`\n✅ Task "${task.id}" updated:`));
      console.log(`   status:     ${task.status}`);
      console.log(`   evaluation: ${task.evaluation}`);
      console.log(`   priority:   ${task.priority}`);
      if (task.notes) console.log(`   notes:      ${task.notes}`);
      console.log();
    });
}
