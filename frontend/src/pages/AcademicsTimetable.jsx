import React, { useEffect, useState } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import './Academics.css'
import { createTimetable, API_BASE, regenerateTimetablePdf, getTimetable } from '../api'
import { getAuth } from '../utils/session'

function qs(name) { return new URLSearchParams(window.location.search).get(name) }

const defaultPeriods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6']
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function AcademicsTimetable() {
    const cls = qs('class') || '1'
    const sec = qs('section') || 'A'
    const [klass, setKlass] = useState(cls)
    const [section, setSection] = useState(sec)
    const [table, setTable] = useState({})
    const [file, setFile] = useState(null)

    useEffect(() => {
        const key = `timetable_${klass}_${section}`
        try { const raw = localStorage.getItem(key); if (raw) setTable(JSON.parse(raw)) } catch (e) { }
    }, [klass, section])

    useEffect(() => {
        // load history when page loads or when class/section changes
        loadHistory()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [klass, section])

    // Helper to request server to generate a PDF for current table content and return filePath
    async function generatePdf() {
        try {
            const { token } = getAuth()
            // Save to server first (without file) to get a record id
            const fd = new FormData()
            fd.append('class', klass)
            fd.append('section', section)
            fd.append('name', `Timetable for Class ${klass} ${section}`)
            fd.append('content', JSON.stringify(table))
            const created = await createTimetable(fd, token)
            // The backend already attempts to generate PDF when content is present
            if (created && created.filePath) return created.filePath
            // else try to call regenerate endpoint
            if (created && created._id) {
                const updated = await regenerateTimetablePdf(created._id, token)
                return updated && updated.filePath
            }
        } catch (e) {
            console.error('Failed to generate PDF', e)
        }
        return null
    }

    function setCell(day, period, val) {
        setTable(prev => ({ ...prev, [day]: { ...(prev[day] || {}), [period]: val } }))
    }

    const [saved, setSaved] = useState(null)
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    function save() {
        // Save timetable to server (DB) as JSON content
        const { token } = getAuth()
        const fd = new FormData()
        fd.append('class', klass)
        fd.append('section', section)
        fd.append('name', `Timetable for Class ${klass} ${section}`)
        try {
            fd.append('content', JSON.stringify(table))
        } catch (e) { fd.append('content', '') }
        if (file) fd.append('file', file)

        createTimetable(fd, token).then(async (res) => {
            // res should contain the created timetable doc; save it to show preview/download link
            setSaved(res)
            // if no filePath but content exists, try regenerating PDF for this record
            try {
                if ((!res.filePath || res.filePath === '') && res._id && res.content) {
                    const updated = await regenerateTimetablePdf(res._id, token)
                    setSaved(updated)
                    // update local table variable in case admin wants to preview
                }
            } catch (regenErr) {
                console.warn('Failed to regenerate PDF after save', regenErr)
            }
            alert('Timetable saved to server')
            // refresh history list
            loadHistory()
        }).catch(err => {
            console.error('Failed to save timetable', err)
            alert('Failed to save timetable: ' + (err.message || String(err)))
        })
    }

    async function loadHistory() {
        setLoadingHistory(true)
        try {
            const { token } = getAuth()
            const items = await getTimetable({ class: klass, section: section })
            setHistory(items || [])
        } catch (e) {
            console.error('Failed to load timetable history', e)
            setHistory([])
        } finally {
            setLoadingHistory(false)
        }
    }

    function onFileChange(e) {
        const f = e.target.files && e.target.files[0]
        setFile(f)
    }

    return (
        <AdminLayout title="Timetable Management">
            <div className="academics-page">
                <div className="academics-header">
                    <h1>Timetable — Class {klass} {section}</h1>
                    <div className="academics-controls">
                        <select value={klass} onChange={e => setKlass(e.target.value)}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>{`Class ${n}`}</option>)}
                        </select>
                        <select value={section} onChange={e => setSection(e.target.value)}>
                            {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 12 }}>
                    <h3>Upload Timetable</h3>
                    <p className="muted">Previous timetables uploaded for this class and section (most recent first).</p>
                    <div style={{ marginTop: 8 }}>
                        {loadingHistory ? (
                            <div className="small">Loading history...</div>
                        ) : history.length === 0 ? (
                            <div className="small">No timetables uploaded yet for this class/section.</div>
                        ) : (
                            history.map(t => (
                                <div key={t._id} className="card" style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{t.name || 'Timetable'}</div>
                                            <div className="small">Class: {t.class || 'N/A'} • Section: {t.section || 'ALL'}</div>
                                            <div className="small">Uploaded: {new Date(t.uploadedAt || t.createdAt).toLocaleString()}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {t.filePath ? (
                                                <a className="btn" href={(t.filePath && t.filePath.startsWith('http')) ? t.filePath : `${API_BASE}${t.filePath}`} target="_blank" rel="noreferrer">Open</a>
                                            ) : (
                                                <button className="btn outline" onClick={() => {
                                                    try {
                                                        const data = typeof t.content === 'string' ? t.content : JSON.stringify(t.content, null, 2)
                                                        const blob = new Blob([data], { type: 'application/json' })
                                                        const url = URL.createObjectURL(blob)
                                                        const a = document.createElement('a')
                                                        a.href = url
                                                        a.download = `${(t.name || 'timetable').replace(/[^a-z0-9\-_. ]/gi, '_')}.json`
                                                        document.body.appendChild(a)
                                                        a.click()
                                                        a.remove()
                                                        URL.revokeObjectURL(url)
                                                    } catch (e) { alert('Failed to download') }
                                                }}>Download</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="card">
                    <h3>Edit Timetable for Class {klass} {section}</h3>
                    <div style={{ marginBottom: 12 }}>
                        <label className="small">Optional: upload PDF/Excel file</label>
                        <input type="file" onChange={onFileChange} style={{ display: 'block', marginTop: 6 }} />
                    </div>
                    {saved && (
                        <div style={{ marginBottom: 12, marginTop: 6 }} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{saved.name || 'Saved timetable'}</div>
                                    <div className="small">Class: {saved.class} • Section: {saved.section}</div>
                                </div>
                                <div>
                                    {saved.filePath ? (
                                        <a className="btn" href={(saved.filePath && saved.filePath.startsWith('http')) ? saved.filePath : `${API_BASE}${saved.filePath}`} target="_blank" rel="noreferrer">Open / Download</a>
                                    ) : (
                                        <button className="btn outline" onClick={() => { try { const data = typeof saved.content === 'string' ? saved.content : JSON.stringify(saved.content, null, 2); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${(saved.name || 'timetable').replace(/[^a-z0-9\-_. ]/gi, '_')}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); } catch (e) { alert('Failed to download') } }}>Download JSON</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="timetable-wrap">
                        <table className="timetable">
                            <thead>
                                <tr><th>Day</th>{defaultPeriods.map(p => <th key={p}>{p}</th>)}</tr>
                            </thead>
                            <tbody>
                                {days.map(d => (
                                    <tr key={d}>
                                        <td className="day">{d}</td>
                                        {defaultPeriods.map((p, pi) => (
                                            <td key={p}>
                                                <input type="text" value={(table[d] && table[d][p]) || ''} onChange={e => setCell(d, p, e.target.value)} placeholder={`Subject ${pi + 1}`} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn outline" onClick={() => { setTable({}); setSaved(null); }}>Clear</button>
                            <button className="btn outline" onClick={async () => {
                                const fp = await generatePdf()
                                if (fp) {
                                    const url = (fp && fp.startsWith('http')) ? fp : `${API_BASE}${fp}`
                                    window.open(url, '_blank')
                                } else {
                                    alert('Failed to generate PDF')
                                }
                            }}>Generate PDF</button>
                        </div>
                        <div>
                            <button className="btn green" onClick={save}>Save Timetable</button>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
