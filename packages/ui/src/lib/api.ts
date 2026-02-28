const BASE = '/api'

export async function fetchPlan() {
  const r = await fetch(`${BASE}/plan`)
  if (!r.ok) throw new Error((await r.json()).error)
  return r.json()
}

export async function patchPlan(plan: any) {
  const r = await fetch(`${BASE}/plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  })
  if (!r.ok) throw new Error((await r.json()).error)
  return r.json()
}

export async function generateArtifacts(type: 'diagram' | 'report' | 'deck' | 'all' = 'all') {
  const r = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  })
  if (!r.ok) throw new Error((await r.json()).error)
  return r.json() as Promise<{ diagram?: string; report?: string; deck?: string }>
}

export async function runIterate() {
  const r = await fetch(`${BASE}/iterate`, { method: 'POST' })
  if (!r.ok) throw new Error((await r.json()).error)
  return r.json()
}
