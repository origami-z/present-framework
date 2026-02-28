import chalk from 'chalk';
import { loadPlan, writeOutput } from '../storage.js';
import { generateMermaid } from '../generators/mermaid.js';
import { generateReport } from '../generators/report.js';
import { generateDeck } from '../generators/deck.js';

async function runGenerate(type, plan) {
  switch (type) {
    case 'diagram': {
      const content = generateMermaid(plan);
      writeOutput('diagram.md', content);
      console.log(chalk.green('  ✅ output/diagram.md'));
      return content;
    }
    case 'report': {
      const content = generateReport(plan);
      writeOutput('report.md', content);
      console.log(chalk.green('  ✅ output/report.md'));
      return content;
    }
    case 'deck': {
      const content = generateDeck(plan);
      writeOutput('deck.html', content);
      console.log(chalk.green('  ✅ output/deck.html'));
      return content;
    }
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

export { runGenerate };

export function generateCommand(program) {
  const gen = program.command('generate').description('Generate planning artifacts');

  gen
    .command('diagram')
    .description('Generate Mermaid dependency diagram → output/diagram.md')
    .action(() => {
      const plan = loadPlan();
      console.log(chalk.bold('\n🔷 Generating diagram...\n'));
      runGenerate('diagram', plan);
      console.log();
    });

  gen
    .command('report')
    .description('Generate Markdown status report → output/report.md')
    .action(() => {
      const plan = loadPlan();
      console.log(chalk.bold('\n📄 Generating report...\n'));
      runGenerate('report', plan);
      console.log();
    });

  gen
    .command('deck')
    .description('Generate reveal.js presentation → output/deck.html')
    .action(() => {
      const plan = loadPlan();
      console.log(chalk.bold('\n🎨 Generating deck...\n'));
      runGenerate('deck', plan);
      console.log();
    });

  gen
    .command('all')
    .description('Generate all 3 artifacts')
    .action(async () => {
      const plan = loadPlan();
      console.log(chalk.bold('\n⚡ Generating all artifacts...\n'));
      await runGenerate('diagram', plan);
      await runGenerate('report', plan);
      await runGenerate('deck', plan);
      console.log(chalk.bold.green('\n✨ Done! Open output/ to view the artifacts.\n'));
    });
}
