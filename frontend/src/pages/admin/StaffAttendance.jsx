import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getStaffList, postStaffAttendance, exportAttendanceExcel } from '../../api'
import { getAuth } from '../../utils/session'

export default function StaffAttendanceAdmin() {
    function formatLocalDate(d) { if (!d) return ''; const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}` }
    const [date, setDate] = useState(() => formatLocalDate(new Date()))
    const [staff, setStaff] = useState([])
    const [marks, setMarks] = useState({})
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        // Load staff list via existing staff API
        async function loadStaff() {
            try {
                const { token } = getAuth()
                const rows = await getStaffList(token)
                const safeRows = Array.isArray(rows) ? rows : []
                setStaff(safeRows)
                const initial = {}
                safeRows.forEach(s => { if (s && s._id) initial[s._id] = 'present' })
                setMarks(initial)
            } catch (e) { setMessage(e.message || 'Failed to load staff list') }
        }
        loadStaff()
    }, [])

    function toggle(id, status) {
        setMarks(prev => ({ ...prev, [id]: status }))
    }

    async function save() {
        setLoading(true); setMessage('')
        try {
            const records = staff.map(s => ({ userId: s._id, status: marks[s._id] || 'present' }))
            const { token } = getAuth()
            await postStaffAttendance({ date, records }, token)
            setMessage('Attendance saved')
        } catch (e) { setMessage(e.message || 'Failed to save attendance') }
        setLoading(false)
    }

    async function handleExport() {
        try {
            const { token } = getAuth()
            await exportAttendanceExcel({ from: date, to: date }, token)
        } catch (e) {
            setMessage(e.message || 'Failed to export excel')
        }
    }

    return (
        <AdminLayout title="Staff Attendance">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Staff Attendance</h2>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ gridTemplateColumns: 'minmax(200px, 300px) auto auto' }}>
                        <div className="form-group">
                            <label>Date</label>
                            <input type="date" className="admin-input" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <button className="btn-primary" onClick={save} disabled={loading} style={{ alignSelf: 'end' }}>{loading ? 'Saving...' : 'Save Attendance'}</button>
                        <button className="btn-secondary" onClick={handleExport} style={{ alignSelf: 'end' }}>Export Excel</button>
                    </div>
                    {message && <div style={{ marginTop: 16, padding: '10px', borderRadius: 'var(--radius-md)', background: message.includes('Failed') ? 'var(--danger-color)' : 'var(--primary-color)', color: '#fff', opacity: 0.9 }}>{message}</div>}
                </div>

                <div className="admin-card">
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Sr No</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staff.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No staff found</td></tr>}
                                {staff.map((s, idx) => (
                                    <tr key={s._id}>
                                        <td>{idx + 1}</td>
                                        <td>{s.name || s.username}</td>
                                        <td>{s.email || s.username}</td>
                                        <td>
                                            <select
                                                className="admin-select"
                                                value={marks[s._id] || 'present'}
                                                onChange={e => toggle(s._id, e.target.value)}
                                                style={{
                                                    maxWidth: 150,
                                                    background: marks[s._id] === 'absent' ? '#fee2e2' : marks[s._id] === 'leave' ? '#fef3c7' : undefined
                                                }}
                                            >
                                                <option value="present">Present</option>
                                                <option value="absent">Absent</option>
                                                <option value="leave">Leave</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
