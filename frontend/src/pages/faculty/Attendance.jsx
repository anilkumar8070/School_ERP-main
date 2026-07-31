import React, { useState, useEffect } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getStudents, postAttendance, getAttendance, exportAttendanceCsv, API_BASE, getMyFaculty } from '../../api'
import BusyButton from '../../components/common/BusyButton'

export default function Attendance() {
    const [klass, setKlass] = useState('')
    const [section, setSection] = useState('')
    const [assigned, setAssigned] = useState(null)
    const [notAssigned, setNotAssigned] = useState(false)
    // use local date formatter to avoid UTC offset issues
    function formatLocalDate(d) { if (!d) return ''; const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}` }
    const [date, setDate] = useState(formatLocalDate(new Date()))
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(false)
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')

    // resolve faculty assignments on mount and load students when assigned
    useEffect(() => {
        async function resolve() {
            try {
                const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
                const f = await getMyFaculty(token).catch(() => null)
                if (!f || !Array.isArray(f.assignments) || f.assignments.length === 0) {
                    setNotAssigned(true)
                    setAssigned([])
                    setStudents([])
                    return
                }
                const map = {}
                for (const a of f.assignments || []) {
                    const cls = String(a.class || '')
                    if (!cls) continue
                    if (!map[cls]) map[cls] = { sections: new Set(), isClassTeacher: false }
                    if (a.section) map[cls].sections.add(String(a.section))
                    if (a.isClassTeacher) map[cls].isClassTeacher = true
                }
                const assignedList = Object.keys(map).map(k => ({ class: k, sections: Array.from(map[k].sections), isClassTeacher: !!map[k].isClassTeacher }))
                setAssigned(assignedList)
                setNotAssigned(false)
                if (assignedList.length > 0) {
                    setKlass(assignedList[0].class)
                    if (assignedList[0].isClassTeacher) setSection('')
                    else setSection(assignedList[0].sections[0] || '')
                }
            } catch (e) { console.warn('resolve assignments failed', e); setNotAssigned(true) }
        }
        resolve()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => { loadStudents(); }, [klass, section, date, notAssigned])

    // Listen for admin/faculty updates via SSE and refresh this view when matching
    useEffect(() => {
        if (!token) return
        const url = `${API_BASE}/api/notifications/stream?token=${encodeURIComponent(token)}`
        const es = new EventSource(url)
        function onUpdate(e) {
            try {
                const data = JSON.parse(e.data || '{}')
                if (data && data.type === 'student') {
                    const matchesClass = String(data.class || '') === String(klass || '')
                    const matchesSection = String(data.section || '') === String(section || '')
                    const matchesDate = String(data.date || '') === String(date || '')
                    if (matchesClass && matchesSection && matchesDate) {
                        loadStudents()
                    }
                }
            } catch { }
        }
        es.addEventListener('attendance_updated', onUpdate)
        return () => { es.removeEventListener('attendance_updated', onUpdate); es.close() }
    }, [klass, section, date, token])

    async function loadStudents() {
        // Do not load until assignment resolution completes. If faculty has no
        // assignments (`notAssigned`) clear students. If `assigned` is still
        // `null` we are resolving and should not fetch (avoids fetching all students).
        if (notAssigned) {
            setStudents([])
            return
        }
        if (assigned === null) return
        setLoading(true)
        try {
            if (!token) throw new Error('No token')
            const list = await getStudents({ class: klass, section }, token)
            // map to UI shape (default unmarked so faculty must choose)
            const base = list.map(s => ({ id: s._id, roll: s.rollNo || s.rollNo || s.roll || '', name: s.name, present: null, section: s.section || '' }))
            // auto-select section if not provided and students share one section
            try {
                const uniqSections = Array.from(new Set((list || []).map(x => x.section).filter(Boolean)))
                if (!section && uniqSections.length === 1) {
                    // set section and continue overlay
                    setSection(String(uniqSections[0]))
                }
            } catch { }
            // overlay existing attendance for selected date if present
            try {
                const items = await getAttendance({ class: klass, section, date }, token)
                const targetSection = String(section || '')
                const rec = (items || []).find(r => String(r.section || '') === targetSection) || (items || [])[0]
                if (rec && Array.isArray(rec.records)) {
                    const byId = {}
                    rec.records.forEach(r => { byId[String(r.studentId)] = r.status })
                    base.forEach(s => { if (byId[String(s.id)]) s.present = byId[String(s.id)] === 'present' })
                }
            } catch { }
            setStudents(base)
        } catch (e) {
            console.warn('Failed to load students', e)
            setStudents([])
        } finally { setLoading(false) }
    }

    function togglePresent(index) {
        setStudents(prev => { const next = [...prev]; next[index] = { ...next[index], present: !next[index].present }; return next })
    }
    function setPresent(index, value) {
        setStudents(prev => { const next = [...prev]; next[index] = { ...next[index], present: !!value }; return next })
    }

    async function submit() {
        try {
            if (!token) throw new Error('Not authenticated')
            if (notAssigned) return alert('You are not assigned to any class or section')
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const sel = new Date(date); sel.setHours(0, 0, 0, 0)
            if (sel > today) return alert('Cannot mark attendance for future dates')
            // require explicit marking for all students
            const unmarked = students.filter(s => !(s.present === true || s.present === false))
            if (unmarked.length > 0) return alert('Please mark Present/Absent for all students before saving')
            const records = students.map(s => ({ studentId: s.id, status: s.present === true ? 'present' : 'absent', markedBy: null }))
            const payload = { class: klass, section: section || '', date, records }
            const res = await postAttendance(payload, token)
            alert('Attendance saved')
            return res
        } catch (e) {
            console.error('Save attendance failed:', e)
            const msg = e && e.message ? e.message : 'Failed to save attendance'
            alert(msg)
        }
    }

    async function downloadStudentHistory(s) {
        try {
            if (!token) throw new Error('Not authenticated')
            const items = await getAttendance({ class: klass, section }, token)
            const rows = [['Date', 'Class', 'Section', 'Student', 'Roll', 'Status']]
                ; (items || []).forEach(item => {
                    const rec = Array.isArray(item.records) ? item.records.find(r => String(r.studentId) === String(s.id)) : null
                    if (rec) rows.push([item.date || '', klass || '', section || '', s.name || '', s.roll || '', rec.status || ''])
                })
            if (rows.length === 1) rows.push(['-', klass || '', section || '', s.name || '', s.roll || '', 'No records'])
            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '\"')}"`).join(',')).join('\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `attendance_history_${(s.roll || s.name || 'student').toString().replace(/\s+/g, '_')}.csv`
            a.click()
            URL.revokeObjectURL(url)
        } catch (e) { console.error(e); alert('Failed to download history: ' + (e.message || e)) }
    }

    async function downloadClassHistory() {
        try {
            if (!token) throw new Error('Not authenticated')
            const query = { class: klass }
            if (section) query.section = section
            if (fromDate) query.from = fromDate
            if (toDate) query.to = toDate
            const { blob, filename } = await exportAttendanceCsv(query, token)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename || 'attendance_students.csv'
            a.click()
            URL.revokeObjectURL(url)
        } catch (e) { console.error(e); alert('Failed to download history: ' + (e.message || e)) }
    }

    return (
        <FacultyLayout>
            <div className="faculty-page">
                <h2>Attendance</h2>
                <div className="card" style={{ padding: 16 }}>
                    <div className="faculty-filters">
                        {notAssigned ? (
                            <div style={{ padding: 8, color: 'crimson', fontWeight: 700 }}>Class not assigned</div>
                        ) : (assigned && assigned.length > 0 ? (
                            <>
                                <label>Class
                                    <select value={klass} onChange={e => {
                                        const val = e.target.value
                                        setKlass(val)
                                        const entry = (assigned || []).find(a => String(a.class) === String(val))
                                        if (entry) {
                                            if (entry.isClassTeacher) setSection('')
                                            else setSection(entry.sections && entry.sections.length > 0 ? String(entry.sections[0]) : '')
                                        } else {
                                            setSection('')
                                        }
                                    }}>
                                        {(assigned || []).map(a => <option key={a.class} value={String(a.class)}>Class {a.class}{a.isClassTeacher ? ' (All sections)' : ''}</option>)}
                                    </select>
                                </label>
                                <label>Section
                                    <select value={section} onChange={e => setSection(e.target.value)}>
                                        {(() => {
                                            const entry = (assigned || []).find(a => String(a.class) === String(klass))
                                            if (!entry) return [<option key="-" value="">-</option>]
                                            if (entry.isClassTeacher) {
                                                const opts = [<option key="all" value="">All Sections</option>]
                                                    ; (entry.sections || []).forEach(s => opts.push(<option key={s} value={String(s)}>{String(s)}</option>))
                                                return opts
                                            }
                                            return (entry.sections || []).map(s => <option key={s} value={String(s)}>{String(s)}</option>)
                                        })()}
                                    </select>
                                </label>
                                <label>Date
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                                </label>
                            </>
                        ) : (
                            // while assignments are being resolved, show placeholders
                            <>
                                <label>Class
                                    <select value={klass} onChange={e => setKlass(e.target.value)}>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>Class {n}</option>)}
                                    </select>
                                </label>
                                <label>Section
                                    <input type="text" value={section} onChange={e => setSection(e.target.value)} placeholder="A/B/C" />
                                </label>
                                <label>Date
                                    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                                </label>
                            </>
                        ))}
                    </div>

                    <div className="faculty-filters" style={{ marginTop: 12 }}>
                        <span style={{ alignSelf: 'center', fontWeight: 600 }}>History:</span>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="From" />
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="To" />
                        <button type="button" className="btn-outline" onClick={downloadClassHistory}>Download Class History</button>
                    </div>

                    <div className="table-container" style={{ marginTop: 12 }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead><tr><th>Roll</th><th>Name</th><th style={{ width: 220 }}>Status</th><th style={{ width: 160 }}>Download</th></tr></thead>
                            <tbody>
                                {loading ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>Loading...</td></tr> : (
                                    students.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>No students</td></tr> : (
                                        students.map((s, i) => (
                                            <tr key={s.id || i}>
                                                <td>{s.roll}</td>
                                                <td>{s.name}</td>
                                                <td>
                                                    <div className="attendance-radio-group">
                                                        <label className="attendance-radio-label">
                                                            <input type="radio" name={`status-${s.id || i}`} checked={s.present === true} onChange={() => setPresent(i, true)} />
                                                            Present
                                                        </label>
                                                        <label className="attendance-radio-label">
                                                            <input type="radio" name={`status-${s.id || i}`} checked={s.present === false} onChange={() => setPresent(i, false)} />
                                                            Absent
                                                        </label>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button type="button" onClick={() => downloadStudentHistory(s)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}>Download Excel</button>
                                                </td>
                                            </tr>
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <BusyButton disabled={notAssigned} className="btn-primary" asyncAction={submit}>Save Attendance</BusyButton>
                        <button className="btn-outline" onClick={() => window.location.reload()} disabled={notAssigned}>Refresh</button>
                        <button className="btn-outline" onClick={() => setStudents(prev => prev.map(s => ({ ...s, present: true })))} disabled={notAssigned}>Mark All Present</button>
                        <button className="btn-outline" onClick={() => setStudents(prev => prev.map(s => ({ ...s, present: false })))} disabled={notAssigned}>Mark All Absent</button>
                    </div>
                </div>
            </div>
        </FacultyLayout>
    )
}
