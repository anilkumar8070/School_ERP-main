import React, { useState, useEffect } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import './Academics.css'
import { getStudents, getFaculty, getSyllabus, getTimetable } from '../api'
import { getAuth } from '../utils/session'

export default function Academics() {
    const [klass, setKlass] = useState('1')
    const [section, setSection] = useState('A')
    const [metrics, setMetrics] = useState({ students: 0, teachers: 0, subjects: 0 })
    const [metricsLoading, setMetricsLoading] = useState(false)
    const [classesMetrics, setClassesMetrics] = useState([])

    function goTo(path) {
        window.history.pushState({}, '', path)
        window.dispatchEvent(new Event('popstate'))
    }

    useEffect(() => {
        async function loadMetrics() {
            setMetricsLoading(true)
            try {
                const { token } = getAuth()
                // students for class+section
                const students = await getStudents({ name: '', class: klass, section }, token).catch(() => [])
                // teachers associated with class (classGrade)
                const teachers = await getFaculty({ classGrade: klass }, token).catch(() => [])
                // syllabus/subjects for class
                const syllabus = await getSyllabus({ class: klass }, token).catch(() => [])
                setMetrics({ students: (students && students.length) || 0, teachers: (teachers && teachers.length) || 0, subjects: (syllabus && syllabus.length) || 0 })
            } catch (e) {
                console.error('Failed to load metrics', e)
                setMetrics({ students: 0, teachers: 0, subjects: 0 })
            }
            setMetricsLoading(false)
        }
        loadMetrics()
    }, [klass, section])

    // load metrics for all classes (1..12)
    useEffect(() => {
        async function loadAll() {
            try {
                const { token } = getAuth()
                const [students, teachers, syllabus] = await Promise.all([
                    getStudents({}, token).catch(() => []),
                    getFaculty({}, token).catch(() => []),
                    getSyllabus({}, token).catch(() => [])
                ])

                // Fetch timetable presence per class (returns history; presence = any items)
                const classes = Array.from({ length: 12 }, (_, i) => String(i + 1))
                const ttPromises = classes.map(c => getTimetable({ class: c }).catch(() => []))
                const ttResults = await Promise.all(ttPromises)

                const clsMetrics = classes.map((c, idx) => {
                    const sCount = (students && students.filter(ss => String(ss.class) === String(c)).length) || 0
                    const tCount = (teachers && teachers.filter(tf => String(tf.classGrade) === String(c)).length) || 0
                    const subCount = (syllabus && syllabus.filter(x => String(x.class) === String(c)).length) || 0
                    const ttList = (ttResults && ttResults[idx]) || []
                    const timetableUploaded = Array.isArray(ttList) && ttList.length > 0
                    return { class: c, students: sCount, teachers: tCount, subjects: subCount, timetableUploaded }
                })
                setClassesMetrics(clsMetrics)
            } catch (e) { console.error('Failed to load classes metrics', e); setClassesMetrics([]) }
        }
        loadAll()
    }, [])

    return (
        <AdminLayout title="Academic Management">
            <div className="academics-page colorful">
                <div className="academics-header">
                    <div className="academics-title">
                        <h1>Academic Management</h1>
                        <p className="subtitle">Manage syllabus, timetables, results and class resources — all in one place.</p>
                    </div>

                    <div className="academics-controls">
                        <label className="select-wrap">
                            <span className="label-small">Class</span>
                            <select value={klass} onChange={e => setKlass(e.target.value)} aria-label="Select class">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                                    <option key={n} value={String(n)}>{`Class ${n}`}</option>
                                ))}
                            </select>
                        </label>

                        <label className="select-wrap">
                            <span className="label-small">Section</span>
                            <select value={section} onChange={e => setSection(e.target.value)} aria-label="Select section">
                                {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>

                        <div className="academics-actions">
                            <button className="btn blue" onClick={() => goTo(`/admin/academics/syllabus?class=${klass}&section=${section}`)}>Syllabus</button>
                            <button className="btn purple" onClick={() => goTo(`/admin/academics/timetable?class=${klass}&section=${section}`)}>Timetable</button>
                            <button className="btn gradient" onClick={() => goTo(`/admin/academics/results?class=${klass}&section=${section}`)}>Results</button>
                        </div>
                    </div>
                </div>
                <div className="academics-grid">
                    <div className="card large">
                        <div className="overview-head">
                            <div>
                                <h3>Class Management</h3>
                                <p className="muted">Quick summary and actions for the selected class and section.</p>
                            </div>
                            <div className="overview-actions">
                                <button className="btn tertiary" onClick={() => goTo(`/admin/academics/syllabus?class=${klass}&section=${section}`)}>Edit Syllabus</button>
                                <button className="btn tertiary" onClick={() => goTo(`/admin/academics/timetable?class=${klass}&section=${section}`)}>Edit Timetable</button>
                            </div>
                        </div>

                        <div className="card-row metrics-row">
                            <div className="class-grid">
                                {classesMetrics.length === 0 ? (
                                    <div style={{ padding: 12 }}>No data</div>
                                ) : classesMetrics.map((cm, idx) => (
                                    <div key={cm.class} className={`class-block cls-${idx + 1}`}>
                                        <div className="class-label">Class {cm.class}</div>
                                        <div className="class-values">
                                            <div className="small">{cm.students} students</div>
                                            <div className="small">{cm.teachers} teachers</div>
                                            <div className="small">{cm.subjects} subjects</div>
                                            <div className="small">{cm.timetableUploaded ? 'Timetable: uploaded' : 'Timetable: none'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="card" data-variant="syllabus">
                        <h3>Manage Syllabus</h3>
                        <p className="muted">Create or edit syllabus items, reorder subjects, and attach files for class {klass}.</p>
                        <div className="card-actions">
                            <button className="btn blue" onClick={() => goTo(`/admin/academics/syllabus?class=${klass}&section=${section}`)}>Open Syllabus</button>
                            <button className="btn outline" onClick={() => goTo(`/admin/academics/syllabus?class=${klass}&section=${section}&new=true`)}>Add Subject</button>
                        </div>
                    </div>

                    <div className="card" data-variant="timetable">
                        <h3>Timetable & Exams</h3>
                        <p className="muted">View and publish timetables, and manage upcoming exams and schedules.</p>
                        <div className="card-actions">
                            <button className="btn purple" onClick={() => goTo(`/admin/academics/timetable?class=${klass}&section=${section}`)}>Open Timetable</button>
                            <button className="btn outline" onClick={() => goTo(`/admin/academics/results?class=${klass}&section=${section}`)}>Manage Exams</button>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
