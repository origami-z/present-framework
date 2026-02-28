# Editing Your Plan File

The `plan.yaml` file is designed to be human-readable and editable directly in your IDE.

## IDE Setup

### VS Code
1. Install the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)
2. The `# yaml-language-server: $schema=` comment at the top of `plan.yaml` activates autocomplete automatically.
3. You'll get dropdown suggestions for `status`, `evaluation`, `priority`, and `ai.provider` fields.

### JetBrains IDEs
1. Go to **Settings → Languages & Frameworks → Schemas and DTDs → JSON Schema Mappings**
2. Add a mapping: file pattern `data/plan.yaml` → schema file `schema/plan.schema.json`

### Neovim (with LSP)
Add to your config:
```lua
require('lspconfig').yamlls.setup({
  settings = {
    yaml = {
      schemas = {
        ["./schema/plan.schema.json"] = "data/plan.yaml",
      },
    },
  },
})
```

---

## YAML Field Reference

### Task Fields

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `id` | string | e.g. `infra-001` | Unique ID (used in dependencies) |
| `title` | string | max 80 chars | Short task title |
| `description` | string | free text | Detailed description |
| `status` | enum | `todo` `wip` `done` `archive` | Current lifecycle stage |
| `evaluation` | enum | see below | Health/progress assessment |
| `priority` | enum | `high` `medium` `low` | Task priority |
| `dependencies` | list | task IDs | Tasks that must complete first |
| `notes` | string | free text | Notes, links, blockers |

### Evaluation Values

| Value | Emoji | Meaning |
|-------|-------|---------|
| `not_started` | ⬜ | No evaluation yet (default for new tasks) |
| `on_track` | 🟢 | Progressing as expected |
| `needs_attention` | 🟡 | Minor concerns, watching closely |
| `at_risk` | 🔴 | Behind schedule or at risk |
| `blocked` | ⛔ | Blocked on something external |
| `exceeds` | ⭐ | Ahead of plan |

---

## GitHub Copilot Chat Prompts

Open `plan.yaml` in VS Code with Copilot enabled, then use these prompts in Copilot Chat:

**Brainstorming:**
```
Suggest 3 more tasks for the [pillar name] pillar in my plan.yaml
```

**Dependency analysis:**
```
Looking at my plan.yaml, what task dependencies am I missing?
Are there any circular dependencies?
```

**Status updates:**
```
Update task infra-002 status to done and evaluation to on_track
```

**Progress summary:**
```
Summarize the current state of my engineering plan.
Which pillars are on track and which are at risk?
```

**Identifying blockers:**
```
Which tasks in my plan are blocked or at risk?
What should I prioritize to unblock them?
```

**Adding a new task (dict format to paste into YAML):**
```
Create a new task YAML entry for "Set up database backups" in the infrastructure pillar,
following the schema in plan.schema.json
```

---

## Adding Items Manually

### Add a pillar
```yaml
pillars:
  - id: my-new-pillar        # lowercase-with-hyphens
    name: "My New Pillar"
    description: "What this pillar is about"
    tasks: []
```

### Add a task
```yaml
tasks:
  - id: mypillar-001
    title: "Task title here"
    description: "What needs to be done"
    status: todo              # todo | wip | done | archive
    evaluation: not_started   # see table above
    priority: medium          # high | medium | low
    created: "2025-01-01"
    updated: "2025-01-01"
    dependencies: []          # or: [other-task-id]
    notes: ""
```

---

## CLI Quick Reference

```bash
present init                          # Create plan.yaml interactively
present status                        # View all pillars and tasks
present add pillar                    # Add a new pillar
present add task <pillar-id>          # Add a task interactively
present update <task-id> --status wip # Update task status
present update <task-id> --evaluation on_track
present brainstorm <pillar-id>        # AI-powered task suggestions
present generate all                  # Generate diagram, report, and deck
present iterate                       # Snapshot + generate + git commit
present ui                            # Open browser UI
```
