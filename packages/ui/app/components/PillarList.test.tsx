import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PillarList } from './PillarList'

const makePillar = (id: string, name: string, tasks: any[] = []) => ({
  id,
  name,
  description: '',
  short_term_goal: [],
  long_term_goal: [],
  tasks,
})

const makeTask = (id: string, status = 'todo') => ({
  id,
  title: `Task ${id}`,
  status,
  priority: 'medium',
  dependencies: [],
  linked_goal: [],
})

describe('PillarList', () => {
  it('renders all pillar names', () => {
    const pillars = [makePillar('security', 'Security'), makePillar('perf', 'Performance')]
    render(<PillarList pillars={pillars} onUpdate={vi.fn()} />)
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })

  it('renders pillar ids as badges', () => {
    render(<PillarList pillars={[makePillar('security', 'Security')]} onUpdate={vi.fn()} />)
    expect(screen.getByText('security')).toBeInTheDocument()
  })

  it('displays task status stats for each pillar', () => {
    const tasks = [
      makeTask('t-001', 'done'),
      makeTask('t-002', 'done'),
      makeTask('t-003', 'wip'),
      makeTask('t-004', 'todo'),
    ]
    render(<PillarList pillars={[makePillar('infra', 'Infrastructure', tasks)]} onUpdate={vi.fn()} />)
    expect(screen.getByText(/✅ 2/)).toBeInTheDocument()
    expect(screen.getByText(/🔵 1/)).toBeInTheDocument()
    expect(screen.getByText(/📋 1/)).toBeInTheDocument()
  })

  it('collapses and expands pillar content on header click', async () => {
    const user = userEvent.setup()
    const tasks = [makeTask('t-001')]
    render(<PillarList pillars={[makePillar('sec', 'Security', tasks)]} onUpdate={vi.fn()} />)

    // Task is visible initially (expanded by default)
    expect(screen.getByText('Task t-001')).toBeInTheDocument()

    // The toggle button is the first button (before the delete icon button)
    const buttons = screen.getAllByRole('button')
    const toggleBtn = buttons[0]

    // Click to collapse
    await user.click(toggleBtn)
    expect(screen.queryByText('Task t-001')).not.toBeInTheDocument()

    // Click again to expand
    await user.click(toggleBtn)
    expect(screen.getByText('Task t-001')).toBeInTheDocument()
  })

  it('calls onUpdate with pillar removed when delete button is clicked', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))

    const pillars = [makePillar('sec', 'Security'), makePillar('perf', 'Performance')]
    const onUpdate = vi.fn()
    render(<PillarList pillars={pillars} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /Remove pillar Security/i }))
    expect(onUpdate).toHaveBeenCalledWith([makePillar('perf', 'Performance')])

    vi.unstubAllGlobals()
  })

  it('does not remove pillar when confirm is cancelled', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))

    const onUpdate = vi.fn()
    render(<PillarList pillars={[makePillar('sec', 'Security')]} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /Remove pillar Security/i }))
    expect(onUpdate).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('shows name input when Add Pillar button is clicked', async () => {
    const user = userEvent.setup()
    render(<PillarList pillars={[]} onUpdate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /\+ Add Pillar/i }))
    expect(screen.getByPlaceholderText(/Pillar name/i)).toBeInTheDocument()
  })

  it('calls onUpdate with new pillar when Add form is submitted', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<PillarList pillars={[]} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /\+ Add Pillar/i }))
    await user.type(screen.getByPlaceholderText(/Pillar name/i), 'New Pillar')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))

    expect(onUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'New Pillar', id: 'new-pillar', short_term_goal: [], long_term_goal: [] }),
    ])
  })

  it('cancels adding a pillar when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<PillarList pillars={[]} onUpdate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /\+ Add Pillar/i }))
    expect(screen.getByPlaceholderText(/Pillar name/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(screen.queryByPlaceholderText(/Pillar name/i)).not.toBeInTheDocument()
  })

  it('adds a task to a pillar when Add Task is clicked', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<PillarList pillars={[makePillar('sec', 'Security')]} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /\+ Add Task/i }))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const [updatedPillars] = onUpdate.mock.calls[0]
    expect(updatedPillars[0].tasks).toHaveLength(1)
    expect(updatedPillars[0].tasks[0].status).toBe('todo')
    expect(updatedPillars[0].tasks[0].linked_goal).toEqual([])
  })

  it('renders short-term and long-term goal bullet lists with evaluation', () => {
    const pillar = {
      ...makePillar('infra', 'Infrastructure'),
      short_term_goal: [{ id: 'infra-stg-001', text: 'Running on bare metal', evaluation: 'at_risk' }],
      long_term_goal: [{ id: 'infra-ltg-001', text: 'Fully on Kubernetes', evaluation: 'on_track' }],
    }
    render(<PillarList pillars={[pillar]} onUpdate={vi.fn()} />)
    expect(screen.getByText('📋 Short-term Goals')).toBeInTheDocument()
    expect(screen.getByText('🔭 Long-term Goals')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Running on bare metal')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Fully on Kubernetes')).toBeInTheDocument()
  })

  it('adds a goal item when + Add is clicked', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<PillarList pillars={[makePillar('sec', 'Security')]} onUpdate={onUpdate} />)

    // There are two "+ Add" buttons (short-term and long-term goals)
    const addButtons = screen.getAllByRole('button', { name: /\+ Add/i })
    // First one is for short-term goals
    await user.click(addButtons[0])

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const [updatedPillars] = onUpdate.mock.calls[0]
    expect(updatedPillars[0].short_term_goal).toHaveLength(1)
    expect(updatedPillars[0].short_term_goal[0].id).toBe('sec-stg-001')
    expect(updatedPillars[0].short_term_goal[0].evaluation).toBe('not_started')
  })
})
