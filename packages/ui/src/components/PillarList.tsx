import { useState } from 'react'
import { Button, TextField, Input } from 'react-aria-components'
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
    updatePillar(pillarIdx, { ...pillar, tasks: [...pillar.tasks, newTask] })
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
            <div style={pillarHeaderRow}>
              <Button
                onPress={() => toggle(pillar.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95em' }}>{pillar.name}</span>
                  <span className="pillar-id-badge">{pillar.id}</span>
                  <span style={{ color: 'var(--color-text-faint)', fontSize: '0.8em', marginLeft: '0.5rem' }}>
                    {isCollapsed ? '▶' : '▼'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75em', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  ✅ {stats.done} &nbsp; 🔵 {stats.wip} &nbsp; 📋 {stats.todo}
                  {pillar.description && (
                    <span style={{ marginLeft: '0.75rem', fontStyle: 'italic' }}>{pillar.description}</span>
                  )}
                </div>
              </Button>
              <Button
                className="btn btn-icon"
                onPress={() => removePillar(idx)}
                aria-label={`Remove pillar ${pillar.name}`}
              >
                🗑
              </Button>
            </div>

            {!isCollapsed && (
              <div style={{ padding: '0.5rem 0.75rem' }}>
                <TextField
                  value={pillar.description || ''}
                  onChange={(v) => updatePillar(idx, { ...pillar, description: v })}
                >
                  <Input
                    className="field-input-inline"
                    placeholder="Pillar description (optional)"
                    style={{ marginBottom: '0.5rem' }}
                  />
                </TextField>

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

                <Button className="btn btn-add-task" onPress={() => addTask(idx)}>
                  + Add Task
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {addingPillar ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <TextField value={newPillarName} onChange={setNewPillarName} style={{ flex: 1 }}>
            <Input
              className="field-input"
              placeholder="Pillar name (e.g. Security)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addPillar()
                if (e.key === 'Escape') setAddingPillar(false)
              }}
              autoFocus
            />
          </TextField>
          <Button className="btn btn-primary" onPress={addPillar}>Add</Button>
          <Button className="btn btn-secondary" onPress={() => setAddingPillar(false)}>Cancel</Button>
        </div>
      ) : (
        <Button
          className="btn btn-secondary"
          style={{ marginTop: '0.75rem', width: '100%' }}
          onPress={() => setAddingPillar(true)}
        >
          + Add Pillar
        </Button>
      )}
    </div>
  )
}

const pillarCard: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  marginBottom: '0.75rem',
  overflow: 'hidden',
  background: 'var(--color-surface)',
}

const pillarHeaderRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '0.75rem',
  background: 'var(--color-bg)',
  borderBottom: '1px solid var(--color-border)',
  gap: '0.5rem',
}
