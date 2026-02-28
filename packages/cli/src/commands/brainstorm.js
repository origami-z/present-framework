import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadPlan, savePlan } from '../storage.js';
import { brainstorm } from '../ai.js';
import { defaultTask, generateId, allTaskIds, today } from '../models.js';

export function brainstormCommand(program) {
  program
    .command('brainstorm <pillar-id>')
    .description('Use AI to suggest new tasks and dependencies for a pillar')
    .action(async (pillarId) => {
      const plan = loadPlan();
      const pillar = plan.pillars.find((p) => p.id === pillarId);
      if (!pillar) {
        console.error(chalk.red(`Pillar "${pillarId}" not found.`));
        console.log(chalk.dim('Available: ' + plan.pillars.map((p) => p.id).join(', ')));
        process.exit(1);
      }

      const provider = plan.ai?.provider || 'none';
      console.log(chalk.bold.cyan(`\n🤖 Brainstorming for pillar: ${pillar.name}`));
      console.log(chalk.dim(`   Provider: ${provider} · Model: ${plan.ai?.model || 'default'}\n`));

      let result;
      try {
        const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        const iv = setInterval(() => {
          process.stdout.write(`\r   ${spinner[i++ % spinner.length]} Asking AI...`);
        }, 100);
        result = await brainstorm(pillar, plan);
        clearInterval(iv);
        process.stdout.write('\r   ✅ Got response!          \n\n');
      } catch (err) {
        console.error(chalk.red(`\n❌ AI error: ${err.message}\n`));
        process.exit(1);
      }

      // Show risks first
      if (result.risks?.length) {
        console.log(chalk.bold.yellow('⚠️  Risks / Blockers to Consider:'));
        result.risks.forEach((r) => console.log(chalk.yellow(`  • ${r}`)));
        console.log();
      }

      // Show dependency suggestions
      if (result.dependency_suggestions?.length) {
        console.log(chalk.bold('🔗 Suggested Dependencies Between Existing Tasks:'));
        result.dependency_suggestions.forEach((d) =>
          console.log(chalk.dim(`  ${d.from} → ${d.to}`) + chalk.white(`  (${d.reason})`)
        ));
        console.log();

        const { applyDeps } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'applyDeps',
            message: 'Apply these dependency suggestions?',
            default: false,
          },
        ]);

        if (applyDeps) {
          for (const dep of result.dependency_suggestions) {
            for (const p of plan.pillars) {
              const task = p.tasks.find((t) => t.id === dep.to);
              if (task && !task.dependencies.includes(dep.from)) {
                task.dependencies.push(dep.from);
                task.updated = today();
              }
            }
          }
          console.log(chalk.green('  ✅ Dependencies applied.'));
        }
        console.log();
      }

      // Show new task suggestions
      if (!result.suggestions?.length) {
        console.log(chalk.yellow('No new task suggestions returned.'));
        return;
      }

      console.log(chalk.bold('💡 Suggested New Tasks:'));
      result.suggestions.forEach((s, i) => {
        console.log(
          chalk.cyan(`  ${i + 1}. [${s.priority?.toUpperCase() || 'MEDIUM'}] ${s.title}`)
        );
        console.log(chalk.dim(`     ${s.description}`));
        console.log(chalk.dim(`     Why: ${s.rationale}`));
        if (s.suggested_dependencies?.length) {
          console.log(chalk.dim(`     Deps: ${s.suggested_dependencies.join(', ')}`));
        }
        console.log();
      });

      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: 'Select tasks to add:',
          choices: result.suggestions.map((s, i) => ({
            name: `[${s.priority?.toUpperCase() || 'MEDIUM'}] ${s.title}`,
            value: i,
            checked: false,
          })),
        },
      ]);

      if (selected.length === 0) {
        console.log(chalk.dim('\nNo tasks selected. Nothing added.\n'));
        return;
      }

      const existing = allTaskIds(plan);
      const prefix = pillarId.slice(0, 8);

      for (const idx of selected) {
        const s = result.suggestions[idx];
        const id = generateId(prefix, [...existing, ...pillar.tasks.map((t) => t.id)]);
        const task = defaultTask(id);
        task.title = s.title;
        task.description = s.description || '';
        task.priority = ['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium';
        task.dependencies = (s.suggested_dependencies || []).filter((d) => existing.includes(d));
        existing.push(id);
        pillar.tasks.push(task);
      }

      savePlan(plan);
      console.log(chalk.green(`\n✅ Added ${selected.length} task(s) to "${pillar.name}"\n`));
    });
}
