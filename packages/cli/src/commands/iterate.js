import chalk from "chalk";
import { execSync } from "child_process";
import {
  loadPlan,
  savePlan,
  createIterationDir,
  snapshotPlan,
  writeIterationOutput,
  writeOutput,
  getPlanFolderPath,
} from "../storage.js";
import { generateMermaid } from "../generators/mermaid.js";
import { generateReport } from "../generators/report.js";
import { generateDeck } from "../generators/deck.js";

function getDeckOptions(opts = {}) {
  return {
    recentMonths: opts.recentMonths,
    nextMonths: opts.nextMonths,
  };
}

export function iterateCommand(program) {
  program
    .command("iterate")
    .description("Snapshot current plan and generate all artifacts")
    .option("--no-commit", "Skip the automatic git commit")
    .option("--recent-months <number>", "Months to include in the recent-completions summary", "1")
    .option("--next-months <number>", "Months to include in the upcoming-work summary", "3")
    .action(async (opts) => {
      const plan = loadPlan();

      console.log(chalk.bold.cyan("\n📸 Creating iteration snapshot...\n"));

      // Create dated directory
      const iterDir = createIterationDir();
      const iterName = iterDir.split("/").pop();
      console.log(chalk.dim(`   Directory: ${iterDir}`));

      // Snapshot plan.yaml
      snapshotPlan(iterDir);
      console.log(chalk.green("  ✅ plan.yaml copied"));

      // Generate all artifacts
      console.log(chalk.bold("\n⚡ Generating artifacts...\n"));

      const diagram = generateMermaid(plan);
      const report = generateReport(plan);
      const deck = generateDeck(plan, getDeckOptions(opts));

      // Write to iteration dir
      writeIterationOutput(iterDir, "diagram.md", diagram);
      writeIterationOutput(iterDir, "report.md", report);
      writeIterationOutput(iterDir, "deck.html", deck);
      console.log(chalk.green(`  ✅ ${iterName}/output/diagram.md`));
      console.log(chalk.green(`  ✅ ${iterName}/output/report.md`));
      console.log(chalk.green(`  ✅ ${iterName}/output/deck.html`));

      // Also update the top-level output/
      writeOutput("diagram.md", diagram);
      writeOutput("report.md", report);
      writeOutput("deck.html", deck);
      console.log(chalk.green("  ✅ output/ (latest) updated"));

      // Bump version
      plan.meta.version = (plan.meta.version || 0) + 1;
      savePlan(plan);
      console.log(chalk.green(`  ✅ Version bumped to v${plan.meta.version}`));

      // Git commit
      if (opts.commit !== false) {
        try {
          const planFolder = getPlanFolderPath();

          // Initialize a git repo in PLAN_FOLDER if one doesn't exist yet
          let isNewRepo = false;
          try {
            execSync("git rev-parse --git-dir", { cwd: planFolder, stdio: "pipe" });
          } catch {
            execSync("git init", { cwd: planFolder, stdio: "pipe" });
            isNewRepo = true;
            console.log(chalk.green(`\n  ✅ Git repo initialized in ${planFolder}`));
          }

          execSync("git add -A", { cwd: planFolder, stdio: "pipe" });
          const msg = `Iteration snapshot ${iterName} (v${plan.meta.version})`;
          execSync(`git commit -m "${msg}"`, { cwd: planFolder, stdio: "pipe" });
          if (!isNewRepo) console.log("");
          console.log(chalk.green(`  ✅ Git commit: "${msg}"`));
        } catch (err) {
          console.log(
            chalk.yellow("\n  ⚠️  Git commit failed (repo may have no changes or no git):"),
          );
          console.log(chalk.dim(`     ${err.message?.split("\n")[0]}`));
        }
      } else {
        console.log(chalk.dim("\n  ⏭  Git commit skipped (--no-commit)"));
      }

      console.log(chalk.bold.green(`\n✨ Iteration ${iterName} complete!\n`));
    });
}
