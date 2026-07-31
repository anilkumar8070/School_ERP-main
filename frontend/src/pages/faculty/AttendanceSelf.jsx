import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getAuth } from '../../utils/session'
import { getFacultyAttendance, postFacultyAttendance, exportFacultyAttendanceCsv, API_BASE, getMyFaculty } from '../../api'

export default function AttendanceSelf() {
    function formatLocalDate(d) { if (!d) return ''; const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}` }
    const [date, setDate] = useState(() => formatLocalDate(new Date()))
    const [status, setStatus] = useState('')
    const [myFacultyId, setMyFacultyId] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => { loadExisting() }, [date, myFacultyId])

    // Listen for admin updates via SSE so status stays in sync
    useEffect(() => {
        const { token } = getAuth() || {}
        if (!token) return
        const es = new EventSource(`${API_BASE}/api/notifications/stream?token=${encodeURIComponent(token)}`)
        function onUpdate(e) {
            try {
                const data = JSON.parse(e.data || '{}')
                if (data && data.type === 'faculty') {
                    if (String(data.date || '') === String(date || '')) loadExisting()
                }
            } catch { }
        }
        es.addEventListener('attendance_updated', onUpdate)
        return () => { es.removeEventListener('attendance_updated', onUpdate); es.close() }
    }, [date])

    // Resolve my Faculty document id once on mount
    useEffect(() => {
        (async () => {
            try {
                const { token } = getAuth()
                if (!token) return
                const fac = await getMyFaculty(token)
                if (fac && fac._id) setMyFacultyId(String(fac._id))
            } catch (e) {
                // leave myFacultyId empty; admin page may still allow manual mapping
            }
        })()
    }, [])

    async function loadExisting() {
        try {
            const { token } = getAuth()
            const items = await getFacultyAttendance({ date }, token)
            const rec = (items || [])[0]
            const my = rec && Array.isArray(rec.records) ? rec.records.find(r => String(r.facultyId) === String(myFacultyId)) : null
            setStatus(my ? (my.status || '') : '')
        } catch { setStatus('') }
    }

    async function markPresent() {
        try {
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const sel = new Date(date); sel.setHours(0, 0, 0, 0)
            if (sel > today) return alert('Cannot mark future dates')
            setSaving(true)
            const { token } = getAuth()
            const fid = myFacultyId
            if (!fid) return alert('Could not resolve your faculty profile. Please contact admin.')
            await postFacultyAttendance({ date, records: [{ facultyId: fid, status: 'present' }] }, token)
            setStatus('present')
            alert('Marked present')
        } catch (e) { alert(e.message || 'Failed to mark') } finally { setSaving(false) }
    }

    async function downloadHistory() {
        try {
            const { token, sub } = getAuth()
            const query = { facultyId: sub }
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

    return (
        <FacultyLayout>
            <div className="faculty-page">
                <h2>My Attendance</h2>
                <div className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
                        <div>
                            <strong>Status:</strong> {status ? (status === 'present' ? 'Present' : 'Absent') : 'Not marked'}
                        </div>
                        <button className="btn-primary" disabled={saving || status === 'present'} onClick={markPresent}>{saving ? 'Saving...' : (status === 'present' ? 'Already Present' : 'Mark Present')}</button>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>History:</span>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                        <button className="btn-outline" onClick={downloadHistory}>Download Attendance</button>
                    </div>
                </div>
            </div>
        </FacultyLayout>
    )
}
