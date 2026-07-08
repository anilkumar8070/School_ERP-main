import React, { useEffect, useState } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import { getAuth } from '../utils/session'
import { getComplaints, updateComplaintStatus } from '../api'
import { toast } from 'react-toastify'
import '../pages/AdminPanel.css'

export default function Complaints() {
    const [complaints, setComplaints] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function load() {
            setLoading(true)
            const { token } = getAuth()
            if (!token) {
                setError('Not authenticated')
                setLoading(false)
                return
            }
            try {
                const data = await getComplaints(token)
                setComplaints(data)
            } catch (err) {
                console.error('Failed to fetch complaints', err)
                setError('Failed to load complaints')
                toast.error('Failed to load complaints')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    async function changeStatus(comp, newStatus) {
        const { token } = getAuth()
        if (!token) return setError('Not authenticated')
        // ask for optional note
        const note = window.prompt('Add a note for this status change (optional):', '')
        try {
            const updated = await updateComplaintStatus(comp._id || comp.id, newStatus, note, token)
            setComplaints(prev => prev.map(p => (p._id === (updated._id || updated.id) ? updated : p)))
            toast.success('Complaint updated')
        } catch (err) {
            console.error(err)
            setError('Failed to update complaint')
            toast.error('Failed to update complaint')
        }
    }

    return (
        <AdminLayout title="Complaints">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Received Complaints</h2>
                </header>

                <div className="admin-card">
                    {loading && <div>Loading complaints...</div>}
                    {error && <div className="error-msg">{error}</div>}

                    {!loading && !error && (
                        <>
                            {complaints.length === 0 ? (
                                <div style={{ color: 'var(--text-secondary)' }}>No complaints submitted yet.</div>
                            ) : (
                                <div className="admin-table-wrapper">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>From</th>
                                                <th>Priority</th>
                                                <th>Status</th>
                                                <th>Subject</th>
                                                <th>Message</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {complaints.map(c => (
                                                <tr key={c._id || c.id}>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(c.createdAt || c.created).toLocaleString()}</td>
                                                    <td>{c.username || c.user || c.from || 'Unknown'}</td>
                                                    <td>
                                                        <span className={`status-badge ${c.priority ? c.priority.toLowerCase() : 'normal'}`} style={{
                                                            backgroundColor: c.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : c.priority === 'Low' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                            color: c.priority === 'High' ? '#ef4444' : c.priority === 'Low' ? '#10b981' : '#3b82f6'
                                                        }}>
                                                            {c.priority || 'Normal'}
                                                        </span>
                                                    </td>
                                                    <td>{c.status || 'Open'}</td>
                                                    <td>{c.subject || '-'}</td>
                                                    <td style={{ maxWidth: '300px' }}><div style={{ maxHeight: '60px', overflowY: 'auto' }}>{c.text}</div></td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            {c.status !== 'In Progress' && <button className="btn-secondary small" onClick={() => changeStatus(c, 'In Progress')}>Start</button>}
                                                            {c.status !== 'Resolved' && <button className="btn-primary small" onClick={() => changeStatus(c, 'Resolved')}>Resolve</button>}
                                                            {c.status !== 'Closed' && <button className="btn-danger small" onClick={() => changeStatus(c, 'Closed')}>Close</button>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
