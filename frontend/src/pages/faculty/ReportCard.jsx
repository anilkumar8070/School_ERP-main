import React, { useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getAuth } from '../../utils/session'
import { createReportCard } from '../../api/reportCards'
import { getStudents } from '../../api'
import { getReportCards } from '../../api/reportCards'
import { API_BASE } from '../../api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createReportCardForm } from '../../api/reportCards'

export default function FacultyReportCard() {
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


    function updateSubject(idx, key, val) {
        const s = [...subjects]
        s[idx][key] = val
        setSubjects(s)
    }

    function addSubject() { setSubjects([...subjects, { name: '', marks: '', maxMarks: '' }]) }
    function removeSubject(idx) { setSubjects(subjects.filter((_, i) => i !== idx)) }

    const qc = useQueryClient()

    const createJsonMutation = useMutation({
        mutationFn: (payload) => createReportCard(payload, token),
        onSuccess: () => {
            alert('Report card generated')
            qc.invalidateQueries(['reportCards', token])
        }
    })

    const createFormMutation = useMutation({
        mutationFn: (formData) => createReportCardForm(formData, token),
        onSuccess: () => {
            alert('Report card generated')
            qc.invalidateQueries(['reportCards', token])
        }
    })

    function onGenerate(e) {
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
                createFormMutation.mutate(fd)
            } else {
                const payload = { schoolName, examName, className, section, recipientName, recipientEmail, rollNumber, templateType, subjects }
                createJsonMutation.mutate(payload)
            }
        } catch (err) { alert(err.message || 'Failed') }
        setLoading(false)
    }

    async function openSelector() {
        setSelecting(true)
        try {
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

    const { data: history = [], isLoading: isLoadingHistory } = useQuery({ queryKey: ['reportCards', token], queryFn: () => getReportCards({}, token), enabled: !!token })

    const downloadMutation = useMutation({
        mutationFn: async ({ id }) => {
            const { token: _t } = getAuth()
            const headers = _t ? { Authorization: `Bearer ${_t}` } : {}
            const res = await fetch(`${API_BASE}/api/reportcards/${id}/download`, { headers })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Download failed' }))
                throw new Error(err.message || 'Download failed')
            }
            const blob = await res.blob()
            return { blob }
        },
        onSuccess: ({ blob }, vars) => {
            try {
                const filename = vars.filename || `report_${vars.id}.pdf`
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = filename
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
            } catch (e) { alert('Failed to download') }
        },
        onError: (err) => alert(err?.message || 'Failed to download')
    })

    function downloadReportCard(id, filename) {
        if (!id) return
        downloadMutation.mutate({ id, filename })
    }

    return (
        <FacultyLayout title="Report Card">
            <div className="card" style={{ padding: 16 }}>
                <h3>Generate Report Card</h3>
                <form onSubmit={onGenerate} className="faculty-form-card">
                    <div>
                        <label>School Name</label>
                        <input value={schoolName} onChange={e => setSchoolName(e.target.value)} />
                    </div>
                    <div>
                        <label>Exam Name</label>
                        <input value={examName} onChange={e => setExamName(e.target.value)} />
                    </div>
                    <div>
                        <label>Class</label>
                        <input value={className} onChange={e => setClassName(e.target.value)} />
                    </div>
                    <div>
                        <label>Section</label>
                        <input value={section} onChange={e => setSection(e.target.value)} />
                    </div>
                    <div>
                        <label>Student Name</label>
                        <input value={recipientName} onChange={e => setRecipientName(e.target.value)} />
                    </div>
                    <div>
                        <label>Student Email</label>
                        <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
                    </div>
                    <div>
                        <label>Roll Number</label>
                        <input value={rollNumber} onChange={e => setRollNumber(e.target.value)} />
                    </div>
                    <div>
                        <label>Template</label>
                        <select value={templateType} onChange={e => setTemplateType(e.target.value)}>
                            <option value="normal">Normal Marksheet</option>
                            <option value="cbse">CBSE Professional Marksheet</option>
                        </select>
                    </div>
                    <div className="full-width">
                        <label>Controller Signature (optional)</label>
                        <input type="file" accept="image/*" onChange={e => setSignatureFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} style={{ border: 'none', padding: 0 }} />
                    </div>

                    <div className="faculty-form-card" style={{ marginTop: 16 }}>
                        <div className="full-width">
                            <label style={{ marginBottom: 12 }}>Subjects</label>
                            {subjects.map((s, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 12, alignItems: 'end' }}>
                                    <input placeholder="Subject Name" value={s.name} onChange={e => updateSubject(idx, 'name', e.target.value)} />
                                    <input placeholder="Marks Obtained" value={s.marks} onChange={e => updateSubject(idx, 'marks', e.target.value)} />
                                    <input placeholder="Max Marks" value={s.maxMarks} onChange={e => updateSubject(idx, 'maxMarks', e.target.value)} />
                                    <button type="button" onClick={() => removeSubject(idx)} className="btn-secondary" style={{ height: 42 }}>Remove</button>
                                </div>
                            ))}
                            <button type="button" onClick={addSubject} className="btn-secondary">Add Subject</button>
                        </div>
                    </div>

                    <div className="faculty-form-card" style={{ marginTop: 16, display: 'block' }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button type="button" onClick={openSelector} className="btn-secondary">Select Student</button>
                            <input placeholder="Search students (name/email)" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
                        </div>

                        {selecting ? <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 8 }}>Selecting...</span> : null}

                        {selecting && students && students.length > 0 ? (
                            <div style={{ marginTop: 12, maxHeight: 240, overflow: 'auto', border: '1px solid var(--border)', padding: 8, borderRadius: 8, background: 'var(--bg-card)' }}>
                                {students.map((s) => (
                                    <div key={s._id} style={{ padding: 10, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.name} {s.email ? `(${s.email})` : ''}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.class} {s.section} — Roll: {s.rollNo}</div>
                                        </div>
                                        <div>
                                            <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => chooseStudent(s)}>Choose</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div style={{ marginTop: 24 }}>
                        <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '10px 24px', fontSize: 16 }}>{loading ? 'Generating...' : 'Generate Report Card'}</button>
                    </div>
                </form>
            </div>
            <div className="card" style={{ padding: 16, marginTop: 16 }}>
                <h3>Report Card History</h3>
                {isLoadingHistory ? <div>Loading...</div> : (
                    <div style={{ maxHeight: 380, overflow: 'auto' }}>
                        {history.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>No report cards generated yet.</div> : (
                            <div className="table-container">
                                <table className="data-table" style={{ width: '100%' }}>
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
                                                    <button type="button" className="action-btn" onClick={() => downloadReportCard(h._id, (h.filePath && h.filePath.split('/').pop()) || `${h.recipientName || 'report'}.pdf`)}>Download PDF</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </FacultyLayout>
    )
}
