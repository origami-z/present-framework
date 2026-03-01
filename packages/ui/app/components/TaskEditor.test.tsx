import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { TaskEditor } from './TaskEditor'

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

const baseTask: Task = {
  id: 'pillar-001',
  title: 'My Task',
  description: 'A description',
  status: 'todo',
  evaluation: 'not_started',
  priority: 'medium',
  dependencies: [],
  notes: '',
  created: '2024-01-01',
  updated: '2024-01-01',
}

const noOtherTasks: { id: string; title: string }[] = []
const otherTasksList = [
  { id: 'pillar-001', title: 'My Task' },
  { id: 'pillar-002', title: 'Second Task' },
  { id: 'pillar-003', title: 'Third Task' },
]

/** Stateful wrapper so controlled inputs work correctly in tests. */
function StatefulEditor({
  task: initialTask,
  allTasks,
  onUpdate,
  onDelete,
}: {
  task: Task
  allTasks: { id: string; title: string }[]
  onUpdate?: (t: Task) => void
  onDelete?: () => void
}) {
  const [task, setTask] = useState(initialTask)
  return (
    <TaskEditor
      task={task}
      allTasks={allTasks}
      onUpdate={(t) => { setTask(t); onUpdate?.(t) }}
      onDelete={onDelete ?? vi.fn()}
    />
  )
}

describe('TaskEditor', () => {
  it('renders the task title in collapsed state', () => {
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} />)
    expect(screen.getByText('My Task')).toBeInTheDocument()
  })

  it('shows task id chip in collapsed state', () => {
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} />)
    expect(screen.getByText('pillar-001')).toBeInTheDocument()
  })

  it('shows "Untitled task" placeholder when title is empty', () => {
    render(<StatefulEditor task={{ ...baseTask, title: '' }} allTasks={noOtherTasks} />)
    expect(screen.getByText('Untitled task')).toBeInTheDocument()
  })

  it('expands to show form fields when header is clicked', async () => {
    const user = userEvent.setup()
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} />)

    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /My Task/i }))

    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
  })

  it('calls onUpdate with updated title when title field changes', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /My Task/i }))

    const titleInput = screen.getByLabelText('Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'New Title')

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
    expect(lastCall.title).toBe('New Title')
  })

  it('calls onDelete when Remove task button is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<StatefulEditor task={baseTask} allTasks={noOtherTasks} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: /My Task/i }))
    await user.click(screen.getByRole('button', { name: /Remove task/i }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('renders the dependency combobox input when expanded', async () => {
    const user = userEvent.setup()
    render(<StatefulEditor task={baseTask} allTasks={otherTasksList} />)

    await user.click(screen.getByRole('button', { name: /My Task/i }))

    expect(screen.getByRole('combobox', { name: /Add dependency/i })).toBeInTheDocument()
  })

  it('renders existing dependency as a removable tag', async () => {
    const user = userEvent.setup()
    const taskWithDep = { ...baseTask, dependencies: ['pillar-002'] }
    render(<StatefulEditor task={taskWithDep} allTasks={otherTasksList} />)

    await user.click(screen.getByRole('button', { name: /My Task/i }))

    // The existing dependency appears as a tag chip
    expect(screen.getByText('pillar-002')).toBeInTheDocument()
    // And has a remove button
    expect(screen.getByRole('button', { name: /Remove pillar-002/i })).toBeInTheDocument()
  })

  it('removes a dependency tag when the remove button is clicked', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const taskWithDep = { ...baseTask, dependencies: ['pillar-002'] }
    render(
      <StatefulEditor task={taskWithDep} allTasks={otherTasksList} onUpdate={onUpdate} />,
    )

    await user.click(screen.getByRole('button', { name: /My Task/i }))
    await user.click(screen.getByRole('button', { name: /Remove pillar-002/i }))

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
    expect(lastCall.dependencies).toEqual([])
  })
})
