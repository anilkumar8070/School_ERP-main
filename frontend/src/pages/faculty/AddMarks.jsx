import React, { useState, useEffect } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getStudents, postMark, getMarks, updateMark, getMyFaculty, postMarksBulk } from '../../api'
import { getAuth } from '../../utils/session'

export default function AddMarks() {
    const [klass, setKlass] = useState('1')
    const [subject, setSubject] = useState('Math')
    const [totalMarks, setTotalMarks] = useState('100')
    const [section, setSection] = useState('ALL')
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(false)
    const [historyMarks, setHistoryMarks] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)
    // token read at runtime when saving

    const [assigned, setAssigned] = useState(null)
    const [notAssigned, setNotAssigned] = useState(false)

    useEffect(() => { loadStudents() }, [klass, assigned, notAssigned])

    useEffect(() => {
        let mounted = true
        async function resolve() {
            try {
                const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
                const f = await getMyFaculty(token).catch(() => null)
                if (!f || !Array.isArray(f.assignments) || f.assignments.length === 0) { if (mounted) { setNotAssigned(true); setAssigned([]) }; return }
                const map = {}
                for (const a of f.assignments || []) {
                    const cls = String(a.class || '')
                    if (!cls) continue
                    if (!map[cls]) map[cls] = { sections: new Set(), isClassTeacher: false }
                    if (a.section) map[cls].sections.add(String(a.section))
                    if (a.isClassTeacher) map[cls].isClassTeacher = true
                }
                const assignedList = Object.keys(map).map(k => ({ class: k, sections: Array.from(map[k].sections), isClassTeacher: !!map[k].isClassTeacher }))
                if (mounted) {
                    setAssigned(assignedList)
                    setNotAssigned(false)
                    // prefer class-teacher classes as default
                    const classTeacherList = assignedList.filter(x => x.isClassTeacher)
                    if (classTeacherList.length > 0) {
                        setKlass(classTeacherList[0].class)
                        setSection(classTeacherList[0].isClassTeacher ? 'ALL' : (classTeacherList[0].sections[0] || 'ALL'))
                    } else if (assignedList.length > 0) {
                        setKlass(assignedList[0].class)
                        setSection(assignedList[0].sections[0] || 'ALL')
                    }
                }
            } catch (e) { console.warn('resolve assignments failed', e); if (mounted) setNotAssigned(true) }
        }
        resolve()
        return () => { mounted = false }
    }, [])

    async function loadStudents() {
        if (notAssigned) { setStudents([]); return }
        if (assigned === null) return
        setLoading(true)
        try {
            const { token } = getAuth()
            if (!token) throw new Error('No token')
            // find assignment for this class
            const entry = (assigned || []).find(a => String(a.class) === String(klass))
            // determine section to fetch: if class teacher, empty string => all sections; otherwise use selected section
            const fetchSection = entry ? (entry.isClassTeacher ? '' : (section === 'ALL' ? (entry.sections[0] || '') : section)) : ''
            const list = await getStudents({ class: klass, section: fetchSection }, token)
            setStudents(list.map(s => ({ id: s._id, roll: s.rollNo || s.roll || '', name: s.name, obtained: '' })))
        } catch (e) { console.warn('Failed to load students', e); setStudents([]) }
        finally { setLoading(false) }
    }

    function setObtained(index, value) {
        setStudents(prev => { const next = [...prev]; next[index] = { ...next[index], obtained: value }; return next })
    }

    async function save() {
        try {
            const { token } = getAuth()
            if (!token) throw new Error('Not authenticated')
            const entry = (assigned || []).find(a => String(a.class) === String(klass))
            const sectionToSend = entry ? (entry.isClassTeacher ? '' : (section === 'ALL' ? (entry.sections[0] || '') : section)) : ''
            const marksArray = (students || []).map(s => ({ class: klass, section: sectionToSend, studentId: s.id, subject, total: Number(totalMarks || 0), obtained: Number(s.obtained || 0) }))
            // Use bulk endpoint for efficiency
            await postMarksBulk(marksArray, token)
            // notify other tabs/pages to reload marks
            try { localStorage.setItem('marks_updated', Date.now().toString()) } catch (e) { }
            // refresh history view after save
            try { await loadHistory(); } catch (e) { }
            alert('Marks saved')
        } catch (e) { console.error(e); alert('Failed to save marks: ' + (e.message || e)) }
    }

    async function loadHistory() {
        try {
            setHistoryLoading(true)
            const { token } = getAuth()
            if (!token) throw new Error('Not authenticated')
            const entry = (assigned || []).find(a => String(a.class) === String(klass))
            const sectionToSend = entry ? (entry.isClassTeacher ? '' : (section === 'ALL' ? (entry.sections[0] || '') : section)) : ''
            const mks = await getMarks({ class: klass, section: sectionToSend, subject }, token)
            setHistoryMarks(mks || [])
        } catch (e) {
            console.warn('Failed to load history', e)
            setHistoryMarks([])
        } finally { setHistoryLoading(false) }
    }

    return (
        <FacultyLayout>
            <div className="faculty-page">
                <h2>Add / Update Marks</h2>
                <div className="card" style={{ padding: 16 }}>
                    <div className="faculty-filters">
                        <label>Class
                            <select value={klass} onChange={e => {
                                setKlass(e.target.value);
                                // reset section to first available for new class
                                const entry = (assigned || []).find(a => String(a.class) === String(e.target.value))
                                if (entry) setSection(entry.isClassTeacher ? 'ALL' : (entry.sections[0] || 'ALL'))
                            }}>
                                {(assigned || []).map(a => <option key={a.class} value={a.class}>Class {a.class}</option>)}
                            </select>
                        </label>
                        <label>Section
                            <select value={section} onChange={e => setSection(e.target.value)}>
                                {/* find selected class entry and show appropriate sections */}
                                {(() => {
                                    const entry = (assigned || []).find(a => String(a.class) === String(klass)) || { sections: [], isClassTeacher: false }
                                    if (entry.isClassTeacher) return [<option key="ALL" value="ALL">All</option>, ...entry.sections.map(s => <option key={s} value={s}>{s}</option>)]
                                    return [<option key="ALL" value="ALL">All</option>, ...entry.sections.map(s => <option key={s} value={s}>{s}</option>)]
                                })()}
                            </select>
                        </label>
                        <label>Subject
                            <input value={subject} onChange={e => setSubject(e.target.value)} />
                        </label>
                        <label>Total Marks
                            <input value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
                        </label>
                    </div>

                    <div style={{ overflow: 'auto', marginTop: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                        <table className="data-table" style={{ width: '100%', minWidth: 700 }}>
                            <thead><tr><th>Roll</th><th>Name</th><th>Obtained</th><th>Total</th></tr></thead>
                            <tbody>
                                {loading ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>Loading...</td></tr> : (
                                    students.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>No students</td></tr> : (
                                        students.map((st, i) => (
                                            <tr key={st.id || i}>
                                                <td style={{ border: '1px solid var(--border)', padding: 8, color: 'var(--text-main)' }}>{st.roll}</td>
                                                <td style={{ border: '1px solid var(--border)', padding: 8, color: 'var(--text-main)' }}>{st.name}</td>
                                                <td style={{ border: '1px solid var(--border)', padding: 8 }}><input value={st.obtained} onChange={e => setObtained(i, e.target.value)} style={{ width: '100%', padding: 4, background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)' }} /></td>
                                                <td style={{ border: '1px solid var(--border)', padding: 8, color: 'var(--text-main)' }}>{totalMarks}</td>
                                            </tr>
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <button className="btn-primary" onClick={save} style={{ background: 'var(--primary)', color: '#ffffff', border: 'none' }}>Save Marks</button>
                        <button style={{ marginLeft: 12, color: 'var(--text-main)', background: 'var(--bg-hover)', border: '1px solid var(--border)' }} className="btn-secondary" onClick={loadHistory}>Load History</button>
                    </div>
                </div>
                <div className="card" style={{ marginTop: 16, padding: 12 }}>
                    <h3>Marks History — Subject: {subject}</h3>
                    {historyLoading ? <div>Loading history...</div> : (
                        <div style={{ overflow: 'auto' }}>
                            <table className="data-table" style={{ width: '100%', minWidth: 700 }}>
                                <thead>
                                    <tr>
                                        <th>Roll</th>
                                        <th>Name</th>
                                        <th>Subject</th>
                                        <th>Obtained</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyMarks.length === 0 ? <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center' }}>No history</td></tr> : (
                                        historyMarks.map(m => {
                                            const st = (students || []).find(s => String(s.id) === String(m.studentId)) || { name: '', roll: '' }
                                            return (
                                                <tr key={m._id || `${m.studentId}_${m.subject}_${m._id}`}>
                                                    <td style={{ border: '1px solid var(--border)', padding: 8, color: 'var(--text-main)' }}>{st.roll}</td>
                                                    <td style={{ border: '1px solid var(--border)', padding: 8, color: 'var(--text-main)' }}>{st.name}</td>
                                                    <td style={{ border: '1px solid var(--border)', padding: 8, color: 'var(--text-main)' }}>{m.subject}</td>
                                                    <td style={{ border: '1px solid var(--border)', padding: 8, color: 'var(--text-main)' }}>{m.obtained != null ? m.obtained : '—'}</td>
                                                    <td style={{ border: '1px solid var(--border)', padding: 8, color: 'var(--text-main)' }}>{m.total != null ? m.total : '—'}</td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </FacultyLayout>
    )
}
