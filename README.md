# Present — AI-Powered Technical Planning Framework

A CLI + web UI for long-term technical planning. Capture current state, define target goals, organize work into pillars, track task status, and generate shareable artifacts — all version-controlled in a single YAML file.

---

## Features

- **Structured planning** — pillars, tasks, statuses, evaluation emojis, dependencies
- **AI brainstorming** — suggest tasks and dependencies using Anthropic, OpenAI, GitHub Copilot, or Ollama
- **Version-controlled** — `plan.yaml` is human-readable and git-trackable (folder is configurable)
- **Iteration snapshots** — dated snapshots with auto-generated artifacts and git commits
- **3 generated artifacts** per iteration:
  1. `output/diagram.md` — Mermaid dependency graph
  2. `output/report.md` — Markdown status report
  3. `output/deck.html` — reveal.js presentation (opens in browser)
- **Browser UI** — TanStack Start full-stack app (Vite + React + SSR) for visual editing and preview

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Initialize your plan
node packages/cli/src/index.js init

# 3. Add pillars and tasks
node packages/cli/src/index.js add pillar
node packages/cli/src/index.js add task <pillar-id>

# 4. View current status
node packages/cli/src/index.js status

# 5. Generate all artifacts
node packages/cli/src/index.js generate all

# 6. Open output/deck.html in your browser to view the presentation
```

### (Optional) Install CLI globally

```bash
npm link --workspace=packages/cli
# Now you can use `present` directly:
present status
present generate all
```

---

## CLI Commands

| Command | Description |
|---|---|
| `present init` | Create `plan.yaml` interactively (inside `PLAN_FOLDER`) |
| `present status` | Display all pillars and tasks with status/evaluation |
| `present add pillar` | Add a new pillar |
| `present add task <pillar-id>` | Add a task to a pillar |
| `present update <task-id> [--status] [--evaluation]` | Update task fields |
| `present brainstorm <pillar-id>` | AI-powered task suggestions |
| `present generate diagram` | → `output/diagram.md` |
| `present generate report` | → `output/report.md` |
| `present generate deck` | → `output/deck.html` |
| `present generate all` | Generate all 3 artifacts |
| `present iterate [--no-commit]` | Snapshot + generate + git commit |
| `present ui` | Start browser UI |

---

## Data Model

`plan.yaml` (inside `PLAN_FOLDER`, default `data/`) is the single source of truth. It has a JSON Schema (`schema/plan.schema.json`) for IDE autocomplete.

### Task Fields

| Field | Values | Description |
|---|---|---|
| `status` | `todo` `wip` `done` `archive` | Lifecycle stage |
| `evaluation` | see below | Health assessment emoji |
| `priority` | `high` `medium` `low` | Task priority |
| `dependencies` | list of task IDs | Blocking tasks |

### Evaluation Emojis

| Value | Emoji |
|---|---|
| `not_started` | ⬜ |
| `on_track` | 🟢 |
| `needs_attention` | 🟡 |
| `at_risk` | 🔴 |
| `blocked` | ⛔ |
| `exceeds` | ⭐ |

---

## Configuration

The CLI loads a `.env` file from the directory where you run `present` commands. Create one to avoid exporting variables in your shell:

```dotenv
# .env (in your project directory)
PLAN_FOLDER=plans          # subfolder that contains plan.yaml (default: data)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=ghp_...
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PLAN_FOLDER` | `data` | Subfolder (relative to project root) where `plan.yaml` lives |
| `ANTHROPIC_API_KEY` | — | API key for Anthropic provider |
| `OPENAI_API_KEY` | — | API key for OpenAI provider |
| `GITHUB_TOKEN` | — | Token for GitHub Copilot provider |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL for Ollama |

---

## AI Brainstorming

Configure your provider in `plan.yaml` (inside your `PLAN_FOLDER`):

```yaml
ai:
  provider: anthropic          # anthropic | openai | github-copilot | ollama | none
  model: claude-sonnet-4-6
```

Set the corresponding key in your `.env` file (or shell) and run:

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-... present brainstorm infrastructure

# GitHub Copilot
GITHUB_TOKEN=ghp_... present brainstorm security

# Ollama (local, no key needed)
present brainstorm developer-experience
```

---

## Iteration Tracking

```bash
present iterate
# Creates iterations/2026-02-28/ with:
#   plan.yaml  (snapshot)
#   output/diagram.md
#   output/report.md
#   output/deck.html
# Bumps meta.version and creates a git commit
```

View history with `git log --oneline`.

---

## Browser UI

The UI is a TanStack Start full-stack app with server-side rendering, powered by Vite and React 19.

```bash
# Development
cd packages/ui
npm run dev
# http://localhost:3001

# Production
npm run build
npm run start
```

Or via the CLI:

```bash
present ui
# http://localhost:3001
```

Features:
- Left panel: edit `current_state`, `target_state`, pillars, and tasks inline
- Right panel: live preview tabs — Diagram | Report | Deck
- Auto-saves changes with debounce
- "Generate All" button updates all previews
- "Iterate" button creates a snapshot
- Server-side rendering via TanStack Start with server functions for plan data

---

## IDE Setup (VS Code)

1. Install the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)
2. Open your `plan.yaml` — autocomplete activates via the `# yaml-language-server:` comment
3. Use GitHub Copilot Chat:
   ```
   "Suggest 3 more tasks for the security pillar"
   "What dependencies am I missing between these tasks?"
   ```

See `EDITING_GUIDE.md` (inside your plan folder) for more Copilot Chat prompts.

---

## Project Structure

```
present-framework/
├── .env                       # Optional: PLAN_FOLDER, API keys, etc. (not committed)
├── data/                      # Default plan folder (set PLAN_FOLDER to change)
│   ├── plan.yaml              # Your planning data (edit this)
│   └── example_plan.yaml      # Reference example
├── schema/
│   └── plan.schema.json       # JSON Schema (IDE autocomplete)
├── templates/
│   ├── report.md.hbs          # Status report template
│   └── deck.html.hbs          # Presentation deck template
├── output/                    # Latest generated artifacts
├── iterations/                # Dated snapshots
├── packages/
│   ├── cli/                   # Node.js CLI
│   └── ui/                    # TanStack Start full-stack app (Vite + React 19 + SSR)
│       ├── app/
│       │   ├── routes/        # File-based routes (TanStack Router)
│       │   ├── components/    # React Aria UI components
│       │   ├── serverFns/     # TanStack Start server functions
│       │   └── styles/        # CSS
│       └── vite.config.ts     # Vite + TanStack Start plugin config
└── README.md
```
