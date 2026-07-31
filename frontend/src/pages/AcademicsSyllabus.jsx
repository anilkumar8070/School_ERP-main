import React, { useEffect, useState } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import './Academics.css'
import { getAuth } from '../utils/session'
import { createSyllabus, createTimetable, getTimetable, getSyllabus, deleteSyllabus, API_BASE } from '../api'

function qs(name) {
    return new URLSearchParams(window.location.search).get(name)
}

export default function AcademicsSyllabus() {
    const cls = qs('class') || '1'
    const sec = qs('section') || 'A'
    const [klass, setKlass] = useState(cls)
    const [section, setSection] = useState(sec)
    const [file, setFile] = useState(null)
    const [saved, setSaved] = useState(false)

    useEffect(() => setSaved(false), [klass, section])

    const [timetables, setTimetables] = useState([])
    const [syllabusMap, setSyllabusMap] = useState({})
    const [currentSyllabusList, setCurrentSyllabusList] = useState([])
    async function loadTimetables(k = klass, s = section) {
        try {
            const items = await getTimetable({ class: k, section: s })
            setTimetables(items || [])
        } catch (e) { console.warn('Failed to load timetables', e); setTimetables([]) }
    }

    useEffect(() => { loadTimetables(klass, section) }, [klass, section])

    // reload syllabus when class/section state changes
    useEffect(() => {
        loadSyllabusForClass(klass, section)
    }, [klass, section])

    // respond to back/forward or programmatic popstate (Open button uses pushState + popstate)
    useEffect(() => {
        function onPop() {
            const qClass = qs('class') || '1'
            const qSection = qs('section') || 'A'
            setKlass(qClass)
            setSection(qSection)
            // loading functions triggered by state effects
        }
        window.addEventListener('popstate', onPop)
        return () => window.removeEventListener('popstate', onPop)
    }, [])

    async function loadSyllabusForClass(k = klass, s = section) {
        try {
            const items = await getSyllabus({ class: k, section: s })
            setCurrentSyllabusList(items || [])
            setSyllabusMap(prev => ({ ...prev, [String(k)]: items || [] }))
        } catch (e) { console.warn('Failed to load syllabus for', k, s, e); setCurrentSyllabusList([]); setSyllabusMap(prev => ({ ...prev, [String(k)]: [] })) }
    }

    async function loadAllSyllabuses(s = section) {
        const map = {}
        for (let n = 1; n <= 12; n++) {
            try {
                const items = await getSyllabus({ class: String(n), section: s })
                map[String(n)] = items || []
            } catch (e) {
                map[String(n)] = []
            }
        }
        setSyllabusMap(map)
        setCurrentSyllabusList(map[String(klass)] || [])
    }

    useEffect(() => { loadAllSyllabuses(section) }, [section])

    function onChoose(e) {
        const f = e.target.files && e.target.files[0]
        setFile(f)
    }

    async function save() {
        if (!file) return alert('Choose a file first')
        try {
            const { token } = getAuth()
            const fd = new FormData()
            fd.append('class', klass)
            fd.append('section', section)
            fd.append('subject', file.name.split('.').slice(0, -1).join('.') || '')
            fd.append('file', file)
            const res = await createSyllabus(fd, token)
            setSaved(true)
            alert('Syllabus uploaded to server')
            // refresh syllabus lists
            await loadSyllabusForClass(klass, section)
            await loadAllSyllabuses(section)
        } catch (e) { console.error(e); alert('Failed to upload syllabus: ' + (e.message || 'server error')) }
    }

    async function onDeleteSyllabus(id) {
        if (!window.confirm('Delete this syllabus file? This cannot be undone.')) return
        try {
            const { token } = getAuth()
            await deleteSyllabus(id, token)
            alert('Syllabus deleted')
            await loadSyllabusForClass(klass, section)
            await loadAllSyllabuses(section)
        } catch (e) { console.error(e); alert('Failed to delete syllabus: ' + (e.message || 'server error')) }
    }

    function loadStatus() {
        const key = `syllabus_${klass}_${section}`
        try {
            const raw = localStorage.getItem(key)
            if (!raw) return null
            return JSON.parse(raw)
        } catch (e) { return null }
    }

    // Not showing local status; server-based upload now. Optionally implement a status fetch.
    const status = null

    return (
        <AdminLayout title="Syllabus Management">
            <div className="academics-page syllabus-page">
                <div className="academics-header">
                    <div className="academics-title">
                        <h1>Syllabus Management</h1>
                        <p className="subtitle">Upload and manage syllabus files for each class and section.</p>
                    </div>
                    <div className="academics-controls">
                        <select value={klass} onChange={e => setKlass(e.target.value)}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>{`Class ${n}`}</option>)}
                        </select>
                        <select value={section} onChange={e => setSection(e.target.value)}>
                            {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="card upload-card">
                    <h3>Upload Syllabus for Class {klass} {section}</h3>
                    <p className="muted">Accepted formats: .pdf .doc .docx .xls .xlsx</p>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <input className="boxed-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={onChoose} />
                        <button className="btn green" onClick={save}>Save Syllabus</button>
                        {status && <div style={{ marginLeft: 12 }}><strong>Saved:</strong> {status.name}</div>}
                    </div>
                    {saved && <div style={{ marginTop: 12, color: '#0b1220' }}>Uploaded successfully.</div>}

                    <div style={{ marginTop: 14 }}>
                        <h4>Existing Syllabus for Class {klass} {section}</h4>
                        {currentSyllabusList.length === 0 && <div className="small muted">No syllabus files uploaded for this class/section.</div>}
                        {currentSyllabusList.map(s => (
                            <div key={s._id || s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                <div>
                                    <div style={{ fontWeight: 700 }}>{s.name || s.subject || 'Syllabus'}</div>
                                    <div className="small">Uploaded: {new Date(s.uploadedAt || s.createdAt).toLocaleString()}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {s.filePath && <a className="btn outline" href={(s.filePath && s.filePath.startsWith('http')) ? s.filePath : `${API_BASE}${s.filePath}`} target="_blank" rel="noreferrer">Download</a>}
                                    <button className="btn danger" onClick={() => onDeleteSyllabus(s._id || s.id)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <h3>Class Syllabus Status</h3>
                    <div className="syllabus-grid">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
                            const uploaded = (syllabusMap && syllabusMap[String(n)] && syllabusMap[String(n)].length > 0)
                            return (
                                <div key={n} className="syllabus-block">
                                    <div className="sb-top">
                                        <div className="sb-class">Class {n}</div>
                                        <div className={`sb-status ${uploaded ? 'ok' : 'missing'}`}>{uploaded ? 'Uploaded' : 'Not uploaded'}</div>
                                    </div>
                                    <div className="sb-actions">
                                        <button className="btn outline" onClick={() => { window.history.pushState({}, '', `/admin/academics/syllabus?class=${n}&section=A`); window.dispatchEvent(new Event('popstate')) }}>Open</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Timetable upload moved to Admin Timetable page. */}
            </div>
        </AdminLayout>
    )
}

function TimetableUploader({ onUploaded } = {}) {
    const [klass, setKlass] = useState('1')
    const [section, setSection] = useState('A')
    const [file, setFile] = useState(null)
    function onChoose(e) { const f = e.target.files && e.target.files[0]; setFile(f) }
    async function upload() {
        if (!file) return alert('Choose a file first')
        try {
            const { token } = getAuth()
            const fd = new FormData()
            fd.append('class', klass)
            fd.append('section', section)
            fd.append('file', file)
            await createTimetable(fd, token)
            alert('Timetable uploaded')
            if (typeof onUploaded === 'function') onUploaded()
        } catch (e) { console.error(e); alert('Failed to upload timetable: ' + (e.message || 'server error')) }
    }
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select value={klass} onChange={e => setKlass(e.target.value)}>{Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>{`Class ${n}`}</option>)}</select>
            <select value={section} onChange={e => setSection(e.target.value)}>{['A', 'B', 'C', 'D', 'ALL'].map(s => <option key={s} value={s}>{s}</option>)}</select>
            <input type="file" accept=".pdf,.png,.jpg" onChange={onChoose} />
            <button className="btn green" onClick={upload}>Upload Timetable</button>
        </div>
    )
}
