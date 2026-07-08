import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAuth } from '../../utils/session'
import { getStudents, getAttendance, postAttendance, exportAttendanceCsv, API_BASE } from '../../api'

// Format Date to local YYYY-MM-DD (avoid UTC toISOString)
function formatLocalDate(d) {
    if (!d) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
}

export default function AdminStudentAttendance() {
    const [classFilter, setClassFilter] = useState('')
    const [sectionFilter, setSectionFilter] = useState('')
    const [date, setDate] = useState(() => formatLocalDate(new Date()))
    const [students, setStudents] = useState([])
    const [attendance, setAttendance] = useState({}) // map studentId -> status
    const [loading, setLoading] = useState(false)
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')

    useEffect(() => { loadStudents() }, [classFilter, sectionFilter])
    useEffect(() => { loadExisting() }, [date, classFilter, sectionFilter])

    // Live updates via SSE when faculty/admin update attendance elsewhere
    useEffect(() => {
        const { token } = getAuth() || {}
        if (!token) return
        // only connect when viewing attendance page
        const url = `${API_BASE}/api/notifications/stream?token=${encodeURIComponent(token)}`
        const es = new EventSource(url)
        function onMessage(e) {
            try {
                const data = JSON.parse(e.data || '{}')
                if (data && data.type === 'student') {
                    const matchesDate = String(data.date || '') === String(date || '')
                    if (!matchesDate) return
                    if (!classFilter && !sectionFilter) return loadExisting()
                    const matchesClass = String(data.class || '') === String(classFilter || '')
                    const matchesSection = String(data.section || '') === String(sectionFilter || '')
                    if (matchesClass && matchesSection) loadExisting()
                }
            } catch { }
        }
        es.addEventListener('attendance_updated', onMessage)
        return () => { es.removeEventListener('attendance_updated', onMessage); es.close() }
    }, [classFilter, sectionFilter, date])

    async function loadStudents() {
        try {
            const { token } = getAuth()
            const items = await getStudents({ class: classFilter, section: sectionFilter }, token)
            setStudents(items || [])
        } catch (e) { setStudents([]) }
    }

    async function loadExisting() {
        try {
            const { token } = getAuth()
            const map = {}
            if (!classFilter) {
                const items = await getAttendance({ date }, token)
                    ; (items || []).forEach(rec => {
                        if (Array.isArray(rec.records)) rec.records.forEach(r => { map[String(r.studentId)] = r.status })
                    })
                setAttendance(map)
                return
            }
            const items = await getAttendance({ class: classFilter, section: sectionFilter, date }, token)
            const targetSection = String(sectionFilter || '')
            const rec = (items || []).find(r => String(r.section || '') === targetSection) || (items || [])[0]
            if (rec && Array.isArray(rec.records)) rec.records.forEach(r => { map[String(r.studentId)] = r.status })
            setAttendance(map)
        } catch (e) { setAttendance({}) }
    }

    function setStatus(id, status) { setAttendance(prev => ({ ...prev, [String(id)]: status })) }

    async function save() {
        setLoading(true)
        try {
            const { token } = getAuth()
            const records = students.map(s => ({ studentId: s._id, status: attendance[String(s._id)] || 'present' }))
            await postAttendance({ class: String(classFilter || ''), section: String(sectionFilter || ''), date, records }, token)
            alert('Attendance saved')
        } catch (e) { alert(e.message || 'Failed to save') } finally { setLoading(false) }
    }

    function downloadCsv() {
        const rows = [['Date', 'Class', 'Section', 'Student', 'Roll', 'Status']]
        students.forEach(s => {
            const st = attendance[String(s._id)] || ''
            rows.push([date, classFilter || '', sectionFilter || '', s.name || '', s.rollNo || '', st])
        })
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '\"')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `attendance_students_${date}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    async function downloadHistoryCsv() {
        try {
            const { token } = getAuth()
            const query = {}
            if (classFilter) query.class = classFilter
            if (sectionFilter) query.section = sectionFilter
            if (fromDate) query.from = fromDate
            if (toDate) query.to = toDate
            const { blob, filename } = await exportAttendanceCsv(query, token)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename || 'attendance_students.csv'
            a.click()
            URL.revokeObjectURL(url)
        } catch (e) { alert(e.message || 'Failed to download') }
    }

    function downloadStudentCsv(s) {
        const st = attendance[String(s._id)] || ''
        const rows = [['Date', 'Class', 'Section', 'Student', 'Roll', 'Status'], [date, classFilter || '', sectionFilter || '', s.name || '', s.rollNo || '', st]]
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '\"')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `attendance_student_${(s.rollNo || s.name || 'record').toString().replace(/\s+/g, '_')}_${date}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <AdminLayout title="Student Attendance">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Student Attendance</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage and download daily student attendance.</p>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', alignItems: 'end' }}>
                        <div className="form-group">
                            <label>Class</label>
                            <input className="admin-input" placeholder="Class" value={classFilter} onChange={e => setClassFilter(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Section</label>
                            <input className="admin-input" placeholder="Section" value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Date</label>
                            <input className="admin-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-primary" onClick={save} disabled={!classFilter || loading} style={{ width: '100%' }}>{loading ? 'Saving...' : 'Save'}</button>
                            <button type="button" className="btn-secondary" onClick={downloadCsv} style={{ whiteSpace: 'nowrap' }}>Download CSV</button>
                        </div>
                    </div>

                    <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Export History</h4>
                        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end' }}>
                            <div className="form-group">
                                <label>From</label>
                                <input className="admin-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>To</label>
                                <input className="admin-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                            </div>
                            <button type="button" className="btn-secondary" onClick={downloadHistoryCsv}>Download History</button>
                        </div>
                    </div>

                    <div className="table-container" style={{ marginTop: 20 }}>
                        {students.length === 0 ? <div className="empty-state">No students found for filter.</div> : (
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Name</th><th>Roll</th><th>Status</th><th>Download</th></tr>
                                </thead>
                                <tbody>
                                    {students.map(s => (
                                        <tr key={s._id}>
                                            <td>{s.name}</td>
                                            <td>{s.rollNo || '-'}</td>
                                            <td>
                                                <select className="admin-select" value={attendance[String(s._id)] || ''} onChange={e => setStatus(s._id, e.target.value)} style={{ background: attendance[String(s._id)] === 'absent' ? '#fee2e2' : undefined }}>
                                                    <option value="">—</option>
                                                    <option value="present">Present</option>
                                                    <option value="absent">Absent</option>
                                                </select>
                                            </td>
                                            <td>
                                                <button className="btn-secondary" type="button" onClick={() => downloadStudentCsv(s)}>Download CSV</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
