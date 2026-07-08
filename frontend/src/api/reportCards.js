import { API_BASE } from './index'

export async function createReportCard(payload, token) {
  const res = await fetch(`${API_BASE}/api/reportcards`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create report card' }))
    throw new Error(err.message || 'Failed to create report card')
  }
  return res.json()
}

export async function createReportCardForm(formData, token) {
  const res = await fetch(`${API_BASE}/api/reportcards`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to create report card' }))
    throw new Error(err.message || 'Failed to create report card')
  }
  return res.json()
}

export async function getReportCards(query = {}, token) {
  const qs = new URLSearchParams()
  Object.keys(query || {}).forEach(k => { if (query[k] !== undefined && query[k] !== null && query[k] !== '') qs.set(k, query[k]) })
  const url = `${API_BASE}/api/reportcards${qs.toString() ? `?${qs.toString()}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load report cards' }))
    throw new Error(err.message || 'Failed to load report cards')
  }
  return res.json()
}

export async function getMyReportCards(token) {
  if (!token) return []
  const res = await fetch(`${API_BASE}/api/reportcards/my`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to load my report cards' }))
    throw new Error(err.message || 'Failed to load my report cards')
  }
  return res.json()
}
