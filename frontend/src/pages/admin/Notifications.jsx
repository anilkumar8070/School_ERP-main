import React, { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAuth } from '../../utils/session'
import { API_BASE } from '../../api'
import '../../pages/AdminPanel.css'
import { toast } from 'react-toastify'

export default function AdminNotifications() {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const { token } = getAuth()
        if (!token) return

        let source = new EventSource(`${API_BASE}/api/notifications/stream?token=${token}`)
        
        source.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (Array.isArray(data)) {
                    setNotifications(prev => {
                        // Avoid duplicates if multiple arrays are sent, though stream usually sends events
                        // Prepending the array
                        return [...data, ...prev]
                    })
                } else {
                    setNotifications(prev => [data, ...prev])
                }
                setLoading(false)
            } catch (err) {
                console.error('Error parsing notification', err)
            }
        }
        
        source.onerror = (err) => {
            console.error('EventSource error:', err)
            setLoading(false)
        }

        return () => {
            source.close()
        }
    }, [])

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        try {
            const { token } = getAuth()
            await fetch(`${API_BASE}/api/notifications/mark-read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            })
            toast.success('All notifications marked as read')
        } catch (e) {
            toast.error('Failed to mark as read')
        }
    }

    return (
        <AdminLayout title="Notifications">
            <div className="admin-page">
                <header className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>Notifications</h2>
                    <button className="btn-secondary" onClick={markAllAsRead}>
                        Mark all as read
                    </button>
                </header>

                <div className="admin-card">
                    <h3 className="section-title">Recent Notifications</h3>
                    
                    {loading && notifications.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center' }}>Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center' }}>No notifications found.</div>
                    ) : (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Message</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {notifications.map((n, i) => (
                                        <tr key={n._id || i} style={{ background: n.read ? 'transparent' : 'var(--bg-secondary)', fontWeight: n.read ? 'normal' : 'bold' }}>
                                            <td>
                                                <span className="status-badge" style={{ textTransform: 'capitalize' }}>
                                                    {n.type || 'System'}
                                                </span>
                                            </td>
                                            <td>{n.message}</td>
                                            <td>{n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Just now'}</td>
                                            <td>
                                                {n.read ? (
                                                    <span style={{ color: 'var(--text-secondary)' }}>Read</span>
                                                ) : (
                                                    <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Unread</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
