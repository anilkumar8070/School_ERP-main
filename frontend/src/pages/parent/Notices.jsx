import React, { useEffect, useState } from 'react'
import ParentLayout from '../../components/parent/ParentLayout'
import { getNotices, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'

export default function ParentNotices() {
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
        <ParentLayout>
            <div className="parent-page">
                <h2>Notices</h2>
                <div className="mt-4 flex gap-3 items-center">
                    <input
                        placeholder="Search notices by title or body"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="search-input"
                    />
                </div>
                {loading ? <p className="mt-4 text-subtle">Loading...</p> : null}

                <div className="responsive-grid">
                    {filtered.map(n => (
                        <div key={n._id} className="notice-card">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="notice-title">{n.title}</div>
                                    <div className="notice-meta">{n.createdByName} • {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                                </div>
                                {n.filePath ? (
                                    (() => {
                                        const href = n.filePath.startsWith('http') ? n.filePath : `${API_BASE}${n.filePath}`
                                        return (
                                            <div className="flex flex-col gap-2 items-end ml-2">
                                                <a href={href} target="_blank" rel="noreferrer" className="btn-primary text-xs py-1 px-2 rounded">View</a>
                                                <a href={href} download target="_blank" rel="noreferrer" className="btn-secondary text-xs py-1 px-2 rounded">Save</a>
                                            </div>
                                        )
                                    })()
                                ) : null}
                            </div>

                            <div className="notice-body">{n.body}</div>
                        </div>
                    ))}
                    {filtered.length === 0 && !loading && <div className="text-center p-4 text-subtle col-span-full">No notices found.</div>}
                </div>
            </div>
        </ParentLayout>
    )
}
