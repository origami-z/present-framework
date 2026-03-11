#!/usr/bin/env node
import { config as loadDotenv } from "dotenv";
import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Load .env from the directory where the CLI is invoked, before any dynamic imports
loadDotenv({ path: join(process.cwd(), ".env") });

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8"));

const program = new Command();

program
  .name("present")
  .description("AI-powered long-term technical planning framework")
  .version(pkg.version);

const { initCommand } = await import("./commands/init.js");
const { statusCommand } = await import("./commands/status.js");
const { addCommand } = await import("./commands/add.js");
const { updateCommand } = await import("./commands/update.js");
const { generateCommand } = await import("./commands/generate.js");
const { brainstormCommand } = await import("./commands/brainstorm.js");
const { iterateCommand } = await import("./commands/iterate.js");
const { uiCommand } = await import("./commands/ui.js");

initCommand(program);
statusCommand(program);
addCommand(program);
updateCommand(program);
generateCommand(program);
brainstormCommand(program);
iterateCommand(program);
uiCommand(program);

program.parse();
