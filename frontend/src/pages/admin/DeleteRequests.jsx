import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAuth } from '../../utils/session'
import { getStudentDeleteRequests, approveStudentDeleteRequest } from '../../api'
import '../../pages/AdminPanel.css'

export default function DeleteRequests() {
    const [requests, setRequests] = useState([])
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => { fetchList() }, [])

    async function fetchList() {
        setError('')
        setLoading(true)
        try {
            const { token } = getAuth()
            const list = await getStudentDeleteRequests(token)
            setRequests(list || [])
        } catch (e) {
            console.error(e)
            setError(e.message || 'Failed to load requests')
        } finally { setLoading(false) }
    }

    async function onApprove(req) {
        if (!confirm('Approve and delete student ' + (req.studentEmail || req.studentId) + ' ?')) return
        try {
            const { token } = getAuth()
            await approveStudentDeleteRequest(req._id, token)
            alert('Approved and deleted')
            fetchList()
        } catch (e) { console.error(e); alert(e.message || 'Failed') }
    }

    return (
        <AdminLayout title="Delete Requests">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Student Delete Requests</h2>
                </header>

                <div className="admin-card">
                    {error && <div style={{ color: 'var(--error)', marginBottom: 12 }}>{error}</div>}

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                        <input
                            className="admin-input"
                            placeholder="Search name / email / roll / requested by / note"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            style={{ maxWidth: 400 }}
                        />
                        <button className="btn-secondary" onClick={() => setQuery('')}>Clear</button>
                    </div>

                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Class</th>
                                    <th>Section</th>
                                    <th>Roll No</th>
                                    <th>Requested By</th>
                                    <th>Note</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center' }}>Loading...</td></tr>
                                ) : requests.length === 0 ? (
                                    <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No delete requests found.</td></tr>
                                ) : (
                                    requests.filter(r => {
                                        const q = (query || '').trim().toLowerCase()
                                        if (!q) return true
                                        return (String(r.studentName || '').toLowerCase().includes(q)
                                            || String(r.studentEmail || '').toLowerCase().includes(q)
                                            || String(r.rollNo || '').toLowerCase().includes(q)
                                            || String(r.requestedByName || '').toLowerCase().includes(q)
                                            || String(r.note || '').toLowerCase().includes(q))
                                    }).map(r => (
                                        <tr key={r._id || r.id}>
                                            <td>{r.studentName || '-'}</td>
                                            <td>{r.studentEmail || '-'}</td>
                                            <td>{r.class || '-'}</td>
                                            <td>{r.section || '-'}</td>
                                            <td>{r.rollNo || '-'}</td>
                                            <td>{r.requestedByName || r.requestedBy || '-'}</td>
                                            <td>{r.note || '-'}</td>
                                            <td><span className="status-badge warning">{r.status || 'pending'}</span></td>
                                            <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                                            <td>
                                                <button className="btn-primary" onClick={() => onApprove(r)}>Approve</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
