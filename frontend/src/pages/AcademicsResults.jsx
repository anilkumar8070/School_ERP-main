import React, { useEffect, useState } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import './Academics.css'
import { getStudents } from '../api'
import { getMarks } from '../api'
import { getAuth } from '../utils/session'

function qs(name) { return new URLSearchParams(window.location.search).get(name) }

export default function AcademicsResults() {
    const cls = qs('class') || '1'
    const sec = qs('section') || 'A'
    const [klass, setKlass] = useState(cls)
    const [section, setSection] = useState(sec)
    const [students, setStudents] = useState([])
    const [marks, setMarks] = useState([])
    const [subjects, setSubjects] = useState([])
    const [loading, setLoading] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [selectedStudentMarks, setSelectedStudentMarks] = useState([])

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const { token } = getAuth()
                // fetch students for the class/section
                const studentQuery = (section === 'ALL' || !section) ? { class: klass } : { class: klass, section }
                const studs = await getStudents(studentQuery, token)
                setStudents(studs || [])

                // fetch marks for class/section
                const markQuery = { class: klass }
                if (!(section === 'ALL' || !section)) markQuery.section = section
                let mks = await getMarks(markQuery, token)
                mks = mks || []

                // If no marks returned for a specific section, try a per-student fallback
                if ((mks.length === 0) && section !== 'ALL' && Array.isArray(studs) && studs.length > 0) {
                    try {
                        // limit the number of parallel requests to avoid overload
                        const limit = 50
                        const slice = studs.slice(0, limit)
                        const per = await Promise.all(slice.map(s => getMarks({ studentId: s._id }, token).catch(() => [])))
                        mks = per.flat()
                    } catch (e) {
                        console.warn('Fallback per-student marks fetch failed', e)
                    }
                }
                setMarks(mks)

                // compute distinct subjects in this class/marks
                const subjSet = new Set();
                (mks || []).forEach(m => { if (m && m.subject) subjSet.add(m.subject) })
                setSubjects(Array.from(subjSet))
            } catch (e) {
                console.error('Failed to load results', e)
                setStudents([])
                setMarks([])
                setSubjects([])
            } finally { setLoading(false) }
        }
        load()
        // listen for marks updates from other tabs/components
        function onStorage(e) {
            if (e.key === 'marks_updated') {
                load()
            }
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [klass, section])

    // Helpers to get mark for student+subject
    function getMarkFor(studentId, subject) {
        const found = (marks || []).find(m => String(m.studentId) === String(studentId) && String(m.subject) === String(subject))
        return found || null
    }

    function studentTotal(studentId) {
        const arr = (marks || []).filter(m => String(m.studentId) === String(studentId))
        let obtained = 0, total = 0
        arr.forEach(a => { obtained += Number(a.obtained || 0); total += Number(a.total || 0) })
        return { obtained, total }
    }

    async function openStudent(st) {
        try {
            const { token } = getAuth()
            const items = await getMarks({ studentId: st._id }, token)
            setSelectedStudent(st)
            setSelectedStudentMarks(items || [])
        } catch (e) {
            console.error('Failed to load student marks', e)
            setSelectedStudentMarks([])
            setSelectedStudent(st)
        }
    }

    function closeStudent() {
        setSelectedStudent(null)
        setSelectedStudentMarks([])
    }

    return (
        <AdminLayout title="Results Upload">
            <div className="academics-page colorful">
                <div className="academics-header">
                    <h1>Results — Class {klass} {section}</h1>
                    <div className="academics-controls">
                        <select value={klass} onChange={e => setKlass(e.target.value)}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>{`Class ${n}`}</option>)}
                        </select>
                        <select value={section} onChange={e => setSection(e.target.value)}>
                            {['ALL', 'A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="card">
                    <h3>Marks — Class {klass} {section}</h3>
                    {loading ? <div>Loading...</div> : (
                        <div style={{ overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: 8, border: '1px solid #e6e6e6', textAlign: 'left' }}>Roll</th>
                                        <th style={{ padding: 8, border: '1px solid #e6e6e6', textAlign: 'left' }}>Student</th>
                                        {subjects.map(s => <th key={s} style={{ padding: 8, border: '1px solid #e6e6e6', textAlign: 'center' }}>{s}</th>)}
                                        <th style={{ padding: 8, border: '1px solid #e6e6e6', textAlign: 'center' }}>Obtained</th>
                                        <th style={{ padding: 8, border: '1px solid #e6e6e6', textAlign: 'center' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.length === 0 ? (
                                        <tr><td colSpan={3 + subjects.length} style={{ padding: 12 }}>No students found</td></tr>
                                    ) : students.map(st => {
                                        const tot = studentTotal(st._id)
                                        return (
                                            <tr key={st._id} onClick={() => openStudent(st)} style={{ cursor: 'pointer' }}>
                                                <td style={{ padding: 8, border: '1px solid #eee' }}>{st.rollNo || st.roll || ''}</td>
                                                <td style={{ padding: 8, border: '1px solid #eee' }}>{st.name}</td>
                                                {subjects.map(s => {
                                                    const m = getMarkFor(st._id, s)
                                                    const cell = m ? `${m.obtained != null ? m.obtained : '—'} / ${m.total != null ? m.total : '—'}` : '—'
                                                    return <td key={s} style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{cell}</td>
                                                })}
                                                <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{tot.obtained}</td>
                                                <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{tot.total}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {selectedStudent && (
                    <div className="faculty-add-modal-backdrop">
                        <div className="faculty-add-modal" style={{ width: 720, maxHeight: '80vh' }}>
                            <div className="faculty-add-header">
                                <div style={{ fontSize: 18, fontWeight: 800 }}>Marks — {selectedStudent.name}</div>
                                <button onClick={closeStudent} className="faculty-add-close">×</button>
                            </div>
                            <div style={{ padding: 12 }}>
                                <div style={{ marginBottom: 8 }}>Class {selectedStudent.class} {selectedStudent.section}</div>
                                {selectedStudentMarks.length === 0 ? (
                                    <div style={{ color: '#64748b' }}>No marks available for this student.</div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: 8, border: '1px solid #eee' }}>Subject</th>
                                                <th style={{ padding: 8, border: '1px solid #eee' }}>Obtained</th>
                                                <th style={{ padding: 8, border: '1px solid #eee' }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedStudentMarks.map(m => (
                                                <tr key={m._id}>
                                                    <td style={{ padding: 8, border: '1px solid #eee' }}>{m.subject}</td>
                                                    <td style={{ padding: 8, border: '1px solid #eee' }}>{m.obtained}</td>
                                                    <td style={{ padding: 8, border: '1px solid #eee' }}>{m.total}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
