import React, { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAuth } from '../../utils/session'
import { createAdmitCards, getAdmitCards, API_BASE } from '../../api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

export default function AdminAdmitCards() {
    const { token } = getAuth()
    const [className, setClassName] = useState('')
    const [section, setSection] = useState('')
    const [examName, setExamName] = useState('')
    const [dateOfExam, setDateOfExam] = useState('')
    const [note, setNote] = useState('')
    const [schoolName, setSchoolName] = useState('')
    const [signatureFile, setSignatureFile] = useState(null)
    const [subjects, setSubjects] = useState([{ subject: '', date: '', from: '', to: '' }])
    const [instructions, setInstructions] = useState('')
    const qc = useQueryClient()

    const { data: history = [], isLoading: historyLoading } = useQuery({
        queryKey: ['admitCards', token],
        queryFn: () => getAdmitCards({}, token),
        enabled: !!token,
    })

    const createMutation = useMutation({
        mutationFn: (fd) => createAdmitCards(fd, token),
        onSuccess: (res) => {
            try { qc.invalidateQueries(['admitCards', token]) } catch (e) { }
            if (res.count === 0 || !res.filePath) {
                toast.error('Failed to generate admit cards: No valid PDF was created.')
            } else {
                alert(`Generated ${res.count} admit cards`)
            }
        },
        onError: (err) => { alert(err && err.message ? err.message : 'Failed') }
    })

    async function onGenerate(e) {
        e.preventDefault()
        if (!className || !examName) return alert('class and exam required')
        const fd = new FormData()
        fd.set('schoolName', schoolName || '')
        fd.set('className', className)
        if (section) fd.set('section', section)
        fd.set('examName', examName)
        fd.set('dateOfExam', dateOfExam || '')
        fd.set('note', note || '')
        fd.set('instructions', instructions || '')
        fd.set('subjects', JSON.stringify(subjects || []))
        if (signatureFile) fd.set('signature', signatureFile)
        createMutation.mutate(fd)
    }

async function downloadFileById(id, filename, filePath) {
        try {
            if (!id) return toast.error('Invalid file')
            const base = API_BASE || (window && window.location && window.location.origin) || ''
            const headers = {}
            if (token) headers['Authorization'] = `Bearer ${token}`

            // If filePath is provided, try direct static file fetch first (faster, avoids route issues)
            if (filePath) {
                try {
                    const normalized = String(filePath || '').startsWith('/') ? filePath : `/${filePath}`
                    const directUrl = `${base}${normalized}`
                    const dr = await fetch(directUrl, { credentials: 'include', headers })
                    if (dr.ok) {
                        const blob = await dr.blob()
                        const link = document.createElement('a')
                        link.href = window.URL.createObjectURL(blob)
                        link.download = filename || (normalized.split('/').pop() || 'file.pdf')
                        document.body.appendChild(link)
                        link.click()
                        link.remove()
                        window.URL.revokeObjectURL(link.href)
                        return
                    }
                } catch (e) {
                    // continue to fallback
                    console.warn('Direct file fetch failed, falling back to API download', e && e.message)
                }
            }

            // Fallback to API download endpoint
            const fetchUrl = `${base}/api/admitcards/${id}/download`
            const res = await fetch(fetchUrl, { credentials: 'include', headers })
            if (!res.ok) {
                const txt = await res.text().catch(() => '')
                throw new Error(txt || 'Failed to download file')
            }
            const blob = await res.blob()
            const link = document.createElement('a')
            link.href = window.URL.createObjectURL(blob)
            link.download = filename || 'admit-card.pdf'
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(link.href)
        } catch (e) {
            toast.error(`Download failed: ${e.message || 'An error occurred'}`)
        }
    }

    return (
        <AdminLayout title="Admit Cards">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Generate Admit Cards</h2>
                </header>

                <div className="admin-card">
                    <form onSubmit={onGenerate} className="admin-form-grid">
                        <div className="form-group">
                            <label>School Name</label>
                            <input className="admin-input" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. ABC Public School" />
                        </div>
                        <div className="form-group">
                            <label>Class</label>
                            <input className="admin-input" value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. 10" />
                        </div>
                        <div className="form-group">
                            <label>Section</label>
                            <select className="admin-select" value={section} onChange={e => setSection(e.target.value)}>
                                <option value="">Select section</option>
                                <option value="ALL">ALL</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Exam Name</label>
                            <input className="admin-input" value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. Term 1" />
                        </div>
                        <div className="form-group">
                            <label>Exam Date</label>
                            <input className="admin-input" type="date" value={dateOfExam} onChange={e => setDateOfExam(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Signature (upload)</label>
                            <input className="admin-file-input" type="file" accept="image/*" onChange={e => setSignatureFile(e.target.files && e.target.files[0])} />
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Subjects / Schedule</label>
                            {subjects.map((s, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                    <input className="admin-input" placeholder="Subject" value={s.subject} onChange={e => { const n = [...subjects]; n[idx].subject = e.target.value; setSubjects(n) }} />
                                    <input className="admin-input" type="date" value={s.date} onChange={e => { const n = [...subjects]; n[idx].date = e.target.value; setSubjects(n) }} />
                                    <input className="admin-input" type="time" value={s.from} onChange={e => { const n = [...subjects]; n[idx].from = e.target.value; setSubjects(n) }} />
                                    <input className="admin-input" type="time" value={s.to} onChange={e => { const n = [...subjects]; n[idx].to = e.target.value; setSubjects(n) }} />
                                    <button type="button" className="btn-secondary" style={{ padding: '8px 12px' }} onClick={() => { const n = subjects.filter((_, i) => i !== idx); setSubjects(n) }}>Remove</button>
                                </div>
                            ))}
                            <button type="button" className="btn-secondary" onClick={() => setSubjects([...subjects, { subject: '', date: '', from: '', to: '' }])}>+ Add Subject</button>
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Instructions (optional)</label>
                            <textarea className="admin-textarea" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Enter instructions here..." rows={3} />
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Note (optional)</label>
                            <textarea className="admin-textarea" value={note} onChange={e => setNote(e.target.value)} rows={2} />
                        </div>

                        <div className="btn-group" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn-primary" disabled={createMutation.isLoading}>
                                {createMutation.isLoading ? 'Generating...' : 'Generate and Send to Students'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <h3>History</h3>
                    {history.length === 0 ? (
                        <div className="empty-state">No admit cards generated yet.</div>
                    ) : (
                        <div className="table-container">
                            <table className="admin-table">
                                <thead><tr><th>Exam</th><th>Class</th><th>Section</th><th>Issued At</th><th>File</th></tr></thead>
                                <tbody>
                                    {history.map(h => (
                                        <tr key={h._id}>
                                            <td>{h.examName}</td>
                                            <td>{h.className}</td>
                                            <td>{h.section}</td>
                                            <td>{new Date(h.issuedAt || h.createdAt).toLocaleString()}</td>
                                            <td>
                                                {h.filePath ? <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={e => downloadFileById(h._id, `${h.examName || 'admit'}_${h.recipientName || h.className}.pdf`, h.filePath)}>Download</button> : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )

    }
