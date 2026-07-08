import React, { useState, useEffect } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import { createMeeting, getMeetings } from '../api'
import '../pages/AdminPanel.css'

export default function Meeting() {
    const [title, setTitle] = useState('')
    const [datetime, setDatetime] = useState('')
    const [summary, setSummary] = useState('')
    const [link, setLink] = useState('')
    const [audience, setAudience] = useState('student')
    const [mode, setMode] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState(null)

    async function handleSubmit(e) {
        e.preventDefault()
        setMessage(null)
        if (!title || !datetime) {
            setMessage({ type: 'error', text: 'Title and date/time are required.' })
            return
        }
        const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
        if (!token) {
            setMessage({ type: 'error', text: 'Not authenticated.' })
            return
        }
        setLoading(true)
        try {
            const payload = { title, summary, datetime: new Date(datetime).toISOString(), link, audience, mode }
            await createMeeting(payload, token)
            setMessage({ type: 'success', text: 'Meeting created successfully.' })
            setTitle('')
            setDatetime('')
            setSummary('')
            setLink('')
            setAudience('student')
            setMode('')
            loadMeetings()
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to create meeting' })
        } finally { setLoading(false) }
    }

    const [meetings, setMeetings] = useState(null)
    const [loadingMeetings, setLoadingMeetings] = useState(true)

    async function loadMeetings() {
        setLoadingMeetings(true)
        try {
            const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
            if (!token) throw new Error('Not authenticated')
            const items = await getMeetings(token)
            setMeetings(items || [])
        } catch (e) {
            console.warn('Failed to load meetings', e)
            setMeetings([])
        } finally { setLoadingMeetings(false) }
    }

    useEffect(() => { loadMeetings() }, [])

    return (
        <AdminLayout title="Meetings">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Upcoming Meetings</h2>
                </header>
                <p style={{ marginTop: -10, marginBottom: 20, color: 'var(--text-secondary)' }}>Schedule and review meetings with staff and students.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
                    <section className="admin-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 className="section-title" style={{ margin: 0 }}>Schedule New Meeting</h3>
                            <span className="status-badge" style={{ background: 'var(--bg-success-light)', color: 'var(--success-color)' }}>Create</span>
                        </div>

                        <form onSubmit={handleSubmit} className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                            <div>
                                <label>Meeting Title</label>
                                <input className="admin-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter meeting title" />
                            </div>

                            <div>
                                <label>Date & Time</label>
                                <input className="admin-input" value={datetime} onChange={e => setDatetime(e.target.value)} type="datetime-local" />
                            </div>

                            <div>
                                <label>Audience</label>
                                <select className="admin-input" value={audience} onChange={e => setAudience(e.target.value)}>
                                    <option value="student">All Students</option>
                                    <option value="faculty">Faculty</option>
                                    <option value="parent">Parents</option>
                                    <option value="staff">Staff</option>
                                    <option value="all">All</option>
                                </select>
                            </div>

                            <div>
                                <label>Mode</label>
                                <select className="admin-input" value={mode} onChange={e => setMode(e.target.value)}>
                                    <option value="">Select Mode</option>
                                    <option value="online">Online</option>
                                    <option value="offline">Offline</option>
                                </select>
                            </div>

                            <div>
                                <label>Meeting Link (optional)</label>
                                <input className="admin-input" value={link} onChange={e => setLink(e.target.value)} placeholder="https://zoom.us/..." />
                            </div>

                            <div>
                                <label>Agenda / Notes</label>
                                <textarea className="admin-input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Describe agenda, topics or notes" style={{ minHeight: 80 }} />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                <button className="btn-primary" disabled={loading}>{loading ? 'Creating…' : '+ Add Meeting'}</button>
                                {message && <span style={{ fontSize: '0.9rem', color: message.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)' }}>{message.text}</span>}
                            </div>
                        </form>
                    </section>

                    <section className="admin-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 className="section-title" style={{ margin: 0 }}>Meeting History</h3>
                            <span className="status-badge">Recent</span>
                        </div>

                        {loadingMeetings && <div>Loading meeting history…</div>}
                        {!loadingMeetings && (!meetings || meetings.length === 0) && <div style={{ color: 'var(--text-secondary)' }}>No meeting history yet.</div>}
                        {!loadingMeetings && meetings && meetings.length > 0 && (
                            <div className="admin-table-wrapper">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Date & Time</th>
                                            <th>Title</th>
                                            <th>Audience</th>
                                            <th>By</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {meetings.map(m => (
                                            <tr key={m._id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{new Date(m.datetime).toLocaleDateString()}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{new Date(m.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{m.title}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.mode}</div>
                                                </td>
                                                <td>
                                                    <span className="status-badge" style={{ textTransform: 'capitalize' }}>{m.audience || 'all'}</span>
                                                    {m.class && <div style={{ fontSize: '0.75rem', marginTop: 2 }}>Class {m.class}</div>}
                                                </td>
                                                <td>{m.createdBy && m.createdBy.name ? m.createdBy.name : (m.createdBy ? String(m.createdBy).slice(0, 8) : 'Admin')}</td>
                                                <td>
                                                    {m.link ? <a href={m.link} target="_blank" rel="noreferrer" className="btn-secondary small">Join</a> : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </AdminLayout>
    )
}
