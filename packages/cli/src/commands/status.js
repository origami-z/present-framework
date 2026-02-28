import chalk from 'chalk';
import { loadPlan } from '../storage.js';
import { EVALUATION_EMOJI, STATUS_LABEL, pillarStats, planStats } from '../models.js';

function padEnd(str, len) {
  const clean = str.replace(/\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]/g, '  ');
  const visLen = clean.length;
  return str + ' '.repeat(Math.max(0, len - visLen));
}

function statusChip(status) {
  const chips = {
    todo: chalk.white.bgGray(' todo '),
    wip: chalk.white.bgBlue(' wip  '),
    done: chalk.black.bgGreen(' done '),
    archive: chalk.white.bgBlackBright(' arch '),
  };
  return chips[status] || status;
}

function priorityColor(priority) {
  if (priority === 'high') return chalk.red(priority);
  if (priority === 'medium') return chalk.yellow(priority);
  return chalk.dim(priority);
}

export function statusCommand(program) {
  program
    .command('status')
    .description('Show current plan status across all pillars')
    .option('-p, --pillar <id>', 'Show only a specific pillar')
    .action((opts) => {
      const plan = loadPlan();
      const overall = planStats(plan);

      console.log(chalk.bold.cyan(`\n📋 ${plan.meta.title}`));
      console.log(
        chalk.dim(
          `   ${plan.meta.owner} · v${plan.meta.version} · updated ${plan.meta.updated}`
        )
      );
      console.log(
        chalk.bold(
          `\n   Progress: ${overall.done}/${overall.total} done (${overall.pct}%) · ` +
            `${overall.wip} wip · ${overall.todo} todo\n`
        )
      );

      const pillars = opts.pillar
        ? plan.pillars.filter((p) => p.id === opts.pillar)
        : plan.pillars;

      if (pillars.length === 0) {
        console.log(chalk.yellow('  No pillars found. Run `present add pillar` to create one.'));
        return;
      }

      for (const pillar of pillars) {
        const stats = pillarStats(pillar);
        console.log(
          chalk.bold.yellow(`  ▶ ${pillar.name}`) +
            chalk.dim(
              `  (${stats.done} done · ${stats.wip} wip · ${stats.todo} todo · ${stats.archive} archived)`
            )
        );

        if (pillar.tasks.length === 0) {
          console.log(chalk.dim('     No tasks yet. Run `present add task ' + pillar.id + '`'));
          console.log();
          continue;
        }

        // Header
        const COL = { id: 14, title: 32, status: 8, eval: 4, priority: 8, deps: 16 };
        const header =
          '  ' +
          chalk.dim(
            padEnd('ID', COL.id) +
              padEnd('Title', COL.title) +
              padEnd('Status', COL.status + 6) +
              'Eval ' +
              padEnd('Priority', COL.priority) +
              'Dependencies'
          );
        console.log(header);
        console.log(chalk.dim('  ' + '─'.repeat(90)));

        for (const task of pillar.tasks) {
          const evalEmoji = EVALUATION_EMOJI[task.evaluation] || '⬜';
          const deps = task.dependencies?.length ? task.dependencies.join(', ') : '—';
          const row =
            '  ' +
            chalk.dim(padEnd(task.id, COL.id)) +
            padEnd(task.title, COL.title) +
            statusChip(task.status) +
            '  ' +
            evalEmoji +
            '  ' +
            padEnd(priorityColor(task.priority), COL.priority + 10) +
            chalk.dim(deps);
          console.log(row);
        }
        console.log();
      }
    });
}
