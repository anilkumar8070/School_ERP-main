import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getAdminContactQueries, updateContactQueryStatus, API_BASE } from '../../api'
import { toast } from 'react-toastify'
import { getAuth } from '../../utils/session'

export default function ContactQueries() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState({})
    const [filters, setFilters] = useState({
        q: '',
        email: '',
        date: '',
        time: '',
        day: ''
    })

    async function load() {
        setLoading(true)
        try {
            const { token } = getAuth() || {}
            const data = await getAdminContactQueries(token)
            setItems(data || [])
        } catch (e) {
            console.error(e)
            toast.error(e?.message || 'Failed to load')
            setItems([])
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    async function updateStatus(id, status, notify, note) {
        try {
            setUpdating(u => ({ ...u, [id]: true }))
            const { token } = getAuth() || {}
            const res = await updateContactQueryStatus(id, { status, notify, note }, token)
            toast.success('Updated')
            setItems(it => it.map(i => i._id === id ? res : i))
        } catch (e) {
            console.error(e)
            toast.error(e?.message || 'Failed to update')
        } finally { setUpdating(u => ({ ...u, [id]: false })) }
    }

    const filteredItems = items.filter(it => {
        const norm = (s) => (s || '').toString().toLowerCase()
        if (filters.email && !norm(it.email).includes(norm(filters.email))) return false
        if (filters.q && !(norm(it.name).includes(norm(filters.q)) || norm(it.description).includes(norm(filters.q)))) return false

        if (filters.date) {
            const d = new Date(it.createdAt)
            const y = d.getFullYear()
            const m = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            if (`${y}-${m}-${day}` !== filters.date) return false
        }

        if (filters.time) {
            const d = new Date(it.createdAt)
            const hh = String(d.getHours()).padStart(2, '0')
            const mm = String(d.getMinutes()).padStart(2, '0')
            if (!`${hh}:${mm}`.startsWith(filters.time)) return false
        }

        if (filters.day !== '') {
            const d = new Date(it.createdAt)
            if (String(d.getDay()) !== String(filters.day)) return false
        }
        return true
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    const active = filteredItems.filter(it => (it.status || '').toLowerCase() !== 'solved')
    const history = filteredItems.filter(it => (it.status || '').toLowerCase() === 'solved')

    const clearFilters = () => setFilters({ q: '', email: '', date: '', time: '', day: '' })

    return (
        <AdminLayout title="Messages & Queries">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Messages & Queries</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage contact queries from the website.</p>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end' }}>
                        <div className="form-group">
                            <label>Search</label>
                            <input className="admin-input" placeholder="Name or description" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input className="admin-input" placeholder="Filter by email" value={filters.email} onChange={e => setFilters({ ...filters, email: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Date</label>
                            <input className="admin-input" type="date" value={filters.date} onChange={e => setFilters({ ...filters, date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Time</label>
                            <input className="admin-input" type="time" value={filters.time} onChange={e => setFilters({ ...filters, time: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Day</label>
                            <select className="admin-select" value={filters.day} onChange={e => setFilters({ ...filters, day: e.target.value })}>
                                <option value="">Any day</option>
                                <option value="0">Sunday</option>
                                <option value="1">Monday</option>
                                <option value="2">Tuesday</option>
                                <option value="3">Wednesday</option>
                                <option value="4">Thursday</option>
                                <option value="5">Friday</option>
                                <option value="6">Saturday</option>
                            </select>
                        </div>
                        <button className="btn-secondary" onClick={clearFilters}>Clear Filters</button>
                    </div>
                </div>

                {loading ? (
                    <div className="admin-card" style={{ padding: 20, textAlign: 'center' }}>Loading queries...</div>
                ) : (
                    <>
                        <h3 onClick={() => { }} style={{ marginBottom: 16, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Active Queries <span className="status-badge status-info">{active.length}</span></h3>
                        {active.length === 0 && <div className="admin-card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No active queries.</div>}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {active.map(it => (
                                <div key={it._id} className="admin-card" style={{ display: 'grid', gridTemplateColumns: '1fr minmax(250px, 300px)', gap: 20 }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{it.name}</h4>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{new Date(it.createdAt).toLocaleString()}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            <span><strong>Email:</strong> {it.email}</span>
                                            <span><strong>Phone:</strong> {it.contact}</span>
                                        </div>
                                        <p style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, margin: 0, lineHeight: 1.5 }}>{it.description}</p>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                                        <div className="form-group">
                                            <label>Status</label>
                                            <select
                                                className="admin-select"
                                                value={it.status || 'in progress'}
                                                onChange={(e) => setItems(prev => prev.map(p => p._id === it._id ? { ...p, status: e.target.value } : p))}
                                                style={{ width: '100%' }}
                                            >
                                                <option value="in progress">In Progress</option>
                                                <option value="closed">Closed</option>
                                                <option value="solved">Solved</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Note</label>
                                            <textarea
                                                id={`note_${it._id}`}
                                                className="admin-input"
                                                defaultValue={it.note || ''}
                                                rows={3}
                                                placeholder="Add a note..."
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input type="checkbox" id={`notify_${it._id}`} defaultChecked={false} style={{ width: 16, height: 16 }} />
                                            <label htmlFor={`notify_${it._id}`} style={{ margin: 0, fontSize: '0.9rem' }}>Notify user via email</label>
                                        </div>
                                        <div className="btn-group" style={{ marginTop: 'auto' }}>
                                            {it.filename && (
                                                <a href={`${API_BASE}${it.url ? it.url : `/uploads/${it.filename}`}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ textDecoration: 'none', textAlign: 'center', flex: 1 }}>Attachment</a>
                                            )}
                                            <button className="btn-primary" style={{ flex: 1 }} onClick={() => {
                                                const sel = document.querySelector(`#notify_${it._id}`)
                                                const notify = sel ? sel.checked : false
                                                const noteEl = document.querySelector(`#note_${it._id}`)
                                                const note = noteEl ? noteEl.value : ''
                                                updateStatus(it._id, it.status || 'in progress', notify, note)
                                            }}>
                                                {updating[it._id] ? 'Saving...' : 'Update'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: '1.1rem', color: 'var(--text-primary)' }}>History (Solved) <span className="status-badge status-success">{history.length}</span></h3>
                        {history.length === 0 && <div className="admin-card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No solved queries.</div>}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {history.map(it => (
                                <div key={it._id} className="admin-card" style={{ opacity: 0.8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{it.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({it.email})</span></div>
                                            <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>{it.description}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(it.createdAt).toLocaleString()}</div>
                                            {it.note && <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-surface)', borderRadius: 4, fontSize: '0.9rem' }}><strong>Note:</strong> {it.note}</div>}
                                        </div>
                                        {it.filename && (
                                            <a href={`${API_BASE}${it.url ? it.url : `/uploads/${it.filename}`}`} target="_blank" rel="noreferrer" className="btn-secondary" style={{ textDecoration: 'none' }}>Attachment</a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    )
}
