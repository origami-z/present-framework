import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useRef } from 'react'
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
    setTimeout(() => setToast(null), 3000)
  }

  // Auto-save with debounce
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
      showToast('✅ All artifacts generated!')
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
      showToast('📸 Iteration snapshot created!')
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.1em', fontWeight: 700, color: '#1e293b' }}>
            📋 Present
          </span>
          <span style={{ color: '#64748b', fontSize: '0.85em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {plan?.meta?.title}
          </span>
          <span style={{ ...versionBadge }}>v{plan?.meta?.version}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {savedAt && (
            <span style={{ fontSize: '0.75em', color: '#94a3b8' }}>
              {saving ? '💾 Saving...' : `Saved ${savedAt}`}
            </span>
          )}
          <button style={secondaryBtn} onClick={handleIterate} disabled={iterating}>
            {iterating ? '⏳' : '📸'} Iterate
          </button>
          <button style={primaryBtnStyle} onClick={handleGenerateAll} disabled={generating}>
            {generating ? '⏳' : '⚡'} Generate All
          </button>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div style={toastStyle}>{toast}</div>
      )}

      {/* Body: two panels */}
      <div style={bodyStyle}>
        {/* Left panel: Editor */}
        <div style={leftPanel}>
          <div style={sectionCard}>
            <h3 style={sectionTitle}>Plan Overview</h3>
            <label style={fieldLabel}>Current State</label>
            <textarea
              style={textareaStyle}
              value={plan?.current_state || ''}
              onChange={(e) => handlePlanChange({ current_state: e.target.value })}
              placeholder="Where things are today..."
            />
            <label style={fieldLabel}>Target State</label>
            <textarea
              style={textareaStyle}
              value={plan?.target_state || ''}
              onChange={(e) => handlePlanChange({ target_state: e.target.value })}
              placeholder="What does success look like?"
            />
          </div>

          <div style={sectionCard}>
            <h3 style={sectionTitle}>Pillars & Tasks</h3>
            <PillarList
              pillars={plan?.pillars || []}
              onUpdate={(pillars) => handlePlanChange({ pillars })}
            />
          </div>
        </div>

        {/* Right panel: Previews */}
        <div style={rightPanel}>
          {/* Tab bar */}
          <div style={tabBar}>
            {(['diagram', 'report', 'deck'] as Tab[]).map((tab) => (
              <button
                key={tab}
                style={{ ...tabBtn, ...(activeTab === tab ? tabBtnActive : {}) }}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'diagram' ? '🔷 Diagram' : tab === 'report' ? '📄 Report' : '🎨 Deck'}
              </button>
            ))}
          </div>

          <div style={previewBody}>
            {activeTab === 'diagram' && <DiagramPreview content={artifacts.diagram || ''} />}
            {activeTab === 'report' && <ReportPreview content={artifacts.report || ''} />}
            {activeTab === 'deck' && <DeckPreview content={artifacts.deck || ''} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// Styles
const appStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.6rem 1.25rem',
  background: '#fff',
  borderBottom: '1px solid #e2e8f0',
  flexShrink: 0,
  gap: '1rem',
}

const bodyStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
}

const leftPanel: React.CSSProperties = {
  width: '42%',
  minWidth: 320,
  overflow: 'auto',
  padding: '1rem',
  borderRight: '1px solid #e2e8f0',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const rightPanel: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const tabBar: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #e2e8f0',
  background: '#fff',
  flexShrink: 0,
}

const tabBtn: React.CSSProperties = {
  padding: '0.6rem 1rem',
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  fontSize: '0.85em',
  fontWeight: 500,
  color: '#64748b',
}

const tabBtnActive: React.CSSProperties = {
  color: '#1a56db',
  borderBottomColor: '#1a56db',
}

const previewBody: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  background: '#fff',
}

const sectionCard: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '0.875rem',
}

const sectionTitle: React.CSSProperties = {
  fontSize: '0.82em',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#475569',
  marginBottom: '0.75rem',
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75em',
  fontWeight: 600,
  color: '#64748b',
  marginBottom: '0.2rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: '0.85em',
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: 70,
  marginBottom: '0.75rem',
  lineHeight: 1.5,
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  background: '#1a56db',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.85em',
  fontWeight: 600,
}

const secondaryBtn: React.CSSProperties = {
  padding: '7px 14px',
  background: 'none',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.85em',
  fontWeight: 500,
  color: '#475569',
}

const versionBadge: React.CSSProperties = {
  padding: '1px 6px',
  background: '#e0e7ff',
  color: '#3730a3',
  borderRadius: 4,
  fontSize: '0.75em',
  fontWeight: 600,
}

const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '1.5rem',
  right: '1.5rem',
  padding: '0.75rem 1.25rem',
  background: '#1e293b',
  color: '#fff',
  borderRadius: 8,
  fontSize: '0.85em',
  zIndex: 1000,
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
}
