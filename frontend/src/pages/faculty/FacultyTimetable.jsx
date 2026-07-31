import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getTimetable, API_BASE } from '../../api'
import { openOrDownload } from '../../utils/download'
import { getAuth } from '../../utils/session'

export default function FacultyTimetable() {
    const { token } = getAuth()
    const [items, setItems] = useState([])
    // preview removed in favor of open/download behavior
    const [loading, setLoading] = useState(false)

    async function load() {
        setLoading(true)
        try {
            // fetch all timetables uploaded with class=FACULTY
            const list = await getTimetable({ class: 'FACULTY' })
            const arr = Array.isArray(list) ? list : []
            // sort by uploadedAt/createdAt descending
            arr.sort((a, b) => (new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt)))
            setItems(arr)
        } catch (e) { alert('Failed to load timetables: ' + (e && e.message ? e.message : String(e))) }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    // helper: full URL for filePath or data URI
    function fullUrl(t) {
        if (!t) return ''
        if (t.filePath) return (API_BASE || '') + t.filePath
        return t.content ? `data:application/pdf;base64,${t.content}` : ''
    }

    return (
        <FacultyLayout title="Faculty TimeTable">
            <div style={{ padding: 20 }}>
                <h3>Faculty Timetables (date-wise)</h3>
                <div style={{ marginTop: 12 }}>
                    {loading && <div className="info">Loading...</div>}
                    {!loading && items.length === 0 && <div className="info">No faculty timetables uploaded yet.</div>}
                    {items.map(t => (
                        <div key={t._id} className="timetable-card">
                            <div className="info-side">
                                <div style={{ fontWeight: 700 }}>{t.name || 'Faculty Timetable'}</div>
                                <div className="small">Uploaded: {new Date(t.uploadedAt || t.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="action-side">
                                {t.filePath && <a className="btn outline" href={fullUrl(t)} target="_blank" rel="noreferrer">Open</a>}
                                {t.filePath && <button className="btn" onClick={() => openOrDownload(fullUrl(t))}>Open / Download</button>}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Preview removed — files open in new tab or download via the Open / Download button */}
            </div>
        </FacultyLayout>
    )
}
