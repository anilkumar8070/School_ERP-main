import React, { useEffect, useState } from 'react'
import { getNotices, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'

export default function Notices() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    async function load() {
        setLoading(true)
        try {
            const { token } = getAuth()
            const res = await getNotices({}, token)
            setItems(res || [])
        } catch (e) { setItems([]) }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    const filtered = items.filter(n => {
        const q = (search || '').trim().toLowerCase()
        if (!q) return true
        return (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q)
    })

    return (
        <div className="student-page">
            <h3>Notices</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
                <input placeholder="Search notices by title or body" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(11,18,32,0.08)' }} />
            </div>
            {loading ? <p style={{ marginTop: 12 }}>Loading...</p> : null}

            <div className="resources-grid" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
                {filtered.map(n => (
                    <div key={n._id} className="resource-card" style={{ background: 'linear-gradient(180deg,#fff7ed,#ecfeff)', borderRadius: 12, padding: 14, boxShadow: '0 8px 24px rgba(11,18,32,0.06)', border: '1px solid rgba(11,18,32,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#0b1220' }}>{n.title}</div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{n.createdByName} • {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                            </div>
                            {n.filePath ? (
                                (() => {
                                    const href = n.filePath.startsWith('http') ? n.filePath : `${API_BASE}${n.filePath}`
                                    const filename = (n.filePath && n.filePath.split('/').pop()) || `${(n.title || 'notice').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.pdf`
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                                            <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', background: '#111827', color: '#fff', padding: '6px 10px', borderRadius: 8, fontWeight: 700 }}>View PDF</a>
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e && e.preventDefault()
                                                    try {
                                                        const { token } = getAuth()
                                                        const headers = {}
                                                        if (token) headers['Authorization'] = `Bearer ${token}`
                                                        const res = await fetch(href, { credentials: 'include', headers })
                                                        if (!res.ok) throw new Error('Failed to download file')
                                                        const blob = await res.blob()
                                                        const url = window.URL.createObjectURL(blob)
                                                        const a = document.createElement('a')
                                                        a.href = url
                                                        a.download = filename
                                                        document.body.appendChild(a)
                                                        a.click()
                                                        a.remove()
                                                        window.URL.revokeObjectURL(url)
                                                    } catch (err) {
                                                        console.error('Download failed', err)
                                                        alert('Failed to download file')
                                                    }
                                                }}
                                                style={{ textDecoration: 'none', border: '1px solid #111827', background: 'transparent', color: '#111827', padding: '6px 10px', borderRadius: 8, fontWeight: 700 }}
                                            >
                                                Download
                                            </button>
                                        </div>
                                    )
                                })()
                            ) : null}
                        </div>

                        <div style={{ marginTop: 12, color: '#0b1220', lineHeight: 1.45 }}>{n.body}</div>
                    </div>
                ))}
                {filtered.length === 0 && !loading && <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 18, color: '#6b7280' }}>No notices found.</div>}
            </div>
        </div>
    )
}
