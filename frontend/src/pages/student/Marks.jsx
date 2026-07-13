import React, { useEffect, useState, useMemo } from 'react'
import { getMyMarks } from '../../api'

export default function Marks() {
    const [marks, setMarks] = useState([])
    const [loading, setLoading] = useState(true)
    const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')

    useEffect(() => { load() }, [])

    async function load() {
        setLoading(true)
        try {
            if (!token) throw new Error('Not authenticated')
            const data = await getMyMarks(token)
            setMarks(data || [])
        } catch (e) { console.warn('Failed to load marks', e); setMarks([]) }
        finally { setLoading(false) }
    }

    // group marks by subject
    const bySubject = useMemo(() => {
        const map = new Map()
            ; (marks || []).forEach(m => {
                const subj = m.subject || (m.raw && m.raw.subject) || 'General'
                const key = typeof subj === 'object' ? (subj.name || subj.title || JSON.stringify(subj)) : String(subj)
                if (!map.has(key)) map.set(key, [])
                map.get(key).push(m)
            })
        return Array.from(map.entries()).map(([subject, list]) => ({ subject, list }))
    }, [marks])

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>My Marks</h3>
                <button
                    className="btn primary sm"
                    onClick={load}
                    disabled={loading}
                >
                    {loading ? 'Thinking...' : 'Refresh'}
                </button>
            </header>

            {loading ? (
                <div className="text-muted">Loading marks...</div>
            ) : (
                <div className="flex flex-col gap-6">
                    {bySubject.length === 0 ? (
                        <div className="text-muted">No marks available.</div>
                    ) : bySubject.map(group => (
                        <section key={group.subject} className="card p-6">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-subtle">
                                <div className="text-lg font-bold text-main">{group.subject}</div>
                                <div className="text-sm text-muted">{group.list.length} entry(s)</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="student-table w-full">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Title / Exam</th>
                                            <th>Obtained</th>
                                            <th>Total</th>
                                            <th>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.list.map(m => (
                                            <tr key={m._id || `${m.subject}_${m._student}_${Math.random()}`}>
                                                <td>{new Date(m.createdAt || m.date || Date.now()).toLocaleDateString()}</td>
                                                <td className="font-medium text-main">{m.title || (m.raw && m.raw.title) || (m.test || '')}</td>
                                                <td><span className="font-bold text-primary text-lg">{m.obtained != null ? m.obtained : '—'}</span></td>
                                                <td><span className="text-muted">{m.total != null ? m.total : '—'}</span></td>
                                                <td>
                                                    {m.remarks ? (
                                                        <span className="text-sm text-muted italic">{m.remarks || (m.raw && m.raw.remarks)}</span>
                                                    ) : (
                                                        <span className="text-muted text-xs">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    )
}
