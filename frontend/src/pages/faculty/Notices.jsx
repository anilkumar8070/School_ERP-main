import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getNotices, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'
import { openOrDownload } from '../../utils/download'

export default function FacultyNotices() {
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
        <FacultyLayout title="Notices">
            <div className="faculty-page">
                <h2>Notices</h2>
                <div className="faculty-search-header">
                    <input placeholder="Search notices by title or body" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {loading ? <p style={{ marginTop: 12 }}>Loading...</p> : null}

                <div style={{ marginTop: 12 }}>
                    {filtered.map(n => (
                        <div key={n._id} className="timetable-card" style={{ display: 'block' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{n.title}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                        {n.createdByName} • {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                                    </div>
                                </div>
                                {n.filePath && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            className="btn outline"
                                            onClick={() => openOrDownload(n.filePath.startsWith('http') ? n.filePath : `${API_BASE}${n.filePath}`)}
                                        >
                                            View Attachment
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div style={{ marginTop: 12, color: 'var(--text-main)', lineHeight: 1.5, fontSize: 14 }}>
                                {n.body}
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && !loading && <div style={{ padding: 18, color: 'var(--text-muted)' }}>No notices found.</div>}
                </div>
            </div>
        </FacultyLayout>
    )
}
