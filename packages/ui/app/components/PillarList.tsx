import { useState } from 'react'
import { TaskEditor } from './TaskEditor'

interface Task {
  id: string
  title: string
  status: string
  evaluation: string
  priority: string
  dependencies: string[]
  description?: string
  notes?: string
  created?: string
  updated?: string
}

interface Pillar {
  id: string
  name: string
  description?: string
  tasks: Task[]
}

interface Props {
  pillars: Pillar[]
  onUpdate: (pillars: Pillar[]) => void
}

function generateId(prefix: string, existing: string[]) {
  let i = 1
  while (existing.includes(`${prefix}-${String(i).padStart(3, '0')}`)) i++
  return `${prefix}-${String(i).padStart(3, '0')}`
}

function allTaskIds(pillars: Pillar[]) {
  return pillars.flatMap((p) => p.tasks.map((t) => t.id))
}

export function PillarList({ pillars, onUpdate }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [newPillarName, setNewPillarName] = useState('')
  const [addingPillar, setAddingPillar] = useState(false)

  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))

  const updatePillar = (idx: number, updated: Pillar) => {
    const next = [...pillars]
    next[idx] = updated
    onUpdate(next)
  }

  const removePillar = (idx: number) => {
    if (!confirm(`Remove pillar "${pillars[idx].name}" and all its tasks?`)) return
    onUpdate(pillars.filter((_, i) => i !== idx))
  }

  const addTask = (pillarIdx: number) => {
    const pillar = pillars[pillarIdx]
    const existing = allTaskIds(pillars)
    const prefix = pillar.id.slice(0, 8)
    const id = generateId(prefix, existing)
    const date = new Date().toISOString().split('T')[0]
    const newTask: Task = {
      id,
      title: '',
      description: '',
      status: 'todo',
      evaluation: 'not_started',
      priority: 'medium',
      dependencies: [],
      notes: '',
      created: date,
      updated: date,
    }
    const updated = { ...pillar, tasks: [...pillar.tasks, newTask] }
    updatePillar(pillarIdx, updated)
  }

  const addPillar = () => {
    if (!newPillarName.trim()) return
    const name = newPillarName.trim()
    const id = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 16)
    const existingIds = pillars.map((p) => p.id)
    let finalId = id
    let i = 2
    while (existingIds.includes(finalId)) finalId = `${id}-${i++}`
    onUpdate([...pillars, { id: finalId, name, description: '', tasks: [] }])
    setNewPillarName('')
    setAddingPillar(false)
  }

  const all = allTaskIds(pillars)

  return (
    <div>
      {pillars.map((pillar, idx) => {
        const isCollapsed = collapsed[pillar.id]
        const stats = {
          done: pillar.tasks.filter((t) => t.status === 'done').length,
          wip: pillar.tasks.filter((t) => t.status === 'wip').length,
          todo: pillar.tasks.filter((t) => t.status === 'todo').length,
        }

        return (
          <div key={pillar.id} style={pillarCard}>
            <div style={pillarHeader} onClick={() => toggle(pillar.id)}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: '0.95em' }}>{pillar.name}</span>
                <span style={{ ...badge, background: '#e0e7ff', color: '#3730a3', marginLeft: '0.5rem', fontSize: '0.7em', fontFamily: 'monospace' }}>
                  {pillar.id}
                </span>
                <div style={{ fontSize: '0.75em', color: '#64748b', marginTop: '0.2rem' }}>
                  ✅ {stats.done} &nbsp; 🔵 {stats.wip} &nbsp; 📋 {stats.todo}
                  {pillar.description && <span style={{ marginLeft: '0.75rem', fontStyle: 'italic' }}>{pillar.description}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  style={iconBtn}
                  onClick={(e) => { e.stopPropagation(); removePillar(idx) }}
                  title="Remove pillar"
                >🗑</button>
                <span style={{ color: '#94a3b8', fontSize: '0.8em' }}>{isCollapsed ? '▶' : '▼'}</span>
              </div>
            </div>

            {!isCollapsed && (
              <div style={{ padding: '0.5rem 0.75rem' }}>
                <input
                  style={{ ...inlineInput, marginBottom: '0.5rem' }}
                  placeholder="Pillar description (optional)"
                  value={pillar.description || ''}
                  onChange={(e) => updatePillar(idx, { ...pillar, description: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />

                {pillar.tasks.map((task, tIdx) => (
                  <TaskEditor
                    key={task.id}
                    task={task}
                    allTaskIds={all}
                    onUpdate={(updated) => {
                      const tasks = [...pillar.tasks]
                      tasks[tIdx] = updated
                      updatePillar(idx, { ...pillar, tasks })
                    }}
                    onDelete={() => {
                      const tasks = pillar.tasks.filter((_, i) => i !== tIdx)
                      updatePillar(idx, { ...pillar, tasks })
                    }}
                  />
                ))}

                <button style={addTaskBtn} onClick={() => addTask(idx)}>
                  + Add Task
                </button>
              </div>
            )}
          </div>
        )
      })}

      {addingPillar ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            style={{ ...inlineInput, flex: 1 }}
            placeholder="Pillar name (e.g. Security)"
            value={newPillarName}
            onChange={(e) => setNewPillarName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addPillar(); if (e.key === 'Escape') setAddingPillar(false) }}
            autoFocus
          />
          <button style={primaryBtn} onClick={addPillar}>Add</button>
          <button style={ghostBtn} onClick={() => setAddingPillar(false)}>Cancel</button>
        </div>
      ) : (
        <button style={{ ...ghostBtn, marginTop: '0.75rem', width: '100%' }} onClick={() => setAddingPillar(true)}>
          + Add Pillar
        </button>
      )}
    </div>
  )
}

const pillarCard: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  marginBottom: '0.75rem',
  overflow: 'hidden',
  background: '#fff',
}

const pillarHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '0.75rem',
  cursor: 'pointer',
  background: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
  userSelect: 'none',
}

const badge: React.CSSProperties = {
  padding: '1px 6px',
  borderRadius: 4,
  fontWeight: 500,
}

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.85em',
  padding: '2px 4px',
  opacity: 0.6,
}

const inlineInput: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  fontSize: '0.82em',
  fontFamily: 'inherit',
  color: '#475569',
}

const addTaskBtn: React.CSSProperties = {
  width: '100%',
  padding: '6px',
  background: 'none',
  border: '1px dashed #cbd5e1',
  borderRadius: 6,
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '0.82em',
  marginTop: '0.25rem',
}

const primaryBtn: React.CSSProperties = {
  padding: '6px 14px',
  background: '#1a56db',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.85em',
  fontWeight: 600,
}

const ghostBtn: React.CSSProperties = {
  padding: '6px 14px',
  background: 'none',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.85em',
  color: '#475569',
}
