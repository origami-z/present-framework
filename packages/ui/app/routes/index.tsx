import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useRef } from 'react'
import {
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  TextField,
  Label,
  TextArea,
} from 'react-aria-components'
import { getPlan, savePlan, generateArtifacts, runIterate } from '../serverFns/plan'
import { PillarList } from '../components/PillarList'
import { DiagramPreview } from '../components/DiagramPreview'
import { ReportPreview } from '../components/ReportPreview'
import { DeckPreview } from '../components/DeckPreview'

export const Route = createFileRoute('/')({
  loader: () => getPlan(),
  component: PlannerPage,
})

type Tab = 'diagram' | 'report' | 'deck'

function PlannerPage() {
  const initialPlan = Route.useLoaderData()
  const [plan, setPlan] = useState<any>(initialPlan)
  const [activeTab, setActiveTab] = useState<Tab>('diagram')
  const [artifacts, setArtifacts] = useState<{ diagram?: string; report?: string; deck?: string }>({})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [iterating, setIterating] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const debouncedSave = useCallback((updated: any) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        const saved = await savePlan({ data: updated })
        setPlan(saved)
        setSavedAt(new Date().toLocaleTimeString())
      } catch (e: any) {
        showToast('Save failed: ' + e.message)
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [])

  const handlePlanChange = (partial: Partial<any>) => {
    const updated = { ...plan, ...partial }
    setPlan(updated)
    debouncedSave(updated)
  }

  const handleGenerateAll = async () => {
    setGenerating(true)
    try {
      const result = await generateArtifacts({ data: { type: 'all' } })
      setArtifacts(result as any)
      showToast('All artifacts generated!')
    } catch (e: any) {
      showToast('Generate failed: ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleIterate = async () => {
    setIterating(true)
    try {
      await runIterate()
      showToast('Iteration snapshot created!')
    } catch (e: any) {
      showToast('Iterate failed: ' + e.message)
    } finally {
      setIterating(false)
    }
  }

  return (
    <div style={appStyle}>
      {/* Top Bar */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '1.1em', fontWeight: 700 }}>Present</span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {plan?.meta?.title}
          </span>
          <span className="version-badge">v{plan?.meta?.version}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {savedAt && (
            <span style={{ fontSize: '0.75em', color: 'var(--color-text-faint)' }}>
              {saving ? 'Saving...' : `Saved ${savedAt}`}
            </span>
          )}
          <Button className="btn btn-secondary" onPress={handleIterate} isDisabled={iterating}>
            Iterate
          </Button>
          <Button className="btn btn-primary" onPress={handleGenerateAll} isDisabled={generating}>
            Generate All
          </Button>
        </div>
      </header>

      {toast && <div className="toast">{toast}</div>}

      <div style={bodyStyle}>
        {/* Left panel */}
        <div style={leftPanel}>
          <div style={sectionCard}>
            <h3 className="section-title">Plan Overview</h3>

            <TextField
              className="field"
              value={plan?.current_state || ''}
              onChange={(v) => handlePlanChange({ current_state: v })}
            >
              <Label className="field-label">Current State</Label>
              <TextArea
                className="field-textarea"
                placeholder="Where things are today..."
                style={{ minHeight: 70 }}
              />
            </TextField>

            <TextField
              className="field"
              value={plan?.target_state || ''}
              onChange={(v) => handlePlanChange({ target_state: v })}
            >
              <Label className="field-label">Target State</Label>
              <TextArea
                className="field-textarea"
                placeholder="What does success look like?"
                style={{ minHeight: 70 }}
              />
            </TextField>
          </div>

          <div style={sectionCard}>
            <h3 className="section-title">Pillars &amp; Tasks</h3>
            <PillarList
              pillars={plan?.pillars || []}
              onUpdate={(pillars) => handlePlanChange({ pillars })}
            />
          </div>
        </div>

        {/* Right panel -- Tabs */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as Tab)}
          style={rightPanel}
        >
          <div style={tabBarRow}>
            <TabList className="tablist" style={{ borderBottom: 'none', flex: 1 }}>
              <Tab id="diagram" className="tab">Diagram</Tab>
              <Tab id="report" className="tab">Report</Tab>
              <Tab id="deck" className="tab">Deck</Tab>
            </TabList>
            <span style={{ padding: '0 0.75rem', fontSize: '0.75em', color: 'var(--color-text-faint)', alignSelf: 'center' }}>
              Click Generate All to update previews
            </span>
          </div>

          <TabPanel id="diagram" className="tabpanel">
            <DiagramPreview content={artifacts.diagram || ''} />
          </TabPanel>
          <TabPanel id="report" className="tabpanel">
            <ReportPreview content={artifacts.report || ''} />
          </TabPanel>
          <TabPanel id="deck" className="tabpanel">
            <DeckPreview content={artifacts.deck || ''} />
          </TabPanel>
        </Tabs>
      </div>
    </div>
  )
}

const appStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0.6rem 1.25rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
  flexShrink: 0, gap: '1rem',
}

const bodyStyle: React.CSSProperties = { display: 'flex', flex: 1, overflow: 'hidden' }

const leftPanel: React.CSSProperties = {
  width: '42%', minWidth: 320, overflow: 'auto', padding: '1rem',
  borderRight: '1px solid var(--color-border)', background: 'var(--color-bg)',
  display: 'flex', flexDirection: 'column', gap: '0.75rem',
}

const rightPanel: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }

const tabBarRow: React.CSSProperties = {
  display: 'flex', alignItems: 'stretch',
  borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0,
}

const sectionCard: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: '0.875rem',
}
