import React, { useEffect, useState } from 'react'
import StaffLayout from '../../components/staff/StaffLayout'
import { getNotices, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'

export default function StaffNotices() {
    const [notices, setNotices] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    async function load() {
        setLoading(true)
        setError('')
        try {
            const { token } = getAuth()
            if (!token) throw new Error('Not authenticated')
            const items = await getNotices({}, token)
            setNotices(items || [])
        } catch (e) {
            console.error('Failed to load staff notices', e)
            setError(e?.message || 'Failed to load')
            setNotices([])
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    return (
        <StaffLayout title="Notices">
            <div className="parent-page">
                <h2>Notices</h2>
                {error && <div className="error">{error}</div>}
                {loading && <div>Loading notices…</div>}
                {!loading && (!notices || notices.length === 0) && <div>No notices.</div>}
                {!loading && notices && notices.length > 0 && (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {notices.map(n => (
                            <div key={n._id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontWeight: 800 }}>{n.title}</div>
                                <div style={{ color: '#6b7280', fontSize: 13 }}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''} • Targets: {(n.targets || []).join(', ')}</div>
                                <div style={{ marginTop: 8 }}>{n.body}</div>
                                <div style={{ marginTop: 8 }}>{n.filePath ? (() => { const href = n.filePath.startsWith('http') ? n.filePath : (API_BASE + n.filePath); return <a href={href} target="_blank" rel="noreferrer">Attachment</a> })() : null}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </StaffLayout>
    )
}
