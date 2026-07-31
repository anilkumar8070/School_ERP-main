import React, { useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getAuth } from '../../utils/session'
import { createAdmitCards, getAdmitCards } from '../../api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function FacultyAdmitCards() {
    const { token } = getAuth()
    const [className, setClassName] = useState('')
    const [section, setSection] = useState('')
    const [examName, setExamName] = useState('')
    const [dateOfExam, setDateOfExam] = useState('')
    const [note, setNote] = useState('')
    const qc = useQueryClient()

    const { data: history = [], isLoading: historyLoading } = useQuery({ queryKey: ['admitCards', token], queryFn: () => getAdmitCards({}, token), enabled: !!token })

    const createMutation = useMutation({
        mutationFn: (fd) => createAdmitCards(fd, token),
        onSuccess: (res) => {
            try { qc.invalidateQueries(['admitCards', token]) } catch (e) { }
            alert(`Generated ${res.count || 0} admit cards`)
        },
        onError: (err) => { alert(err && err.message ? err.message : 'Failed') }
    })

    const downloadMutation = useMutation({
        mutationFn: async ({ urlOrId }) => {
            if (!urlOrId) throw new Error('Invalid file')
            const base = (typeof window !== 'undefined' && window.location ? window.location.origin : '') || ''
            let fetchUrl = urlOrId && String(urlOrId).startsWith('http') ? urlOrId : `${base}${String(urlOrId).startsWith('/') ? '' : '/'}${String(urlOrId)}`
            if (!String(urlOrId).startsWith('http') && !String(urlOrId).startsWith('/uploads') && !String(urlOrId).startsWith('/api/')) {
                fetchUrl = `${base}/api/admitcards/${urlOrId}/download`
            }
            const headers = {}
            const res = await fetch(fetchUrl, { credentials: 'include', headers })
            if (!res.ok) {
                const txt = await res.text().catch(() => '')
                throw new Error(txt || 'Failed to download file')
            }
            const blob = await res.blob()
            return { blob }
        },
        onSuccess: ({ blob }, vars) => {
            try {
                const filename = vars.filename || 'admit-card.pdf'
                const link = document.createElement('a')
                link.href = window.URL.createObjectURL(blob)
                link.download = filename
                document.body.appendChild(link)
                link.click()
                link.remove()
                window.URL.revokeObjectURL(link.href)
            } catch (e) { alert('Download failed') }
        },
        onError: (err) => alert(err?.message || 'Download failed')
    })

    async function onGenerate(e) {
        e.preventDefault()
        if (!className || !section || !examName) return alert('class, section and exam required')
        const fd = new FormData()
        fd.set('className', className)
        fd.set('section', section)
        fd.set('examName', examName)
        fd.set('dateOfExam', dateOfExam || '')
        fd.set('note', note || '')
        createMutation.mutate(fd)
    }

    return (
        <FacultyLayout title="Admit Cards">
            <div className="card">
                <h3>Generate Admit Cards (Faculty)</h3>
                <form onSubmit={onGenerate} className="faculty-form-card">
                    <div>
                        <label>Class</label>
                        <input value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. 10" />
                    </div>
                    <div>
                        <label>Section</label>
                        <input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. A" />
                    </div>
                    <div>
                        <label>Exam Name</label>
                        <input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. Term 1" />
                    </div>
                    <div>
                        <label>Exam Date</label>
                        <input type="date" value={dateOfExam} onChange={e => setDateOfExam(e.target.value)} />
                    </div>
                    <div className="full-width">
                        <label>Note (optional)</label>
                        <textarea value={note} onChange={e => setNote(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', width: '100%', minHeight: 80 }} />
                    </div>
                    <div className="full-width">
                        <button type="submit" disabled={createMutation.isLoading} className="btn-primary" style={{ padding: '10px 24px' }}>{createMutation.isLoading ? 'Generating...' : 'Generate and Send to Students'}</button>
                    </div>
                </form>
            </div>

            <div className="card" style={{ marginTop: 16, padding: 16 }}>
                <h3>History</h3>
                <div className="table-container">
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead><tr><th>Exam</th><th>Class</th><th>Section</th><th>Issued At</th><th>File</th></tr></thead>
                        <tbody>
                            {(history || []).map(h => (
                                <tr key={h._id}>
                                    <td>{h.examName}</td>
                                    <td>{h.className}</td>
                                    <td>{h.section}</td>
                                    <td>{new Date(h.issuedAt || h.createdAt).toLocaleString()}</td>
                                    <td>{h.filePath ? <button type="button" className="action-btn" onClick={() => downloadMutation.mutate({ urlOrId: h.filePath, filename: (h.filePath && h.filePath.split('/').pop()) || `${h.examName || 'admit'}.pdf` })}>PDF</button> : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </FacultyLayout>
    )
}
