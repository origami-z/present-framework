import { useState } from 'react'

const STATUSES = ['todo', 'wip', 'done', 'archive'] as const
const EVALUATIONS = ['not_started', 'on_track', 'needs_attention', 'at_risk', 'blocked', 'exceeds'] as const
const PRIORITIES = ['high', 'medium', 'low'] as const

const EVAL_EMOJI: Record<string, string> = {
  not_started: '⬜',
  on_track: '🟢',
  needs_attention: '🟡',
  at_risk: '🔴',
  blocked: '⛔',
  exceeds: '⭐',
}

const STATUS_COLOR: Record<string, string> = {
  todo: '#6b7280',
  wip: '#1a56db',
  done: '#16a34a',
  archive: '#9ca3af',
}

interface Task {
  id: string
  title: string
  description?: string
  status: string
  evaluation: string
  priority: string
  dependencies: string[]
  notes?: string
  created?: string
  updated?: string
}

interface Props {
  task: Task
  allTaskIds: string[]
  onUpdate: (updated: Task) => void
  onDelete: () => void
}

export function TaskEditor({ task, allTaskIds, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)

  const update = (field: keyof Task, value: any) => {
    onUpdate({ ...task, [field]: value, updated: new Date().toISOString().split('T')[0] })
  }

  const otherIds = allTaskIds.filter((id) => id !== task.id)

  return (
    <div style={cardStyle}>
      <div style={headerStyle} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <span style={{ ...statusDot, background: STATUS_COLOR[task.status] || '#999' }} />
          <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title || <em style={{ color: '#94a3b8' }}>Untitled task</em>}
          </span>
          <span style={{ fontSize: '0.9em' }}>{EVAL_EMOJI[task.evaluation] || '⬜'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ ...chip, background: '#f1f5f9', color: '#475569', fontSize: '0.7em' }}>
            {task.id}
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.8em' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={bodyStyle}>
          <Field label="Title">
            <input
              style={inputStyle}
              value={task.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="Task title"
            />
          </Field>

          <Field label="Description">
            <textarea
              style={{ ...inputStyle, height: 60, resize: 'vertical' }}
              value={task.description || ''}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Optional description"
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <Field label="Status">
              <select style={selectStyle} value={task.status} onChange={(e) => update('status', e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="Evaluation">
              <select style={selectStyle} value={task.evaluation} onChange={(e) => update('evaluation', e.target.value)}>
                {EVALUATIONS.map((e) => (
                  <option key={e} value={e}>{EVAL_EMOJI[e]} {e}</option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <select style={selectStyle} value={task.priority} onChange={(e) => update('priority', e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Dependencies">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {otherIds.map((id) => {
                const checked = task.dependencies.includes(id)
                return (
                  <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const deps = e.target.checked
                          ? [...task.dependencies, id]
                          : task.dependencies.filter((d) => d !== id)
                        update('dependencies', deps)
                      }}
                    />
                    <span style={{ fontSize: '0.8em', fontFamily: 'monospace' }}>{id}</span>
                  </label>
                )
              })}
              {otherIds.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.8em' }}>No other tasks</span>}
            </div>
          </Field>

          <Field label="Notes">
            <textarea
              style={{ ...inputStyle, height: 50, resize: 'vertical' }}
              value={task.notes || ''}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Notes, links, blockers..."
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button
              onClick={onDelete}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8em', padding: '4px 8px' }}
            >
              🗑 Remove task
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <label style={{ display: 'block', fontSize: '0.75em', fontWeight: 600, color: '#64748b', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  marginBottom: '0.4rem',
  overflow: 'hidden',
  background: '#fff',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.5rem 0.75rem',
  cursor: 'pointer',
  userSelect: 'none',
  gap: '0.5rem',
}

const bodyStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderTop: '1px solid #f1f5f9',
  background: '#fafafa',
}

const statusDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  flexShrink: 0,
}

const chip: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 4,
  fontFamily: 'monospace',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  border: '1px solid #e2e8f0',
  borderRadius: 4,
  fontSize: '0.85em',
  fontFamily: 'inherit',
  background: '#fff',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}
