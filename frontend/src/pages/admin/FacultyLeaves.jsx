import React, { useState, useMemo, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getAuth } from '../../utils/session'
import { getLeaves, updateLeaveStatus } from '../../api'

export default function FacultyLeaves() {
    const [leaves, setLeaves] = useState([])
    const [query, setQuery] = useState('')

    async function load() {
        try {
            const { token } = getAuth()
            const items = await getLeaves({ role: 'faculty' }, token)
            setLeaves(items || [])
        } catch (e) { console.error(e); setLeaves([]) }
    }

    useEffect(() => { load() }, [])

    async function onAction(id, status) {
        const note = prompt(`Optional note for ${status}:`)
        try {
            const { token } = getAuth()
            await updateLeaveStatus(id, status, note || '', token)
            await load()
        } catch (e) { console.error(e); alert('Action failed') }
    }

    const filtered = useMemo(() => {
        const q = (query || '').trim().toLowerCase()
        if (!q) return leaves
        return leaves.filter(l => (
            String(l.username || l.name || '').toLowerCase().includes(q) ||
            String(l.department || '').toLowerCase().includes(q) ||
            String(l.reason || '').toLowerCase().includes(q)
        ))
    }, [leaves, query])

    return (
        <AdminLayout title="Faculty Leaves">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Faculty Leave Applications</h2>
                    <input
                        className="admin-input"
                        placeholder="Search name / department / reason"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{ maxWidth: 300, fontSize: '0.9rem' }}
                    />
                </header>

                <div className="admin-card">
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Department</th>
                                    <th>Reason</th>
                                    <th>From</th>
                                    <th>To</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No faculty leave applications.</td></tr>
                                )}
                                {filtered.map(l => (
                                    <tr key={l._id}>
                                        <td>{l.username || l.name}</td>
                                        <td>{l.department}</td>
                                        <td>{l.reason}</td>
                                        <td>{l.from ? String(l.from).slice(0, 10) : ''}</td>
                                        <td>{l.to ? String(l.to).slice(0, 10) : ''}</td>
                                        <td>
                                            <span className={`status-badge ${l.status === 'Approved' ? 'status-success' : l.status === 'Rejected' ? 'status-danger' : 'status-warning'}`}>
                                                {l.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                                                <button className="btn-success" onClick={() => onAction(l._id, 'Approved')}>Approve</button>
                                                <button className="btn-danger" onClick={() => onAction(l._id, 'Rejected')}>Reject</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
