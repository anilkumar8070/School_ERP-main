import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getTimetable, createTimetable, API_BASE } from '../../api'
import { openOrDownload } from '../../utils/download'
import { getAuth } from '../../utils/session'

export default function FacultyTimetable() {
    const { token } = getAuth()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    
    // Upload state
    const [name, setName] = useState('')
    const [date, setDate] = useState('')
    const [file, setFile] = useState(null)
    const [uploading, setUploading] = useState(false)

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

    async function submitUpload(e) {
        e.preventDefault()
        if (!file) return alert('Please choose a PDF or DOC/DOCX file to upload')
        try {
            setUploading(true)
            const fd = new FormData()
            fd.append('class', 'FACULTY')
            const finalName = name ? `${name}${date ? ' - ' + date : ''}` : `Faculty Timetable ${date || ''}`
            fd.append('name', finalName)
            fd.append('file', file)
            await createTimetable(fd, token)
            alert('Timetable uploaded successfully')
            setName('')
            setDate('')
            setFile(null)
            await load()
        } catch (e) {
            alert('Upload failed: ' + (e && e.message ? e.message : String(e)))
        } finally { setUploading(false) }
    }

    // helper: full URL for filePath or data URI
    function fullUrl(t) {
        if (!t) return ''
        if (t.filePath) return (API_BASE || '') + t.filePath
        return t.content ? `data:application/pdf;base64,${t.content}` : ''
    }

    return (
        <FacultyLayout title="Faculty TimeTable">
            <div className="faculty-page" style={{ padding: 20 }}>
                
                <div className="card" style={{ marginBottom: 20, padding: 20 }}>
                    <h3 style={{ marginTop: 0 }}>Upload Faculty Timetable</h3>
                    <form onSubmit={submitUpload} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 500, marginTop: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontWeight: 600, fontSize: '0.9em' }}>Title (optional)</label>
                            <input className="leaves-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly Schedule" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontWeight: 600, fontSize: '0.9em' }}>Date</label>
                            <input className="leaves-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontWeight: 600, fontSize: '0.9em' }}>File (PDF or DOC/DOCX)</label>
                            <input type="file" accept=".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setFile(e.target.files && e.target.files[0])} />
                        </div>
                        <div>
                            <button type="submit" className="action-btn" style={{ padding: '8px 16px', fontWeight: 600 }} disabled={uploading}>
                                {uploading ? 'Uploading...' : 'Upload Timetable'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ marginTop: 0 }}>Faculty Timetables (date-wise)</h3>
                    <div style={{ marginTop: 12 }}>
                        {loading && <div className="info">Loading...</div>}
                        {!loading && items.length === 0 && <div className="info" style={{ color: 'var(--text-muted)' }}>No faculty timetables uploaded yet.</div>}
                        {items.map(t => (
                            <div key={t._id} className="timetable-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
                                <div className="info-side">
                                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t.name || 'Faculty Timetable'}</div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginTop: 4 }}>Uploaded: {new Date(t.uploadedAt || t.createdAt).toLocaleString()}</div>
                                </div>
                                <div className="action-side" style={{ display: 'flex', gap: 8 }}>
                                    {t.filePath && <a className="action-btn" style={{ textDecoration: 'none' }} href={fullUrl(t)} target="_blank" rel="noreferrer">Open in browser</a>}
                                    {t.filePath && <button className="action-btn" onClick={() => openOrDownload(fullUrl(t))}>Download</button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </FacultyLayout>
    )
}
