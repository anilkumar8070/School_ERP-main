import React, { useEffect, useState } from 'react'
import { getAuth } from '../../utils/session'
import { getMyStudent } from '../../api'
import { getTimetable, API_BASE } from '../../api'

export default function Timetable() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    async function load() {
        try {
            const { token } = getAuth()
            const stu = await getMyStudent(token)
            const cls = stu.class
            const sec = stu.section || 'ALL'
            const res = await getTimetable({ class: cls, section: sec })
            setItems(res || [])
            setError(null)
        } catch (e) {
            console.error(e)
            setError('Failed to load timetable')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // initial load and periodic refresh so students see admin updates
        load()
        const id = setInterval(() => {
            load()
        }, 20000)
        return () => clearInterval(id)
    }, [])

    function downloadTimetable(t) {
        try {
            const data = typeof t.content === 'string' ? t.content : JSON.stringify(t.content, null, 2)
            const blob = new Blob([data], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const safeName = (t.name || 'timetable').replace(/[^a-z0-9\-_. ]/gi, '_')
            a.download = `${safeName}.json`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (e) {
            console.error('Download failed', e)
            alert('Failed to download timetable')
        }
    }

    if (loading) return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Timetable</h3>
            </header>
            <div className="text-muted">Loading...</div>
        </div>
    )
    if (error) return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Timetable</h3>
            </header>
            <div className="text-muted">{error}</div>
        </div>
    )

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Timetable</h3>
                <div className="flex gap-2">
                    <button className="btn outline sm" onClick={() => {
                        // download latest available timetable
                        if (!items || items.length === 0) { alert('No timetable available for download'); return }
                        const latest = items[0]
                        if (latest.filePath) {
                            const url = (latest.filePath && latest.filePath.startsWith('http')) ? latest.filePath : `${API_BASE}${latest.filePath}`
                            window.open(url, '_blank')
                        } else if (latest.content) {
                            downloadTimetable(latest)
                        } else {
                            alert('No downloadable timetable available')
                        }
                    }}>Download Latest</button>
                    <button className="btn primary sm" onClick={() => { setLoading(true); load() }}>Refresh</button>
                </div>
            </header>

            {items.length === 0 && <div className="text-muted">No timetable uploaded for your class/section.</div>}

            <div className="flex flex-col gap-6">
                {items.map(t => (
                    <div key={t._id} className="card p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-subtle">
                            <div>
                                <div className="text-lg font-bold text-main">{t.name || 'Timetable'}</div>
                                <div className="text-sm text-muted mt-1">Class: <span className="text-main font-medium">{t.class || 'N/A'}</span> • Section: <span className="text-main font-medium">{t.section || 'ALL'}</span></div>
                                <div className="text-xs text-muted mt-0.5">Uploaded: {new Date(t.uploadedAt || t.createdAt).toLocaleDateString()}</div>
                            </div>
                            <div className="flex gap-2">
                                {t.filePath ? (
                                    <a className="btn outline sm" href={(t.filePath && t.filePath.startsWith('http')) ? t.filePath : `${API_BASE}${t.filePath}`} target="_blank" rel="noreferrer">Download PDF</a>
                                ) : null}
                                {!t.filePath && t.content ? (
                                    <button className="btn outline sm" onClick={() => downloadTimetable(t)}>Download JSON</button>
                                ) : null}
                            </div>
                        </div>

                        {t.content && (() => {
                            let content = null
                            try {
                                content = typeof t.content === 'string' ? JSON.parse(t.content) : t.content
                            } catch (e) {
                                content = null
                            }

                            if (!content || typeof content !== 'object') {
                                return (
                                    <div className="mt-2 text-sm">
                                        <div className="text-muted mb-2">Saved timetable (raw)</div>
                                        <pre className="bg-surface rounded p-4 text-xs overflow-x-auto custom-scrollbar text-main border border-subtle whitespace-pre-wrap word-break">{typeof t.content === 'string' ? t.content : String(t.content)}</pre>
                                    </div>
                                )
                            }

                            // derive ordered periods across days
                            const days = Object.keys(content || {})
                            const periodOrder = []
                            const seen = new Set()
                            for (const d of days) {
                                const row = content[d] || {}
                                for (const p of Object.keys(row)) {
                                    if (!seen.has(p)) { seen.add(p); periodOrder.push(p) }
                                }
                            }

                            return (
                                <div className="mt-2 overflow-x-auto custom-scrollbar">
                                    <table className="student-table w-full text-center">
                                        <thead>
                                            <tr>
                                                <th className="text-left bg-surface-hover">Day</th>
                                                {periodOrder.map(p => <th key={p}>{p}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {days.map(d => (
                                                <tr key={d}>
                                                    <td className="font-bold text-main bg-surface-hover text-left">{d}</td>
                                                    {periodOrder.map(p => <td key={p} className="text-muted">{(content[d] && (content[d][p] || '')) || '—'}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        })()}
                    </div>
                ))}
            </div>
        </div>
    )
}

