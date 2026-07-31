import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getAuth } from '../../utils/session'
import { getFaculty, getFacultyAttendance, postFacultyAttendance, exportFacultyAttendanceCsv, API_BASE } from '../../api'

export default function AdminFacultyAttendance() {
    function formatLocalDate(d) { if (!d) return ''; const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}` }
    const [date, setDate] = useState(() => formatLocalDate(new Date()))
    const [list, setList] = useState([])
    const [attendance, setAttendance] = useState({})
    const [loading, setLoading] = useState(false)
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')

    useEffect(() => { loadFaculty() }, [])
    useEffect(() => { loadExisting() }, [date])

    // Subscribe to SSE updates to auto-refresh when faculty attendance changes
    useEffect(() => {
        const { token } = getAuth() || {}
        if (!token) return
        const es = new EventSource(`${API_BASE}/api/notifications/stream?token=${encodeURIComponent(token)}`)
        function onUpdate(e) {
            try {
                const data = JSON.parse(e.data || '{}')
                if (data && data.type === 'faculty') {
                    // refresh if same date
                    if (String(data.date || '') === String(date || '')) loadExisting()
                }
            } catch { }
        }
        es.addEventListener('attendance_updated', onUpdate)
        return () => { es.removeEventListener('attendance_updated', onUpdate); es.close() }
    }, [date])

    // Lightweight polling fallback in case SSE is blocked or drops
    useEffect(() => {
        const id = setInterval(() => { loadExisting() }, 15000)
        return () => clearInterval(id)
    }, [date])

    async function loadFaculty() {
        try { const { token } = getAuth(); const items = await getFaculty({}, token); setList(items || []) } catch (e) { setList([]) }
    }

    async function loadExisting() {
        try { const { token } = getAuth(); const items = await getFacultyAttendance({ date }, token); const rec = (items || [])[0]; const map = {}; if (rec && Array.isArray(rec.records)) rec.records.forEach(r => { map[String(r.facultyId)] = r.status }); setAttendance(map) } catch (e) { setAttendance({}) }
    }

    function setStatus(id, status) { setAttendance(prev => ({ ...prev, [String(id)]: status })) }

    async function save() {
        setLoading(true)
        try {
            const { token } = getAuth()
            const records = list.map(f => ({ facultyId: f._id, status: attendance[String(f._id)] || 'present' }))
            await postFacultyAttendance({ date, records }, token)
            // Refresh local view after successful save
            try { await loadExisting() } catch (e) { /* ignore */ }
            alert('Attendance saved')
        } catch (e) { alert(e.message || 'Failed to save') } finally { setLoading(false) }
    }

    function downloadCsv() {
        const rows = [['Date', 'Faculty', 'EmployeeId', 'Subject', 'Status']]
        list.forEach(f => { const st = attendance[String(f._id)] || ''; rows.push([date, f.name || '', f.employeeId || '', f.subject || '', st]) })
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '\"')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `attendance_faculty_${date}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    async function downloadHistoryCsv() {
        try {
            const { token } = getAuth()
            const query = {}
            if (fromDate) query.from = fromDate
            if (toDate) query.to = toDate
            const { blob, filename } = await exportFacultyAttendanceCsv(query, token)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename || 'attendance_faculty.csv'
            a.click()
            URL.revokeObjectURL(url)
        } catch (e) { alert(e.message || 'Failed to download') }
    }

    function downloadFacultyCsv(f) {
        // Prefer server-side export for full history up to selected date (or between from/to if provided)
        (async () => {
            try {
                const { token } = getAuth() || {}
                const query = { facultyId: f._id }
                // include date range if specified by admin controls
                if (fromDate) query.from = fromDate
                // if toDate is provided use that, otherwise use currently selected `date` as upper bound
                query.to = toDate || date
                const { blob, filename } = await exportFacultyAttendanceCsv(query, token)
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = filename || `attendance_faculty_${(f.employeeId || f.name || 'record').toString().replace(/\s+/g, '_')}_${query.to || ''}.csv`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
                return
            } catch (e) {
                // fallback to single-day CSV if server export fails
                const st = attendance[String(f._id)] || ''
                const rows = [['Date', 'Faculty', 'EmployeeId', 'Subject', 'Status'], [date, f.name || '', f.employeeId || '', f.subject || '', st]]
                const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '\"')}"`).join(',')).join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `attendance_faculty_${(f.employeeId || f.name || 'record').toString().replace(/\s+/g, '_')}_${date}.csv`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
            }
        })()
    }

    return (
        <AdminLayout title="Faculty Attendance">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Faculty Attendance</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Manage and monitor faculty attendance.</p>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', alignItems: 'end' }}>
                        <div className="form-group">
                            <label>Date</label>
                            <input type="date" className="admin-input" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-secondary" type="button" onClick={loadExisting}>Refresh</button>
                            <button className="btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
                            <button className="btn-secondary" type="button" onClick={downloadCsv} style={{ whiteSpace: 'nowrap' }}>Download CSV</button>
                        </div>
                    </div>

                    <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Export History</h4>
                        <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end' }}>
                            <div className="form-group">
                                <label>From</label>
                                <input type="date" className="admin-input" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="From" />
                            </div>
                            <div className="form-group">
                                <label>To</label>
                                <input type="date" className="admin-input" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="To" />
                            </div>
                            <button type="button" className="btn-secondary" onClick={downloadHistoryCsv}>Download History</button>
                        </div>
                    </div>

                    <div className="table-container" style={{ marginTop: 20 }}>
                        {list.length === 0 ? <div className="empty-state">No faculty found.</div> : (
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Name</th><th>Employee ID</th><th>Subject</th><th>Status</th><th>Download</th></tr>
                                </thead>
                                <tbody>
                                    {list.map(f => (
                                        <tr key={f._id}>
                                            <td>{f.name}</td>
                                            <td>{f.employeeId || '-'}</td>
                                            <td>{f.subject || '-'}</td>
                                            <td>
                                                <select className="admin-select" value={attendance[String(f._id)] || ''} onChange={e => setStatus(f._id, e.target.value)} style={{ background: attendance[String(f._id)] === 'absent' ? '#fee2e2' : undefined }}>
                                                    <option value="">—</option>
                                                    <option value="present">Present</option>
                                                    <option value="absent">Absent</option>
                                                </select>
                                            </td>
                                            <td>
                                                <button type="button" className="btn-secondary" onClick={() => downloadFacultyCsv(f)}>Download CSV</button>
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
