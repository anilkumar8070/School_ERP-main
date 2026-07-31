import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { API_BASE, createTest, createTestBulk, createTestQuestions, parseTestFile, getTests, getTestQuestions, uploadFile } from '../../api'
import { getAuth } from '../../utils/session'

export default function AdminTests() {
    const [title, setTitle] = useState('')
    const [type, setType] = useState('google_form')
    const [link, setLink] = useState('')
    const [file, setFile] = useState(null)
    const [classes, setClasses] = useState('')
    const [sections, setSections] = useState('')
    const [start, setStart] = useState('')
    const [duration, setDuration] = useState('')
    const [description, setDescription] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [metaStep, setMetaStep] = useState(1) // 1: metadata, 2: choose type
    const [meta, setMeta] = useState({ title: '', subject: '', classes: '', sections: '', startDate: '', startTime: '', endDate: '', endTime: '', createdBy: '', duration: '', attempts: 1 })
    const [selectedOption, setSelectedOption] = useState(null) // 'google' | 'bulk' | 'series'
    const [bulkProceedChecked, setBulkProceedChecked] = useState(false)
    const [bulkFile, setBulkFile] = useState(null)
    const [seriesMode, setSeriesMode] = useState(null) // 'subjective' | 'mcq'
    const [seriesQuestions, setSeriesQuestions] = useState([])
    const [seriesQ, setSeriesQ] = useState({ questionText: '', questionImage: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], correctIndex: 0, marks: 1, negative: 0, answerText: '' })
    const [loading, setLoading] = useState(false)
    const [tests, setTests] = useState([])
    const [counts, setCounts] = useState({})
    const [q, setQ] = useState('')
    const [formError, setFormError] = useState('')
    const [formSuccess, setFormSuccess] = useState('')
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [previewAnswers, setPreviewAnswers] = useState([])

    async function loadTests() {
        try {
            const { token, role } = getAuth()
            const data = await getTests(token)
            const list = data || []
            setTests(list)

            // fetch exact question counts per test for admin users
            if (role === 'admin') {
                try {
                    const countsArr = await Promise.all(list.map(async t => {
                        try {
                            const qs = await getTestQuestions(t._id, token)
                            return { id: t._id, count: Array.isArray(qs) ? qs.length : 0 }
                        } catch (err) {
                            return { id: t._id, count: (t.totalQuestions != null ? t.totalQuestions : (t.questions ? t.questions.length : 0)) }
                        }
                    }))
                    const map = {}
                    countsArr.forEach(c => { map[c.id] = c.count })
                    setCounts(map)
                } catch (err) {
                    console.warn('Failed to fetch question counts', err)
                }
            }
        } catch (e) {
            console.error('Failed to load tests', e)
        }
    }

    async function handleDelete(id) {
        try {
            if (!window.confirm('Delete this test series? This action cannot be undone.')) return
            const { token } = getAuth()
            const res = await fetch(`${API_BASE}/api/tests/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Failed to delete' }))
                throw new Error(err && err.message ? err.message : 'Failed to delete')
            }
            await loadTests()
        } catch (err) {
            console.error('Delete failed', err)
            alert(err && err.message ? err.message : 'Delete failed')
        }
    }

    useEffect(() => { loadTests() }, [])

    async function handleCreate(e) {
        // legacy handler kept for compatibility — prefer modal flows
        e.preventDefault()
        setLoading(true)
        setFormError('')
        setFormSuccess('')
        try {
            const { token } = getAuth()
            const fd = new FormData()
            fd.append('title', title)
            fd.append('type', type)
            if (link) fd.append('link', link)
            if (file) fd.append('file', file)
            if (classes) fd.append('classes', classes)
            if (sections) fd.append('sections', sections)
            if (start) fd.append('start', start)
            if (duration) fd.append('durationMinutes', duration)
            if (description) fd.append('description', description)

            let created = null
            if (type === 'bulk') {
                const ok = window.confirm('You selected Bulk upload. The uploaded .docx will be parsed into questions. Proceed?')
                if (!ok) { setLoading(false); return }
                created = await createTestBulk(fd, token)
            } else {
                created = await createTest(fd, token)
            }
            await loadTests()
            setTitle('')
            setLink('')
            setFile(null)
            setClasses('')
            setSections('')
            setStart('')
            setDuration('')
            setDescription('')
            setType('google_form')
            setFormSuccess('Test created')
        } catch (err) {
            console.error(err)
            setFormError(err && err.message ? err.message : 'Failed to create test')
        } finally { setLoading(false) }
    }

    return (
        <AdminLayout title="Test Creation">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Test Creation</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Create, assign and review tests here.</p>
                </header>

                <div className="admin-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3>All Test Series</h3>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn-primary" onClick={() => { setShowCreateModal(true); setMetaStep(1); setMeta({ title: '', subject: '', classes: '', sections: '', startDate: '', startTime: '', endDate: '', endTime: '', createdBy: '', duration: '' }); setSelectedOption(null); setSeriesQuestions([]); setSeriesMode(null); setFormError(''); setFormSuccess('') }}>Create Test</button>
                            <button className="btn-secondary" onClick={() => { setShowCreateModal(true); setMetaStep(2); setSelectedOption('bulk'); }}>Bulk Upload</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                        <input className="admin-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search test series by title, subject or creator" style={{ maxWidth: 400 }} />
                    </div>

                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Subject</th>
                                    <th>Classes/Sections</th>
                                    <th>Added By</th>
                                    <th>Total Ques</th>
                                    <th>Duration</th>
                                    <th>Attempts</th>
                                    <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tests.filter(t => {
                                    const term = q.trim().toLowerCase()
                                    if (!term) return true
                                    return (String(t.title || '').toLowerCase().includes(term) || String((t.subject || t.type) || '').toLowerCase().includes(term) || String((t.createdBy && (t.createdBy.name || t.createdBy)) || '').toLowerCase().includes(term))
                                }).map((t) => (
                                    <tr key={t._id}>
                                        <td>{t.title}</td>
                                        <td>{(t.subject && typeof t.subject === 'object') ? (t.subject.name || t.subject.title || t.subject.label || JSON.stringify(t.subject)) : (t.subject || t.type || '')}</td>
                                        <td>{((t.classes && t.classes.length) || (t.sections && t.sections.length)) ? `${(t.classes || []).join(',')}${t.sections && t.sections.length ? ` / ${(t.sections || []).join(',')}` : ''}` : '—'}</td>
                                        <td>
                                            {(() => {
                                                if (!t.createdBy) return ''
                                                const creator = (t.createdBy && (t.createdBy.name || t.createdBy)) ? (t.createdBy.name || t.createdBy) : ''
                                                const role = (t.createdBy && t.createdBy.role) ? String(t.createdBy.role) : ''
                                                return role ? `${role.charAt(0).toUpperCase() + role.slice(1)}: ${creator}` : `Created by: ${creator}`
                                            })()}
                                        </td>
                                        <td>{(counts && counts[t._id] !== undefined) ? counts[t._id] : (t.totalQuestions != null ? t.totalQuestions : (t.questions ? t.questions.length : 0))}</td>
                                        <td>{t.durationMinutes ? `${t.durationMinutes} min` : (t.duration ? `${t.duration} min` : '')}</td>
                                        <td>{t.attempts || t.attempts === 0 ? String(t.attempts) : (t.attempts === undefined && t.attempt ? String(t.attempt) : '—')}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className="btn-group" style={{ justifyContent: 'center' }}>
                                                <button className="btn-secondary" onClick={() => { window.location.href = `/admin/tests/${t._id}/results` }}>View</button>
                                                <button className="btn-danger" onClick={() => handleDelete(t._id)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {showCreateModal && (
                    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                        <div className="admin-card" style={{ width: 800, maxWidth: '96%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
                            {metaStep === 1 && (
                                <div>
                                    <h3 style={{ marginTop: 0 }}>Create Test — Details</h3>
                                    {formError && <div className="error-message" style={{ marginBottom: 16 }}>{formError}</div>}
                                    {formSuccess && <div className="success-message" style={{ marginBottom: 16 }}>{formSuccess}</div>}

                                    <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                                        <div className="form-group">
                                            <label>Title</label>
                                            <input className="admin-input" value={meta.title} onChange={e => setMeta(s => ({ ...s, title: e.target.value }))} />
                                        </div>
                                        <div className="form-group">
                                            <label>Subject</label>
                                            <input className="admin-input" value={meta.subject} onChange={e => setMeta(s => ({ ...s, subject: e.target.value }))} />
                                        </div>
                                        <div className="admin-form-grid">
                                            <div className="form-group">
                                                <label>Class (comma separated)</label>
                                                <input className="admin-input" value={meta.classes} onChange={e => setMeta(s => ({ ...s, classes: e.target.value }))} placeholder="6,7" />
                                            </div>
                                            <div className="form-group">
                                                <label>Section (comma separated)</label>
                                                <input className="admin-input" value={meta.sections} onChange={e => setMeta(s => ({ ...s, sections: e.target.value }))} placeholder="A,B" />
                                            </div>
                                        </div>
                                        <div className="admin-form-grid">
                                            <div className="form-group">
                                                <label>Start Date</label>
                                                <input className="admin-input" type="date" value={meta.startDate} onChange={e => setMeta(s => ({ ...s, startDate: e.target.value }))} />
                                            </div>
                                            <div className="form-group">
                                                <label>Start Time</label>
                                                <input className="admin-input" type="time" value={meta.startTime} onChange={e => setMeta(s => ({ ...s, startTime: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="admin-form-grid">
                                            <div className="form-group">
                                                <label>End Date (optional)</label>
                                                <input className="admin-input" type="date" value={meta.endDate} onChange={e => setMeta(s => ({ ...s, endDate: e.target.value }))} />
                                            </div>
                                            <div className="form-group">
                                                <label>End Time (optional)</label>
                                                <input className="admin-input" type="time" value={meta.endTime} onChange={e => setMeta(s => ({ ...s, endTime: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label>Created By (optional)</label>
                                            <input className="admin-input" value={meta.createdBy} onChange={e => setMeta(s => ({ ...s, createdBy: e.target.value }))} placeholder="Name" />
                                        </div>
                                        <div className="form-group">
                                            <label>Description / Instructions</label>
                                            <textarea className="admin-textarea" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                                        </div>
                                        <div className="admin-form-grid">
                                            <div className="form-group">
                                                <label>Duration (minutes)</label>
                                                <input className="admin-input" type="number" value={meta.duration || ''} onChange={e => setMeta(s => ({ ...s, duration: e.target.value }))} placeholder="e.g., 30" />
                                            </div>
                                            <div className="form-group">
                                                <label>Attempts per student</label>
                                                <input className="admin-input" type="number" min={1} value={meta.attempts || 1} onChange={e => setMeta(s => ({ ...s, attempts: e.target.value }))} />
                                            </div>
                                        </div>

                                        <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                                            <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                            <button className="btn-primary" onClick={() => {
                                                setFormError('')
                                                // compute start ISO and duration
                                                if (!meta.title) { setFormError('Title required'); return }
                                                if (!meta.duration) { setFormError('Duration (minutes) is required'); return }
                                                setMetaStep(2)
                                            }}>Proceed</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {metaStep === 2 && (
                                <div>
                                    <h3 style={{ marginTop: 0 }}>Choose Creation Method</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                        <div className={`admin-card ${selectedOption === 'google' ? 'active' : ''}`} style={{ border: selectedOption === 'google' ? '2px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setSelectedOption('google')}>
                                            <h4 style={{ marginTop: 0 }}>Google Form</h4>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Paste a Google Form link and the test will be created referencing it.</p>
                                            <div className="form-group">
                                                <input className="admin-input" placeholder="https://forms.gle/..." value={link} onChange={e => setLink(e.target.value)} />
                                            </div>
                                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                                <button className="btn-primary" onClick={async (e) => {
                                                    e.stopPropagation()
                                                    setFormError('')
                                                    if (!meta.title) { setFormError('Title required'); return }
                                                    if (!link) { setFormError('Google Form link required'); return }
                                                    if (!meta.duration) { setFormError('Duration (minutes) is required'); return }
                                                    setLoading(true)
                                                    try {
                                                        const { token } = getAuth()
                                                        const fd = new FormData()
                                                        fd.append('title', meta.title)
                                                        if (meta.subject) fd.append('subject', meta.subject)
                                                        fd.append('type', 'google_form')
                                                        fd.append('link', link)
                                                        if (meta.classes) fd.append('classes', meta.classes)
                                                        if (meta.sections) fd.append('sections', meta.sections)
                                                        if (meta.startDate && meta.startTime) fd.append('start', `${meta.startDate}T${meta.startTime}`)
                                                        // compute duration if end provided
                                                        if (meta.endDate && meta.endTime && meta.startDate && meta.startTime) {
                                                            const s = new Date(`${meta.startDate}T${meta.startTime}`)
                                                            const e = new Date(`${meta.endDate}T${meta.endTime}`)
                                                            const dmin = Math.max(0, Math.round((e - s) / 60000))
                                                            fd.append('durationMinutes', String(dmin))
                                                        }
                                                        // explicit duration field takes precedence
                                                        if (meta.duration) fd.set('durationMinutes', String(meta.duration))
                                                        if (meta.attempts) fd.set('attempts', String(meta.attempts))
                                                        if (description) fd.append('description', description)
                                                        await createTest(fd, getAuth().token)
                                                        await loadTests()
                                                        setFormSuccess('Google form test created')
                                                        setShowCreateModal(false)
                                                    } catch (err) { console.error(err); setFormError(err && err.message ? err.message : 'Failed') } finally { setLoading(false) }
                                                }}>Create</button>
                                            </div>
                                        </div>

                                        <div className={`admin-card ${selectedOption === 'bulk' ? 'active' : ''}`} style={{ border: selectedOption === 'bulk' ? '2px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setSelectedOption('bulk')}>
                                            <h4 style={{ marginTop: 0 }}>Bulk Upload</h4>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Upload a .docx (or PDF) following the format: question, then 4 options, correct answer and marks mentioned. The server will parse and create questions.</p>
                                            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <input type="checkbox" checked={bulkProceedChecked} onChange={e => setBulkProceedChecked(e.target.checked)} />
                                                <span>I confirm my document matches the required format.</span>
                                            </label>
                                            <div className="form-group" style={{ marginTop: 8 }}>
                                                <input className="admin-file-input" type="file" accept=".docx,.pdf" onChange={e => setBulkFile(e.target.files && e.target.files[0])} />
                                            </div>
                                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                                <button className="btn-primary" onClick={async (e) => {
                                                    e.stopPropagation()
                                                    setFormError('')
                                                    setFormSuccess('')
                                                    if (!bulkProceedChecked) { setFormError('Please confirm document format'); return }
                                                    if (!bulkFile) { setFormError('Please choose a file'); return }
                                                    setLoading(true)
                                                    try {
                                                        const fd = new FormData()
                                                        fd.append('file', bulkFile)
                                                        const res = await parseTestFile(fd, getAuth().token)
                                                        // populate seriesQuestions with parsed questions so user can edit
                                                        const parsed = (res && res.questions) ? res.questions.map(q => ({ questionText: q.questionText || '', options: q.options || [], correctAnswer: q.correctAnswer || '', marks: q.marks || 1 })) : []
                                                        if (!parsed.length) {
                                                            setFormError('No questions were extracted. Please check document format.')
                                                        } else {
                                                            setSeriesQuestions(parsed)
                                                            // if most questions have options, open MCQ editor, else subjective
                                                            const hasOpts = parsed.filter(p => p.options && p.options.length).length
                                                            setSeriesMode(hasOpts > 0 ? 'mcq' : 'subjective')
                                                            // move user to series editor (they can review/edit and then Submit Test)
                                                            setFormSuccess(`Extraction complete — ${parsed.length} questions parsed. Review and Edit them in Create Series section, then click Submit Test.`)
                                                        }
                                                    } catch (err) { console.error(err); setFormError(err && err.message ? err.message : 'Failed to extract') } finally { setLoading(false) }
                                                }}>Extract & Preview</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 24, padding: 20, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                                        <h4 style={{ marginTop: 0 }}>Create Series (manual)</h4>
                                        <p style={{ color: 'var(--text-muted)' }}>Build a test series by adding subjective or MCQ questions manually.</p>

                                        {!seriesMode && (
                                            <div className="btn-group">
                                                <button className="btn-secondary" onClick={() => setSeriesMode('subjective')}>Subjective</button>
                                                <button className="btn-secondary" onClick={() => setSeriesMode('mcq')}>MCQ</button>
                                            </div>
                                        )}

                                        {seriesMode && (
                                            <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr', marginTop: 16 }}>
                                                <div className="form-group">
                                                    <label>Question</label>
                                                    <textarea className="admin-textarea" value={seriesQ.questionText} onChange={e => setSeriesQ(s => ({ ...s, questionText: e.target.value }))} rows={2} />
                                                    <div style={{ marginTop: 8 }}>
                                                        <label>Question Image:</label>
                                                        <input className="admin-file-input" type="file" accept="image/*" onChange={async e => {
                                                            const f = e.target.files && e.target.files[0]
                                                            if (!f) return
                                                            try { const fd = new FormData(); fd.append('file', f); const { token } = getAuth(); const res = await uploadFile(fd, token); setSeriesQ(s => ({ ...s, questionImage: (res && res.url) || '' })) } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                                                        }} />
                                                        {seriesQ.questionImage ? <img src={`${seriesQ.questionImage.startsWith('http') ? seriesQ.questionImage : (API_BASE + seriesQ.questionImage)}`} alt="qimg" style={{ maxHeight: 60, borderRadius: 6, marginTop: 8 }} /> : null}
                                                        {seriesQ.questionImage ? <button className="btn-danger-sm" onClick={() => setSeriesQ(s => ({ ...s, questionImage: '' }))} style={{ marginTop: 8 }}>Remove</button> : null}
                                                    </div>
                                                </div>

                                                {seriesMode === 'mcq' && (
                                                    <div className="form-group">
                                                        <label>Options (4 default)</label>
                                                        {seriesQ.options.map((opt, i) => (
                                                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                                                                    <input className="admin-input" value={opt} onChange={e => setSeriesQ(s => ({ ...s, options: s.options.map((o, idx) => idx === i ? e.target.value : o) }))} />
                                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <input type="radio" name="correct" checked={seriesQ.correctIndex === i} onChange={() => setSeriesQ(s => ({ ...s, correctIndex: i }))} />
                                                                        <span>Correct</span>
                                                                    </label>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <input className="admin-file-input" type="file" accept="image/*" onChange={async e => {
                                                                        const f = e.target.files && e.target.files[0]
                                                                        if (!f) return
                                                                        try { const fd = new FormData(); fd.append('file', f); const { token } = getAuth(); const res = await uploadFile(fd, token); setSeriesQ(s => ({ ...s, optionImages: s.optionImages.map((img, idx) => idx === i ? ((res && res.url) || '') : img) })) } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                                                                    }} />
                                                                    {seriesQ.optionImages && seriesQ.optionImages[i] ? (
                                                                        <>
                                                                            <img src={`${seriesQ.optionImages[i].startsWith('http') ? seriesQ.optionImages[i] : (API_BASE + seriesQ.optionImages[i])}`} alt={`opt-${i}`} style={{ maxHeight: 40, borderRadius: 4 }} />
                                                                            <button className="btn-danger-sm" onClick={() => setSeriesQ(s => ({ ...s, optionImages: s.optionImages.map((img, idx) => idx === i ? '' : img) }))}>X</button>
                                                                        </>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {seriesMode === 'subjective' && (
                                                    <div className="form-group">
                                                        <label>Answer / Model Answer</label>
                                                        <textarea className="admin-textarea" value={seriesQ.answerText} onChange={e => setSeriesQ(s => ({ ...s, answerText: e.target.value }))} rows={2} />
                                                    </div>
                                                )}

                                                {seriesMode === 'subjective' && seriesQuestions.length > 0 && (
                                                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                                                        <button className="btn-secondary" onClick={() => {
                                                            // prepare preview answers array (empty by default)
                                                            setPreviewAnswers(seriesQuestions.map(q => ({ questionText: q.questionText || '', modelAnswer: q.correctAnswer || '', studentAnswer: '', marks: q.marks || 1 })))
                                                            setShowPreviewModal(true)
                                                        }}>Preview Auto-Grade</button>
                                                    </div>
                                                )}

                                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                                    <div className="form-group">
                                                        <label>Marks</label>
                                                        <input className="admin-input" type="number" value={seriesQ.marks} onChange={e => setSeriesQ(s => ({ ...s, marks: Number(e.target.value) }))} />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Negative Marks</label>
                                                        <input className="admin-input" type="number" value={seriesQ.negative} onChange={e => setSeriesQ(s => ({ ...s, negative: Number(e.target.value) }))} />
                                                    </div>
                                                </div>

                                                <button className="btn-primary" onClick={() => {
                                                    setFormError('')
                                                    if (!seriesQ.questionText) { setFormError('Question text required'); return }
                                                    const qobj = seriesMode === 'mcq' ? { questionText: seriesQ.questionText, questionImage: seriesQ.questionImage || '', options: seriesQ.options.slice(), optionImages: (seriesQ.optionImages || []).slice(0, seriesQ.options.length), correctAnswer: seriesQ.options[seriesQ.correctIndex] || '', marks: seriesQ.marks || 1 } : { questionText: seriesQ.questionText, questionImage: seriesQ.questionImage || '', options: [], optionImages: [], correctAnswer: seriesQ.answerText || '', marks: seriesQ.marks || 1 }
                                                    setSeriesQuestions(s => ([...s, qobj]))
                                                    setSeriesQ({ questionText: '', questionImage: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], correctIndex: 0, marks: 1, negative: 0, answerText: '' })
                                                }}>Add Question</button>
                                            </div>
                                        )}

                                        <div style={{ marginTop: 24 }}>
                                            <h4>Questions List ({seriesQuestions.length})</h4>
                                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                                {seriesQuestions.length === 0 && <div className="empty-state">No questions added yet.</div>}
                                                {seriesQuestions.map((q, idx) => (
                                                    <div key={idx} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 8, background: 'var(--bg-main)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <strong>{idx + 1}. {q.questionText}</strong>
                                                            <div style={{ display: 'flex', gap: 8 }}>
                                                                <button className="btn-danger-sm" onClick={() => setSeriesQuestions(s => s.filter((_, i) => i !== idx))}>Delete</button>
                                                                <button className="btn-secondary" onClick={() => {
                                                                    // quick move to top
                                                                    setSeriesQuestions(s => {
                                                                        const copy = [...s]
                                                                        const item = copy.splice(idx, 1)[0]
                                                                        copy.unshift(item)
                                                                        return copy
                                                                    })
                                                                }}>Move Top</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
                                            <button className="btn-secondary" onClick={() => setSeriesMode(null)}>Back</button>
                                            <button className="btn-primary" onClick={async () => {
                                                setFormError('')
                                                if (!seriesQuestions.length) { setFormError('Add at least one question'); return }
                                                if (!meta.duration) { setFormError('Duration (minutes) is required'); return }
                                                setLoading(true)
                                                try {
                                                    const fd = new FormData()
                                                    fd.append('title', meta.title)
                                                    fd.append('type', 'series')
                                                    if (meta.classes) fd.append('classes', meta.classes)
                                                    if (meta.sections) fd.append('sections', meta.sections)
                                                    if (meta.startDate && meta.startTime) fd.append('start', `${meta.startDate}T${meta.startTime}`)
                                                    if (meta.endDate && meta.endTime && meta.startDate && meta.startTime) {
                                                        const s = new Date(`${meta.startDate}T${meta.startTime}`)
                                                        const e = new Date(`${meta.endDate}T${meta.endTime}`)
                                                        const dmin = Math.max(0, Math.round((e - s) / 60000))
                                                        fd.append('durationMinutes', String(dmin))
                                                    }
                                                    if (meta.duration) fd.set('durationMinutes', String(meta.duration))
                                                    if (meta.attempts) fd.set('attempts', String(meta.attempts))
                                                    if (meta.subject) fd.append('subject', meta.subject)
                                                    if (description) fd.append('description', description)
                                                    const testDoc = await createTest(fd, getAuth().token)
                                                    await createTestQuestions(testDoc._id, seriesQuestions, getAuth().token)
                                                    await loadTests()
                                                    setFormSuccess('Series test created')
                                                    setShowCreateModal(false)
                                                } catch (err) { console.error(err); setFormError(err && err.message ? err.message : 'Failed') } finally { setLoading(false) }
                                            }}>Submit Test</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showPreviewModal && (
                    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
                        <div className="admin-card" style={{ width: 720, maxWidth: '96%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
                            <h3>Preview Auto-Grade — Subjective</h3>
                            <p className="description">Enter sample student answers and see similarity % and computed marks.</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {previewAnswers.map((p, i) => {
                                    // similarity function (mirrors backend enhancedSimilarity)
                                    function normalizeText(s) { return String(s || '').toLowerCase().replace(/\\u00A0|\\s+/g, ' ').replace(/[^a-z0-9 ]+/g, '').trim() }
                                    function levenshtein(a, b) {
                                        a = String(a || ''); b = String(b || '');
                                        const al = a.length, bl = b.length
                                        if (al === 0) return bl
                                        if (bl === 0) return al
                                        const row = Array(bl + 1).fill(0)
                                        for (let j = 0; j <= bl; j++) row[j] = j
                                        for (let ii = 1; ii <= al; ii++) {
                                            let prev = row[0]; row[0] = ii
                                            for (let jj = 1; jj <= bl; jj++) {
                                                const tmp = row[jj]
                                                const cost = a[ii - 1] === b[jj - 1] ? 0 : 1
                                                row[jj] = Math.min(row[jj] + 1, row[jj - 1] + 1, prev + cost)
                                                prev = tmp
                                            }
                                        }
                                        return row[bl]
                                    }
                                    function tokenizeAndStem(s) {
                                        const stopwords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'and', 'or', 'in', 'on', 'that', 'from', 'by', 'for', 'with', 'as', 'it', 'this', 'these', 'those', 'which'])
                                        const toks = String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\\s+/).map(t => t.trim()).filter(Boolean)
                                        const stem = t => { if (t.length <= 3) return t; return t.replace(/(ing|ed|ly|es|s)$/, '') }
                                        return toks.map(t => stem(t)).filter(t => !stopwords.has(t))
                                    }
                                    function jaccardSimilarity(a, b) {
                                        const ta = new Set(tokenizeAndStem(a))
                                        const tb = new Set(tokenizeAndStem(b))
                                        if (!ta.size && !tb.size) return 1
                                        if (!ta.size || !tb.size) return 0
                                        let inter = 0
                                        for (const x of ta) if (tb.has(x)) inter++
                                        const uni = new Set([...ta, ...tb]).size
                                        return uni === 0 ? 0 : inter / uni
                                    }
                                    function enhancedSimilarity(a, b) {
                                        const na = normalizeText(a)
                                        const nb = normalizeText(b)
                                        const charDist = levenshtein(na, nb)
                                        const charMax = Math.max(na.length, nb.length) || 1
                                        const charSim = Math.max(0, 1 - charDist / charMax)
                                        const wordSim = jaccardSimilarity(a, b)
                                        return Math.max(charSim, Math.max(wordSim, 0.6 * charSim + 0.4 * wordSim))
                                    }
                                    const sim = enhancedSimilarity(p.studentAnswer, p.modelAnswer)
                                    const matchedPercent = Math.round(sim * 10000) / 100
                                    const awarded = Math.round(sim * p.marks * 100) / 100

                                    return (
                                        <div key={i} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                            <div style={{ fontWeight: 700 }}>{i + 1}. {p.questionText}</div>
                                            <div style={{ marginTop: 6 }}><div style={{ fontWeight: 700 }}>Model Answer</div><div style={{ color: 'var(--text-muted)' }}>{p.modelAnswer}</div></div>
                                            <div style={{ marginTop: 8 }}>
                                                <label style={{ fontWeight: 800 }}>Student Answer</label>
                                                <textarea className="admin-textarea" value={previewAnswers[i].studentAnswer} onChange={e => setPreviewAnswers(s => s.map((it, idx2) => idx2 === i ? ({ ...it, studentAnswer: e.target.value }) : it))} rows={2} />
                                            </div>
                                            <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <div><strong>Match:</strong> {matchedPercent != null ? `${matchedPercent}%` : '—'}</div>
                                                <div><strong>Awarded:</strong> {awarded} / {p.marks}</div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                                <button className="btn-secondary" onClick={() => setShowPreviewModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
