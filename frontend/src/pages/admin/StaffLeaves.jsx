import React, { useEffect, useState, useMemo } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getLeaves, updateLeaveStatus } from '../../api'
import { getAuth } from '../../utils/session'

export default function StaffLeavesAdmin() {
    const [leaves, setLeaves] = useState([])
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    async function loadLeaves() {
        try {
            setLoading(true)
            const { token } = getAuth()
            // Attempt to filter staff leaves if backend supports; otherwise show all
            const items = await getLeaves({ role: 'staff' }, token).catch(async () => await getLeaves({}, token))
            setLeaves(Array.isArray(items) ? items : [])
        } catch (e) { setLeaves([]); setMessage(e.message || 'Failed to load leaves') }
        finally { setLoading(false) }
    }

    useEffect(() => { loadLeaves() }, [])

    const filtered = useMemo(() => {
        const q = (query || '').trim().toLowerCase()
        if (!q) return leaves
        return leaves.filter(l => (
            String(l.reason || '').toLowerCase().includes(q) ||
            String(l.status || '').toLowerCase().includes(q) ||
            String(l.user?.name || l.user?.username || '').toLowerCase().includes(q)
        ))
    }, [leaves, query])

    async function markAttendanceAbsentForRange(leave, token) {
        try {
            const from = new Date(leave.from)
            const to = new Date(leave.to)
            // Iterate dates inclusive
            const oneDay = 24 * 60 * 60 * 1000
            for (let d = new Date(from); d <= to; d = new Date(d.getTime() + oneDay)) {
                const iso = d.toISOString().slice(0, 10)
                // Use staff attendance endpoint via fetch to avoid frontend API mixing
                await fetch(`${window.location.origin.replace('5173', '4000')}/api/attendance/staff`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ date: iso, records: [{ userId: leave.userId || leave.user?._id, status: 'absent' }] })
                }).catch(() => { })
            }
        } catch (e) { /* best-effort; ignore */ }
    }

    async function actOnLeave(leave, status) {
        try {
            setLoading(true); setMessage('')
            const { token } = getAuth()
            await updateLeaveStatus(leave._id, status, '', token)
            if (status === 'Approved') {
                // Auto mark absent for the date range. If backend already handles this, this is harmless.
                await markAttendanceAbsentForRange(leave, token)
            }
            await loadLeaves()
            setMessage(`Leave ${status.toLowerCase()} successfully`)
        } catch (e) { setMessage(e.message || `Failed to ${status.toLowerCase()} leave`) }
        finally { setLoading(false) }
    }

    return (
        <AdminLayout title="Staff Leaves">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Staff Leave Requests</h2>
                    <input
                        className="admin-input"
                        placeholder="Search by name or reason"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{ maxWidth: 300 }}
                    />
                </header>

                {message && (
                    <div style={{ marginBottom: 16, padding: '10px', borderRadius: 'var(--radius-md)', background: message.includes('Failed') ? 'var(--danger-color)' : 'var(--success-color)', color: '#fff' }}>
                        {message}
                    </div>
                )}

                <div className="admin-card">
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Staff</th>
                                    <th>From</th>
                                    <th>To</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>{loading ? 'Loading…' : 'No staff leaves found.'}</td></tr>
                                )}
                                {filtered.map(l => (
                                    <tr key={l._id}>
                                        <td>{l.user?.name || l.user?.username || l.userId || '—'}</td>
                                        <td>{String(l.from).slice(0, 10)}</td>
                                        <td>{String(l.to).slice(0, 10)}</td>
                                        <td>{l.reason}</td>
                                        <td>
                                            <span className={`status-badge ${l.status === 'Approved' ? 'status-success' : l.status === 'Rejected' ? 'status-danger' : 'status-warning'}`}>
                                                {l.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="btn-group">
                                                <button className="btn-success" disabled={loading || l.status === 'Approved'} onClick={() => actOnLeave(l, 'Approved')}>Approve</button>
                                                <button className="btn-danger" disabled={loading || l.status === 'Rejected'} onClick={() => actOnLeave(l, 'Rejected')}>Reject</button>
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
