import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getStudents, changeStudentClass, facultyBlockStudent, requestStudentDeletion, getReceiptsByStudent, setStudentStream, getMyFaculty } from '../../api'
import { getAuth } from '../../utils/session'
import '../Faculty.css'

export default function Students() {
    const [klass, setKlass] = useState('')
    const [section, setSection] = useState('')
    const [assigned, setAssigned] = useState(null) // faculty assignment info
    const [notAssigned, setNotAssigned] = useState(false)
    const [availableSections, setAvailableSections] = useState({}) // class -> [sections]
    const [gender, setGender] = useState('')
    const [category, setCategory] = useState('')
    const [religion, setReligion] = useState('')
    const [students, setStudents] = useState([])
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [receiptsMap, setReceiptsMap] = useState({}) // studentId -> receipts array

    useEffect(() => {
        // On mount: resolve faculty assignments and set available class/section
        async function resolveAssignments() {
            setError('')
            setLoading(true)
            try {
                const { token } = getAuth()
                const f = await getMyFaculty(token).catch(() => null)
                if (!f || !Array.isArray(f.assignments) || f.assignments.length === 0) {
                    setNotAssigned(true)
                    setAssigned([])
                    setStudents([])
                    setLoading(false)
                    return
                }
                // build map class -> sections and detect class-teacher privileges
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
                // pick default class
                if (assignedList.length > 0) {
                    setKlass(assignedList[0].class)
                    if (assignedList[0].isClassTeacher) setSection('')
                    else setSection(assignedList[0].sections[0] || '')
                }
            } catch (e) {
                console.error('Failed to resolve faculty assignments', e)
                setError('Failed to resolve assignments')
            } finally { setLoading(false) }
        }
        resolveAssignments()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // load students whenever selection changes (but only if assigned)
    useEffect(() => {
        async function load() {
            setError('')
            setLoading(true)
            try {
                if (notAssigned) { setStudents([]); return }
                const { token } = getAuth()
                const list = await getStudents({ class: klass, section: (section === 'ALL' ? '' : section), gender, category, religion }, token)
                setStudents(list || [])
                // if current faculty is class teacher for this class, gather available sections
                try {
                    const info = (assigned || []).find(a => String(a.class) === String(klass)) || null
                    if (info && info.isClassTeacher) {
                        // compute unique sections from returned students
                        const uniq = Array.from(new Set((list || []).map(s => String(s.section || '').trim()).filter(Boolean)))
                        setAvailableSections(prev => ({ ...prev, [klass]: uniq }))
                        // if no explicit section chosen, default to '' (all)
                        if (!section) setSection('')
                    }
                } catch (e) { /* ignore */ }
            } catch (e) {
                console.error(e)
                setError(e.message || 'Failed to load students')
            } finally { setLoading(false) }
        }
        if (klass) load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [klass, section, gender, category, religion, notAssigned])

    // Load receipts for currently listed students with throttled concurrency
    useEffect(() => {
        async function loadReceipts(list) {
            try {
                const { token } = getAuth()
                const ids = (list || []).map(s => String(s._id))
                const map = {}
                const CONCURRENCY = 5
                for (let i = 0; i < ids.length; i += CONCURRENCY) {
                    const slice = ids.slice(i, i + CONCURRENCY)
                    const batch = await Promise.allSettled(slice.map(id => getReceiptsByStudent(id, token)))
                    batch.forEach((res, j) => {
                        const sid = slice[j]
                        map[sid] = res.status === 'fulfilled' ? (res.value || []) : []
                    })
                }
                setReceiptsMap(map)
            } catch (e) { /* non-blocking */ }
        }
        if (students && students.length) loadReceipts(students)
        else setReceiptsMap({})
    }, [students])

    function normalizeTerm(t) { return String(t || '').replace(/\s+/g, '').toLowerCase() }
    function isPaid(studentId, termKey) {
        const recs = receiptsMap[String(studentId)] || []
        return recs.some(r => normalizeTerm(r.term) === termKey)
    }
    function assignedAmount(student, termKey) {
        const arr = Array.isArray(student.assignedFees) ? student.assignedFees : []
        const found = arr.find(f => normalizeTerm(f.term) === termKey)
        return found ? Number(found.amount || 0) : null
    }

    async function onChangeClass(student) {
        const val = prompt('Enter new class for ' + (student.name || student._id) + ' (1-12):', student.class || '')
        if (!val) return
        const num = String(val).trim()
        if (!/^[1-9]$|^1[0-2]$/.test(num)) return alert('Invalid class')
        try {
            const { token } = getAuth()
            // If the current user is class teacher for this class, allow specifying section
            let sectionToRequest = undefined
            try {
                const info = (assigned || []).find(a => String(a.class) === String(student.class)) || null
                if (info && info.isClassTeacher) {
                    const avail = (availableSections[student.class] || [])
                    const suggestion = student.section || (avail && avail.length ? avail[0] : '')
                    const sec = prompt('Enter section for ' + (student.name || '') + ' (A/B/C/D) or leave blank to auto-assign:', suggestion || '')
                    if (sec === null) return
                    const s = String(sec || '').trim()
                    if (s) sectionToRequest = s.toUpperCase()
                }
            } catch (e) { /* ignore */ }
            await changeStudentClass(student._id, num, token, sectionToRequest)
            alert('Class updated')
            // reload
            const list = await getStudents({ class: klass, section: section === 'ALL' ? '' : section }, getAuth().token)
            setStudents(list || [])
        } catch (e) { console.error(e); alert(e.message || 'Failed') }
    }

    async function onSetStream(student) {
        if (!student) return
        if (!(String(student.class) === '11' || String(student.class) === '12')) return alert('Stream only applicable for class 11 and 12')
        const choice = prompt('Enter stream for ' + (student.name || '') + ' (PCM / PCB / Commerce / Arts / Humanities):', student.stream || '')
        if (choice === null) return
        const val = String(choice || '').trim()
        if (!val) return alert('No stream selected')
        try {
            const { token } = getAuth()
            await setStudentStream(student._id, val, token)
            alert('Stream updated')
            const list = await getStudents({ class: klass, section: section === 'ALL' ? '' : section }, getAuth().token)
            setStudents(list || [])
        } catch (e) { console.error(e); alert(e.message || 'Failed to set stream') }
    }

    async function onToggleBlock(student) {
        try {
            const { token } = getAuth()
            const block = !student.blocked
            await facultyBlockStudent(student._id, block, token)
            alert(block ? 'Student blocked' : 'Student unblocked')
            const list = await getStudents({ class: klass, section: section === 'ALL' ? '' : section }, getAuth().token)
            setStudents(list || [])
        } catch (e) { console.error(e); alert(e.message || 'Failed') }
    }

    async function onRequestDelete(student) {
        const note = prompt('Reason / note for delete request (optional):', '')
        try {
            const { token } = getAuth()
            await requestStudentDeletion(student._id, note || '', token)
            alert('Delete request submitted to admin approvals')
        } catch (e) { console.error(e); alert(e.message || 'Failed') }
    }

    return (
        <FacultyLayout title="Students">
            <div className="faculty-page">
                <h2>Students</h2>

                <div className="card" style={{ padding: 16, marginBottom: 12 }}>
                    <div className="faculty-filters">
                        {!notAssigned && assigned && assigned.length > 0 ? (
                            <>
                                <label>Class
                                    <select value={klass} onChange={e => setKlass(e.target.value)}>
                                        {assigned.map(a => <option key={a.class} value={a.class}>{`Class ${a.class}`}</option>)}
                                    </select>
                                </label>

                                <label>Section
                                    {(() => {
                                        const info = (assigned || []).find(a => String(a.class) === String(klass)) || null
                                        if (!info) return (
                                            <select value={section} onChange={e => setSection(e.target.value)}>
                                                <option value="">Select</option>
                                            </select>
                                        )
                                        if (info.isClassTeacher) {
                                            const secs = availableSections[klass] || Array.isArray(info.sections) ? info.sections : []
                                            return (
                                                <select value={section} onChange={e => setSection(e.target.value)}>
                                                    <option value="">All Sections</option>
                                                    {(secs || []).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            )
                                        }
                                        const secs = Array.isArray(info.sections) && info.sections.length ? info.sections : []
                                        return (
                                            <select value={section} onChange={e => setSection(e.target.value)}>
                                                {secs.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        )
                                    })()}
                                </label>
                            </>
                        ) : (
                            <div style={{ color: 'crimson', fontWeight: 600 }}>Class not assigned</div>
                        )}

                        <label>Gender
                            <select value={gender} onChange={e => setGender(e.target.value)}>
                                <option value="">All</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </label>
                        <label>Category
                            <select value={category} onChange={e => setCategory(e.target.value)}>
                                <option value="">All</option>
                                <option value="General">General</option>
                                <option value="OBC">OBC</option>
                                <option value="SC">SC</option>
                                <option value="ST">ST</option>
                                <option value="EWS">EWS</option>
                                <option value="Other">Other</option>
                            </select>
                        </label>
                        <label>Religion
                            <select value={religion} onChange={e => setReligion(e.target.value)}>
                                <option value="">All</option>
                                <option value="Hindu">Hindu</option>
                                <option value="Muslim">Muslim</option>
                                <option value="Christian">Christian</option>
                                <option value="Sikh">Sikh</option>
                                <option value="Buddhist">Buddhist</option>
                                <option value="Jain">Jain</option>
                                <option value="Other">Other</option>
                            </select>
                        </label>

                        {/* Only class and section selectors; students load automatically */}
                        <div className="search-group" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input className="leaves-search" placeholder="Search name / email / roll no" value={query} onChange={e => setQuery(e.target.value)} />
                            <button className="action-btn" onClick={() => setQuery('')}>Clear</button>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3>Students List {students.length ? `(${students.length})` : ''}</h3>
                    {error && <div className="small" style={{ color: 'crimson' }}>{error}</div>}
                    {students.length === 0 && !loading && <div className="small">No students found. Try loading or change filters.</div>}

                    {students.length > 0 && (
                        <div style={{ overflowX: 'auto' }} className="students-table-wrap">
                            <table className="data-table students-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Class</th>
                                        <th>Stream</th>
                                        <th>Section</th>
                                        <th>Roll No</th>
                                        <th>Gender</th>
                                        <th>Category</th>
                                        <th>Religion</th>
                                        <th>Assigned Fees</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.filter(s => {
                                        const q = (query || '').trim().toLowerCase()
                                        if (!q) return true
                                        return (String(s.name || '').toLowerCase().includes(q)
                                            || String(s.email || '').toLowerCase().includes(q)
                                            || String(s.rollNo || '').toLowerCase().includes(q))
                                    }).map(s => (
                                        <tr key={s._id} className={`student-row ${s.blocked ? 'blocked' : ''}`}>
                                            <td>{s.name}</td>
                                            <td>{s.email || '-'}</td>
                                            <td>{s.class}</td>
                                            <td>{(s.class === 11 || s.class === '11' || s.class === 12 || s.class === '12') ? (s.stream || '-') : 'General'}</td>
                                            <td>{s.section || '-'}</td>
                                            <td>{s.rollNo || '-'}</td>
                                            <td>{s.gender || '-'}</td>
                                            <td>{s.category || '-'}</td>
                                            <td>{s.religion || '-'}</td>
                                            <td>
                                                {(() => {
                                                    const t1Amt = assignedAmount(s, 'term1')
                                                    const t2Amt = assignedAmount(s, 'term2')
                                                    const t1Paid = isPaid(s._id, 'term1')
                                                    const t2Paid = isPaid(s._id, 'term2')
                                                    const line = (label, amt, paid) => (
                                                        <div className="small" key={label}><strong>{label}:</strong> {paid ? 'Paid' : (amt === null ? 'Not assigned' : `₹${amt}`)}</div>
                                                    )
                                                    return (
                                                        <div>
                                                            {line('Term 1', t1Amt, t1Paid)}
                                                            {line('Term 2', t2Amt, t2Paid)}
                                                        </div>
                                                    )
                                                })()}
                                            </td>
                                            <td style={{ display: 'flex', gap: 8 }}>
                                                <button className="action-btn" onClick={() => onChangeClass(s)}>Edit</button>
                                                <button className="action-btn" onClick={() => onToggleBlock(s)}>{s.blocked ? 'Unblock' : 'Block'}</button>
                                                {(String(s.class) === '11' || String(s.class) === '12') && (
                                                    <button className="action-btn" onClick={() => onSetStream(s)}>Set Stream</button>
                                                )}
                                                <button className="action-btn" onClick={() => onRequestDelete(s)}>Delete Request</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </FacultyLayout>
    )
}
