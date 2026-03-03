function safeId(id) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function nodeLabel(task) {
  const title = task.title.replace(/"/g, "'").replace(/\n/g, ' ');
  return `["${title}"]`;
}

export function generateMermaid(plan) {
  const lines = [];
  lines.push('```mermaid');
  lines.push('graph TD');
  lines.push('');

  // Status class definitions
  lines.push('  classDef todo fill:#e0e0e0,stroke:#9e9e9e,color:#333333');
  lines.push('  classDef wip fill:#bbdefb,stroke:#1976d2,color:#0d47a1');
  lines.push('  classDef done fill:#c8e6c9,stroke:#388e3c,color:#1b5e20');
  lines.push('  classDef archive fill:#f5f5f5,stroke:#bdbdbd,color:#9e9e9e,opacity:0.6');
  lines.push('');

  const allIds = plan.pillars.flatMap((p) => p.tasks.map((t) => t.id));

  for (const pillar of plan.pillars) {
    const safePillar = safeId(pillar.id);
    lines.push(`  subgraph ${safePillar}["🏛 ${pillar.name}"]`);
    for (const task of pillar.tasks) {
      const safeTask = safeId(task.id);
      lines.push(`    ${safeTask}${nodeLabel(task)}`);
      lines.push(`    class ${safeTask} ${task.status}`);
    }
    lines.push('  end');
    lines.push('');
  }

  // Dependency edges
  for (const pillar of plan.pillars) {
    for (const task of pillar.tasks) {
      for (const dep of task.dependencies || []) {
        if (allIds.includes(dep)) {
          lines.push(`  ${safeId(dep)} --> ${safeId(task.id)}`);
        }
      }
    }
  }

  lines.push('```');
  return lines.join('\n');
}
