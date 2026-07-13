import React, { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAuth } from '../../utils/session'
import { createReportCard } from '../../api/reportCards'
import { getStudents } from '../../api'
import { getReportCards } from '../../api/reportCards'
import { API_BASE, exportMarksExcel } from '../../api'

export default function AdminReportCard() {
    const { token } = getAuth()
    const [schoolName, setSchoolName] = useState('')
    const [examName, setExamName] = useState('')
    const [className, setClassName] = useState('')
    const [section, setSection] = useState('')
    const [recipientName, setRecipientName] = useState('')
    const [recipientEmail, setRecipientEmail] = useState('')
    const [rollNumber, setRollNumber] = useState('')
    const [templateType, setTemplateType] = useState('normal')
    const [subjects, setSubjects] = useState([{ name: '', marks: '', maxMarks: '' }])
    const [loading, setLoading] = useState(false)
    const [signatureFile, setSignatureFile] = useState(null)
    const [students, setStudents] = useState([])
    const [selecting, setSelecting] = useState(false)
    const [search, setSearch] = useState('')
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    function updateSubject(idx, key, val) {
        const s = [...subjects]
        s[idx][key] = val
        setSubjects(s)
    }

    function addSubject() { setSubjects([...subjects, { name: '', marks: '', maxMarks: '' }]) }
    function removeSubject(idx) { setSubjects(subjects.filter((_, i) => i !== idx)) }

    async function onGenerate(e) {
        e.preventDefault()
        setLoading(true)
        try {
            if (signatureFile) {
                const fd = new FormData()
                fd.append('schoolName', schoolName)
                fd.append('examName', examName)
                fd.append('className', className)
                fd.append('section', section)
                fd.append('recipientName', recipientName)
                fd.append('recipientEmail', recipientEmail)
                fd.append('rollNumber', rollNumber)
                fd.append('templateType', templateType)
                fd.append('subjects', JSON.stringify(subjects))
                fd.append('signature', signatureFile)
                const resp = await fetch(`${API_BASE}/api/reportcards`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({ message: 'Failed to create report card' }))
                    throw new Error(err.message || 'Failed to create report card')
                }
                alert('Report card generated')
            } else {
                const payload = { schoolName, examName, className, section, recipientName, recipientEmail, rollNumber, templateType, subjects }
                const res = await createReportCard(payload, token)
                alert('Report card generated')
            }
            // refresh history
            await loadHistory()
        } catch (err) { alert(err.message || 'Failed') }
        setLoading(false)
    }

    async function openSelector() {
        setSelecting(true)
        try {
            // if a class is selected, prefer filtering by class to reduce results
            const q = {}
            if (className) q.class = className
            if (section) q.section = section
            if (search) q.q = search
            const list = await getStudents(q, token)
            setStudents(list || [])
        } catch (e) { console.warn(e); setStudents([]) }
    }

    function chooseStudent(s) {
        try {
            setRecipientName(s.name || '')
            setRecipientEmail(s.email || '')
            setClassName(s.class || '')
            setSection(s.section || '')
            setRollNumber(s.rollNo || '')
        } catch (e) { }
        setSelecting(false)
    }

    async function loadHistory() {
        setLoadingHistory(true)
        try {
            const list = await getReportCards({}, token)
            setHistory(Array.isArray(list) ? list : [])
        } catch (e) { console.warn('Failed to load report card history', e); setHistory([]) }
        setLoadingHistory(false)
    }

    useEffect(() => { loadHistory() }, [])

    async function downloadReportCard(id, filename, filePath) {
        if (!id) return
        try {
            const headers = { Authorization: `Bearer ${token}` }

            // Try direct static filePath first
            if (filePath) {
                try {
                    const normalized = String(filePath || '').startsWith('/') ? filePath : `/${filePath}`
                    const directUrl = `${API_BASE}${normalized}`
                    const dr = await fetch(directUrl, { headers })
                    if (dr.ok) {
                        const blob = await dr.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = filename || (normalized.split('/').pop() || `report_${id}.pdf`)
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                        window.URL.revokeObjectURL(url)
                        return
                    }
                } catch (e) {
                    console.warn('Direct report file fetch failed, falling back to API download', e && e.message)
                }
            }

            const res = await fetch(`${API_BASE}/api/reportcards/${id}/download`, { headers })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Download failed' }))
                throw new Error(err.message || 'Download failed')
            }
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename || `report_${id}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
        } catch (e) { alert(e.message || 'Failed to download') }
    }

    async function handleExportMarks() {
        try {
            const { token } = getAuth()
            await exportMarksExcel({ class: className, examName: examName }, token)
        } catch (e) {
            alert(e.message || 'Failed to export marks')
        }
    }

    return (
        <AdminLayout title="Report Card Generation">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Generate Report Card</h2>
                </header>

                <div className="admin-card">
                    <form onSubmit={onGenerate} className="admin-form-grid">
                        <div className="form-group">
                            <label>School Name</label>
                            <input className="admin-input" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Exam Name</label>
                            <input className="admin-input" value={examName} onChange={e => setExamName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Class</label>
                            <input className="admin-input" value={className} onChange={e => setClassName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Section</label>
                            <input className="admin-input" value={section} onChange={e => setSection(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Student Name</label>
                            <input className="admin-input" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Student Email</label>
                            <input className="admin-input" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Roll Number</label>
                            <input className="admin-input" value={rollNumber} onChange={e => setRollNumber(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Template</label>
                            <select className="admin-select" value={templateType} onChange={e => setTemplateType(e.target.value)}>
                                <option value="normal">Normal Marksheet</option>
                                <option value="cbse">CBSE Professional Marksheet</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Controller Signature (optional)</label>
                            <input className="admin-file-input" type="file" accept="image/*" onChange={e => setSignatureFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Subjects</label>
                            {subjects.map((s, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 1fr 1fr auto', gap: 12, marginTop: 8, alignItems: 'center' }}>
                                    <input className="admin-input" placeholder="Subject" value={s.name} onChange={e => updateSubject(idx, 'name', e.target.value)} />
                                    <input className="admin-input" placeholder="Marks Obtained" value={s.marks} onChange={e => updateSubject(idx, 'marks', e.target.value)} />
                                    <input className="admin-input" placeholder="Max Marks" value={s.maxMarks} onChange={e => updateSubject(idx, 'maxMarks', e.target.value)} />
                                    <button type="button" className="btn-secondary" style={{ padding: '8px 12px' }} onClick={() => removeSubject(idx)}>Remove</button>
                                </div>
                            ))}
                            <div style={{ marginTop: 12 }}><button type="button" className="btn-secondary" onClick={addSubject}>+ Add Subject</button></div>
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                                <button type="button" className="btn-secondary" onClick={openSelector}>Select Student</button>
                                <input className="admin-input" placeholder="Search students (name/email)" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, maxWidth: 300 }} />
                                {selecting ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Selecting...</span> : null}
                            </div>

                            {selecting && students && students.length > 0 && (
                                <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border)', padding: 8, borderRadius: 6, background: 'var(--bg-surface)' }}>
                                    {students.map((s) => (
                                        <div key={s._id} style={{ padding: 8, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.name} {s.email ? `(${s.email})` : ''}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.class} {s.section} — Roll: {s.rollNo}</div>
                                            </div>
                                            <div>
                                                <button type="button" className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => chooseStudent(s)}>Choose</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="btn-group" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Generating...' : 'Generate Report Card'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0 }}>Report Card History</h3>
                        <button className="btn-secondary" onClick={handleExportMarks}>Export Marks (Excel)</button>
                    </div>
                    {loadingHistory ? <div className="info">Loading...</div> : (
                        <div className="table-container">
                            {history.length === 0 ? <div className="empty-state">No report cards generated yet.</div> : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Exam</th>
                                            <th>Year</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((h) => (
                                            <tr key={h._id}>
                                                <td>{h.recipientName || h.recipientEmail || '—'}</td>
                                                <td>{h.examName || ''}</td>
                                                <td>{h.createdAt ? (new Date(h.createdAt).getFullYear()) : ''}</td>
                                                <td>
                                                    <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => downloadReportCard(h._id, (h.filePath && h.filePath.split('/').pop()) || `${h.recipientName || 'report'}.pdf`, h.filePath)}>Download PDF</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
