import React, { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { createTimetable, getTimetable, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'

export default function FacultyTimetableAdmin() {
    const { token } = getAuth()
    // Admin only needs to provide a title, date and file for faculty timetables.
    // Backend requires a `class` value, so we send a fixed value `FACULTY`.
    const [name, setName] = useState('')
    const [date, setDate] = useState('')
    const [file, setFile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    async function loadHistory() {
        setLoadingHistory(true)
        try {
            const list = await getTimetable({ class: 'FACULTY' })
            const arr = Array.isArray(list) ? list : []
            arr.sort((a, b) => (new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt)))
            setHistory(arr)
        } catch (e) {
            setHistory([])
            console.warn('Failed to load faculty timetable history', e && e.message)
        } finally { setLoadingHistory(false) }
    }

    async function submit(e) {
        e.preventDefault()
        if (!file) return alert('Please choose a PDF or DOC/DOCX file to upload')
        try {
            setLoading(true)
            const fd = new FormData()
            // mark these uploads as faculty timetables
            fd.append('class', 'FACULTY')
            // include a name/title (use date if provided)
            const finalName = name ? `${name}${date ? ' - ' + date : ''}` : `Faculty Timetable ${date || ''}`
            fd.append('name', finalName)
            fd.append('file', file)
            await createTimetable(fd, token)
            alert('Timetable uploaded')
            // reset form
            setName('')
            setDate('')
            setFile(null)
        } catch (e) {
            alert('Upload failed: ' + (e && e.message ? e.message : String(e)))
        } finally { setLoading(false) }
    }

    return (
        <AdminLayout title="Faculty TimeTable">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Upload Faculty Timetable</h2>
                </header>

                <div className="admin-card">
                    <form onSubmit={submit} className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="form-group">
                            <label>Title</label>
                            <input className="admin-input" value={name} onChange={e => setName(e.target.value)} placeholder="Title (optional)" />
                        </div>
                        <div className="form-group">
                            <label>Date (visible to faculty)</label>
                            <input className="admin-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>File (PDF or DOC/DOCX)</label>
                            <input className="admin-file-input" type="file" accept=".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setFile(e.target.files && e.target.files[0])} />
                        </div>
                        <div className="btn-group">
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Uploading...' : 'Upload Timetable'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <div className="admin-page-header" style={{ marginBottom: 16 }}>
                        <h3>Upload History</h3>
                        <button className="btn-secondary" onClick={loadHistory} disabled={loadingHistory}>Refresh History</button>
                    </div>

                    {loadingHistory && <div className="info">Loading...</div>}
                    {!loadingHistory && history.length === 0 && <div className="empty-state">No faculty timetables uploaded yet.</div>}

                    {!loadingHistory && history.length > 0 && (
                        <div className="table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Uploaded Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(t => (
                                        <tr key={t._id}>
                                            <td>{t.name || 'Faculty Timetable'}</td>
                                            <td>{new Date(t.uploadedAt || t.createdAt).toLocaleString()}</td>
                                            <td>
                                                {t.filePath && <a className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }} href={(API_BASE || '') + t.filePath} target="_blank" rel="noreferrer">Open</a>}
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
