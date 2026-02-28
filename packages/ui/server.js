/**
 * Present UI — Express API Server (port 3001)
 *
 * Provides REST endpoints for reading/writing plan.yaml and triggering generators.
 * The Vite dev server (port 5173) proxies /api/* requests here.
 */
import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = process.env.PLAN_ROOT || join(__dirname, '../..')

function getPlanPath() {
  return join(PROJECT_ROOT, 'data', 'plan.yaml')
}

function loadPlan() {
  const path = getPlanPath()
  if (!existsSync(path)) {
    throw new Error('No plan.yaml found. Run `present init` first.')
  }
  return yaml.load(readFileSync(path, 'utf8'))
}

function writePlan(plan) {
  const path = getPlanPath()
  const updated = { ...plan, meta: { ...plan.meta, updated: new Date().toISOString().split('T')[0] } }
  const SCHEMA_COMMENT =
    '# yaml-language-server: $schema=../schema/plan.schema.json\n' +
    '# Edit this file directly — IDE autocomplete is enabled via the schema above.\n\n'
  const raw = yaml.dump(updated, { lineWidth: 120 })
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, SCHEMA_COMMENT + raw, 'utf8')
  return updated
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

// GET /api/plan — read plan.yaml
app.get('/api/plan', (req, res) => {
  try {
    res.json(loadPlan())
  } catch (err) {
    res.status(404).json({ error: err.message })
  }
})

// PATCH /api/plan — write plan.yaml
app.patch('/api/plan', (req, res) => {
  try {
    const updated = writePlan(req.body)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/generate — trigger artifact generation
app.post('/api/generate', async (req, res) => {
  const { type = 'all' } = req.body
  try {
    const plan = loadPlan()
    const outputDir = join(PROJECT_ROOT, 'output')
    mkdirSync(outputDir, { recursive: true })

    const { generateMermaid } = await import('../cli/src/generators/mermaid.js')
    const { generateReport } = await import('../cli/src/generators/report.js')
    const { generateDeck } = await import('../cli/src/generators/deck.js')

    const results = {}
    if (type === 'diagram' || type === 'all') {
      results.diagram = generateMermaid(plan)
      writeFileSync(join(outputDir, 'diagram.md'), results.diagram, 'utf8')
    }
    if (type === 'report' || type === 'all') {
      results.report = generateReport(plan)
      writeFileSync(join(outputDir, 'report.md'), results.report, 'utf8')
    }
    if (type === 'deck' || type === 'all') {
      results.deck = generateDeck(plan)
      writeFileSync(join(outputDir, 'deck.html'), results.deck, 'utf8')
    }
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack })
  }
})

// POST /api/iterate — run iteration snapshot
app.post('/api/iterate', (req, res) => {
  try {
    const output = execSync(`node ${join(PROJECT_ROOT, 'packages/cli/src/index.js')} iterate --no-commit`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    })
    res.json({ ok: true, output })
  } catch (err) {
    res.status(500).json({ error: err.message, stderr: err.stderr })
  }
})

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => {
  console.log(`  🔧 Present API  → http://localhost:${PORT}`)
})
