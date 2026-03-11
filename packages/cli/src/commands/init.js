import inquirer from "inquirer";
import { existsSync } from "fs";
import chalk from "chalk";
import { defaultPlan, AI_PROVIDERS, DEFAULT_MODELS, defaultPillar, generateId } from "../models.js";
import { getPlanPath, savePlan } from "../storage.js";

export function initCommand(program) {
  program
    .command("init")
    .description("Initialize a new planning file interactively")
    .option("-f, --force", "Overwrite existing plan.yaml")
    .action(async (opts) => {
      const planPath = getPlanPath();
      if (existsSync(planPath) && !opts.force) {
        console.error(
          chalk.red(`plan.yaml already exists at ${planPath}. Use --force to overwrite.`),
        );
        process.exit(1);
      }

      console.log(chalk.bold.cyan("\n🚀 Welcome to Present — Technical Planning Framework\n"));

      const meta = await inquirer.prompt([
        {
          type: "input",
          name: "title",
          message: 'Plan title (e.g. "Q1 2025 Technical Roadmap"):',
          validate: (v) => v.trim().length > 0 || "Title is required",
        },
        {
          type: "input",
          name: "owner",
          message: "Owner / team name:",
          default: "Engineering Team",
        },
      ]);

      const { aiProvider } = await inquirer.prompt([
        {
          type: "list",
          name: "aiProvider",
          message: "AI provider for brainstorming:",
          choices: [
            { name: "Anthropic Claude  (ANTHROPIC_API_KEY)", value: "anthropic" },
            { name: "OpenAI            (OPENAI_API_KEY)", value: "openai" },
            { name: "GitHub Copilot    (GITHUB_TOKEN)", value: "github-copilot" },
            { name: "Ollama            (local, no key needed)", value: "ollama" },
            { name: "None / skip", value: "none" },
          ],
        },
      ]);

      const { aiModel } = await inquirer.prompt([
        {
          type: "input",
          name: "aiModel",
          message: "Model name:",
          default: DEFAULT_MODELS[aiProvider],
          when: aiProvider !== "none",
        },
      ]);

      console.log(chalk.dim("\nDescribe your current state (press Enter twice when done):"));
      const { currentState } = await inquirer.prompt([
        {
          type: "editor",
          name: "currentState",
          message: "Current state:",
          default: "Describe where your team/system is today...",
        },
      ]);

      console.log(chalk.dim("\nDescribe your target state (what does success look like?):"));
      const { targetState } = await inquirer.prompt([
        {
          type: "editor",
          name: "targetState",
          message: "Target state:",
          default: "Describe the desired future state...",
        },
      ]);

      const { addPillars } = await inquirer.prompt([
        {
          type: "confirm",
          name: "addPillars",
          message: "Add pillars now? (you can also run `present add pillar` later)",
          default: true,
        },
      ]);

      const pillars = [];
      if (addPillars) {
        let addMore = true;
        while (addMore) {
          const { name, description } = await inquirer.prompt([
            {
              type: "input",
              name: "name",
              message: `Pillar name (e.g. "Infrastructure", "Security", "Developer Experience"):`,
              validate: (v) => v.trim().length > 0 || "Name is required",
            },
            {
              type: "input",
              name: "description",
              message: "Short description (optional):",
            },
          ]);

          const id = generateId(
            name.toLowerCase().replace(/\s+/g, "-").slice(0, 12),
            pillars.map((p) => p.id),
          );
          const pillar = defaultPillar(id, name.trim());
          pillar.description = description.trim();
          pillars.push(pillar);

          const { more } = await inquirer.prompt([
            { type: "confirm", name: "more", message: "Add another pillar?", default: false },
          ]);
          addMore = more;
        }
      }

      const plan = defaultPlan(meta.title.trim(), meta.owner.trim());
      plan.ai.provider = aiProvider;
      plan.ai.model = aiModel || DEFAULT_MODELS[aiProvider] || "";
      plan.current_state = currentState.trim();
      plan.target_state = targetState.trim();
      plan.pillars = pillars;

      savePlan(plan);

      console.log(chalk.green(`\n✅ Plan created at ${getPlanPath()}`));
      console.log(chalk.dim("  Next steps:"));
      console.log(chalk.dim("  • present add task <pillar-id>   — add tasks"));
      console.log(chalk.dim("  • present status                 — view current state"));
      console.log(chalk.dim("  • present generate all           — generate artifacts"));
      console.log(chalk.dim("  • present brainstorm <pillar-id> — AI suggestions\n"));
    });
}
