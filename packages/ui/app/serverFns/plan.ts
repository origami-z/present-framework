import { createServerFn } from '@tanstack/react-start'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import yaml from 'js-yaml'

const PLAN_ROOT = process.env.PLAN_ROOT || process.cwd()
const PLAN_FOLDER = process.env.PLAN_FOLDER || 'data'

// Generators are part of the package itself, not the user's project.
// Use import.meta.url so this resolves correctly when npm linked.
const _dirname = dirname(fileURLToPath(import.meta.url))
const GENERATORS_DIR = join(_dirname, '../../../cli/src/generators')

function getPlanPath() {
  return join(PLAN_ROOT, PLAN_FOLDER, 'plan.yaml')
}

export const getPlan = createServerFn({ method: 'GET' }).handler(async () => {
  const path = getPlanPath()
  if (!existsSync(path)) {
    throw new Error('No plan.yaml found. Run `present init` to create one.')
  }
  const raw = readFileSync(path, 'utf8')
  return yaml.load(raw) as any
})

export const savePlan = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => data as any)
  .handler(async ({ data }) => {
    const path = getPlanPath()
    mkdirSync(dirname(path), { recursive: true })
    const updated = {
      ...(data as any),
      meta: {
        ...(data as any).meta,
        updated: new Date().toISOString().split('T')[0],
      },
    }
    const SCHEMA_COMMENT =
      '# yaml-language-server: $schema=../schema/plan.schema.json\n' +
      '# Edit this file directly — IDE autocomplete is enabled via the schema above.\n\n'
    const raw = yaml.dump(updated, { lineWidth: 120 })
    writeFileSync(path, SCHEMA_COMMENT + raw, 'utf8')
    return updated
  })

export const generateArtifacts = createServerFn({ method: 'POST' })
  .inputValidator((data: { type: 'diagram' | 'report' | 'deck' | 'all' }) => data)
  .handler(async ({ data }) => {
    // Import CLI generators (relative path from ui to cli)
    const planPath = getPlanPath()
    const raw = readFileSync(planPath, 'utf8')
    const plan = yaml.load(raw) as any

    const outputDir = join(PLAN_ROOT, 'output')
    mkdirSync(outputDir, { recursive: true })

    const results: Record<string, string> = {}

    const { generateMermaid } = await import(
      /* @vite-ignore */ pathToFileURL(join(GENERATORS_DIR, 'mermaid.js')).href
    )
    const { generateReport } = await import(
      /* @vite-ignore */ pathToFileURL(join(GENERATORS_DIR, 'report.js')).href
    )
    const { generateDeck } = await import(
      /* @vite-ignore */ pathToFileURL(join(GENERATORS_DIR, 'deck.js')).href
    )

    if (data.type === 'diagram' || data.type === 'all') {
      const content = generateMermaid(plan)
      writeFileSync(join(outputDir, 'diagram.md'), content, 'utf8')
      results.diagram = content
    }
    if (data.type === 'report' || data.type === 'all') {
      const content = generateReport(plan)
      writeFileSync(join(outputDir, 'report.md'), content, 'utf8')
      results.report = content
    }
    if (data.type === 'deck' || data.type === 'all') {
      const content = generateDeck(plan)
      writeFileSync(join(outputDir, 'deck.html'), content, 'utf8')
      results.deck = content
    }

    return results
  })

export const runIterate = createServerFn({ method: 'POST' }).handler(async () => {
  const { execSync } = await import('child_process')
  try {
    execSync(`node packages/cli/src/index.js iterate --no-commit`, {
      cwd: PLAN_ROOT,
      stdio: 'pipe',
    })
    return { ok: true }
  } catch (err: any) {
    throw new Error(err.stderr?.toString() || err.message)
  }
})
