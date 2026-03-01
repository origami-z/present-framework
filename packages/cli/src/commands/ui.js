import chalk from 'chalk';
import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getProjectRoot } from '../storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function uiCommand(program) {
  program
    .command('ui')
    .description('Start the browser-based planning UI (TanStack Router + Vite + Express)')
    .option('--ui-port <port>', 'Vite dev server port', '5173')
    .option('--api-port <port>', 'API server port', '3001')
    .action((opts) => {
      const uiDir = join(__dirname, '../../../..', 'packages/ui');
      if (!existsSync(uiDir)) {
        console.error(chalk.red('UI package not found at ' + uiDir));
        console.log(chalk.dim('Run `npm install` from the project root first.'));
        process.exit(1);
      }

      console.log(chalk.bold.cyan('\n🌐 Starting Present UI...\n'));
      console.log(chalk.dim(`   API  → http://localhost:${opts.apiPort}`));
      console.log(chalk.dim(`   UI   → http://localhost:${opts.uiPort}`));
      console.log(chalk.dim(`   Press Ctrl+C to stop\n`));

      const proc = spawn('npm', ['run', 'dev'], {
        cwd: uiDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          VITE_PORT: opts.uiPort,
          API_PORT: opts.apiPort,
          PLAN_ROOT: getProjectRoot(),
          PLAN_FOLDER: process.env.PLAN_FOLDER || 'data',
        },
        shell: true,
      });

      proc.on('error', (err) => {
        console.error(chalk.red(`Failed to start UI: ${err.message}`));
        console.log(chalk.dim('Make sure you ran `npm install` from the project root.'));
      });

      proc.on('close', (code) => {
        if (code !== 0) console.log(chalk.yellow(`\nUI process exited with code ${code}`));
      });
    });
}
