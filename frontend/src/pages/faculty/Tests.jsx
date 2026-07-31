import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { API_BASE, getMyTests, getTestQuestions, createTestQuestions, updateTest, deleteTest, createTest, createTestBulk, parseTestFile, uploadFile } from '../../api'
import { getAuth } from '../../utils/session'

export default function FacultyTests() {
    const [tests, setTests] = useState([])
    const [counts, setCounts] = useState({})
    const [q, setQ] = useState('')

    async function load() {
        try {
            const { token, role } = getAuth()
            const data = await getMyTests(token)
            const testsList = data || []
            setTests(testsList)

            // fetch exact question counts per faculty
            if (role === 'faculty') {
                try {
                    const countsArr = await Promise.all(testsList.map(async t => {
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
                } catch (err) { console.warn('Failed to fetch question counts', err) }
            }
        } catch (e) {
            console.error('Failed to load test series', e)
        }
    }

    useEffect(() => { load() }, [])

    const [selected, setSelected] = useState(null)
    const [questions, setQuestions] = useState([])
    const [showQuestionsModal, setShowQuestionsModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showManageModal, setShowManageModal] = useState(false)
    const [loading, setLoading] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    // modal flow states (admin-like create flow)
    const [metaStep, setMetaStep] = useState(1)
    const [meta, setMeta] = useState({ title: '', subject: '', classes: '', sections: '', startDate: '', startTime: '', endDate: '', endTime: '', createdBy: '', duration: '', attempts: 1 })
    const [selectedOption, setSelectedOption] = useState(null)
    const [bulkProceedChecked, setBulkProceedChecked] = useState(false)
    const [bulkFile, setBulkFile] = useState(null)
    const [seriesMode, setSeriesMode] = useState(null)
    const [seriesQuestions, setSeriesQuestions] = useState([])
    const [seriesQ, setSeriesQ] = useState({ questionText: '', questionImage: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], correctIndex: 0, marks: 1, negative: 0, answerText: '' })
    const [formError, setFormError] = useState('')
    const [formSuccess, setFormSuccess] = useState('')
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [previewAnswers, setPreviewAnswers] = useState([])
    const [description, setDescription] = useState('')
    const [link, setLink] = useState('')
    const [file, setFile] = useState(null)

    async function handleDelete(id) {
        try {
            if (!window.confirm('Delete this test series? This action cannot be undone.')) return
            const { token } = getAuth()
            await deleteTest(id, token)
            await load()
        } catch (err) {
            console.error('Delete failed', err)
            alert(err && err.message ? err.message : 'Delete failed')
        }
    }

    async function openViewQuestions(test) {
        try {
            setSelected(test)
            setLoading(true)
            const { token } = getAuth()
            const qs = await getTestQuestions(test._id, token)
            setQuestions(qs || [])
            setShowQuestionsModal(true)
        } catch (e) {
            console.error('Failed to load questions', e)
            alert('Failed to load questions')
        } finally { setLoading(false) }
    }

    async function openEditQuestions(test) {
        try {
            setSelected(test)
            setLoading(true)
            const { token } = getAuth()
            const qs = await getTestQuestions(test._id, token)
            setQuestions(qs || [])
            setShowEditModal(true)
        } catch (e) {
            console.error('Failed to load questions', e)
            alert('Failed to load questions')
        } finally { setLoading(false) }
    }

    async function saveEditedQuestions() {
        try {
            if (!selected) return
            const { token } = getAuth()
            await createTestQuestions(selected._id, questions, token)
            setShowEditModal(false)
            await load()
            alert('Questions updated')
        } catch (e) {
            console.error('Failed to save questions', e)
            alert('Failed to save questions')
        }
    }

    function changeQuestionField(idx, field, value) {
        setQuestions(qs => qs.map((q, i) => i === idx ? ({ ...q, [field]: value }) : q))
    }

    async function openAddQuestions(test) {
        setSelected(test)
        setQuestions([])
        setShowAddModal(true)
    }

    async function saveAddedQuestions(newQs) {
        try {
            if (!selected) return
            const { token } = getAuth()
            await createTestQuestions(selected._id, newQs, token)
            setShowAddModal(false)
            await load()
            alert('Questions added')
        } catch (e) {
            console.error('Failed to add questions', e)
            alert('Failed to add questions')
        }
    }

    async function openManage(test) {
        setSelected(test)
        setShowManageModal(true)
    }

    // create flows copied/adapted from admin Tests modal
    async function handleCreateLegacy(e) {
        // kept for compatibility (if any legacy form submits occur)
        e && e.preventDefault()
        setLoading(true)
        setFormError('')
        setFormSuccess('')
        try {
            const { token } = getAuth()
            const fd = new FormData()
            fd.append('title', meta.title)
            if (meta.subject) fd.append('subject', meta.subject)
            if (meta.classes) fd.append('classes', meta.classes)
            if (meta.sections) fd.append('sections', meta.sections)
            if (meta.startDate && meta.startTime) fd.append('start', `${meta.startDate}T${meta.startTime}`)
            if (meta.duration) fd.append('durationMinutes', String(meta.duration))
            if (meta.attempts) fd.append('attempts', String(meta.attempts || 1))
            if (meta.createdBy) fd.append('createdBy', meta.createdBy)
            if (meta.description) fd.append('description', meta.description)

            let created = null
            if (selectedOption === 'bulk' && bulkFile) {
                const ok = window.confirm('You selected Bulk upload. The uploaded .docx will be parsed into questions. Proceed?')
                if (!ok) { setLoading(false); return }
                created = await createTestBulk(fd, getAuth().token)
            } else {
                created = await createTest(fd, getAuth().token)
            }
            await load()
            setFormSuccess('Test created')
            setShowCreateModal(false)
            // if seriesQuestions exist (manual series), post them
            if (seriesQuestions && seriesQuestions.length && created && created._id) {
                await createTestQuestions(created._id, seriesQuestions, getAuth().token)
            }
            // if created, open add questions modal to continue
            if (created) {
                setSelected(created)
                setQuestions([])
                setShowAddModal(true)
            }
        } catch (err) {
            console.error(err)
            setFormError(err && err.message ? err.message : 'Failed to create test')
        } finally { setLoading(false) }
    }

    async function saveManageDetails(changes) {
        try {
            if (!selected) return
            const { token } = getAuth()
            await updateTest(selected._id, changes, token)
            setShowManageModal(false)
            await load()
            alert('Test updated')
        } catch (e) {
            console.error('Failed to update test', e)
            alert('Failed to update test')
        }
    }

    async function submitSeriesTest() {
        try {
            setFormError('')
            setFormSuccess('')
            if (!meta.title) { setFormError('Title required'); return }
            if (!meta.duration) { setFormError('Duration (minutes) is required'); return }
            if (!seriesQuestions || seriesQuestions.length === 0) { setFormError('Add or extract at least one question'); return }
            setLoading(true)
            const { token } = getAuth()
            const fd = new FormData()
            fd.append('title', meta.title)
            if (meta.subject) fd.append('subject', meta.subject)
            if (meta.classes) fd.append('classes', meta.classes)
            if (meta.sections) fd.append('sections', meta.sections)
            if (meta.startDate && meta.startTime) fd.append('start', `${meta.startDate}T${meta.startTime}`)
            if (meta.endDate && meta.endTime) fd.append('end', `${meta.endDate}T${meta.endTime}`)
            if (meta.duration) fd.append('durationMinutes', String(meta.duration))
            if (meta.attempts) fd.append('attempts', String(meta.attempts))
            if (meta.createdBy) fd.append('createdBy', meta.createdBy)
            if (description) fd.append('description', description)

            const created = await createTest(fd, token)
            if (created && created._id) {
                await createTestQuestions(created._id, seriesQuestions, token)
            }
            await load()
            setFormSuccess('Test created and questions submitted')
            setShowCreateModal(false)
            // Optionally open view/edit modal
            if (created) {
                setSelected(created)
                setQuestions(seriesQuestions)
            }
        } catch (err) {
            console.error('Failed to submit test', err)
            setFormError(err && err.message ? err.message : 'Failed to submit test')
        } finally {
            setLoading(false)
        }
    }

    return (
        <FacultyLayout title="My Test Series">
            <div style={{ padding: 20 }}>
                <h2 style={{ textAlign: 'center', marginTop: 4 }}>My Test Series</h2>

                <div style={{ maxWidth: 1200, margin: '18px auto' }}>
                    <div className="faculty-search-header">
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search test series by title, subject or creator" />
                        <button onClick={() => setQ('')} style={{ background: 'var(--bg-hover)', color: 'var(--text-main)' }}>Clear</button>
                        <div className="create-btn-wrapper" style={{ marginLeft: 12 }}>
                            <button onClick={() => { setShowCreateModal(true); setMetaStep(1); setMeta({ title: '', subject: '', classes: '', sections: '', startDate: '', startTime: '', endDate: '', endTime: '', createdBy: '', duration: '', attempts: 1 }); setSelectedOption(null); setSeriesQuestions([]); setSeriesMode(null); setFormError(''); setFormSuccess(''); setDescription(''); setLink(''); setFile(null) }} style={{ background: 'linear-gradient(90deg,#10b981,#06b6d4)', color: '#fff' }}>Create Test</button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                        {tests.filter(t => {
                            const term = q.trim().toLowerCase()
                            if (!term) return true
                            return (String(t.title || '').toLowerCase().includes(term) || String((t.subject || t.type) || '').toLowerCase().includes(term) || String((t.createdBy && (t.createdBy.name || t.createdBy)) || '').toLowerCase().includes(term))
                        }).map(t => (
                            <div key={t._id} className="faculty-card" style={{ borderRadius: 12, padding: 18, minHeight: 320, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>{t.title}</div>
                                <div style={{ color: 'var(--text-main)', marginBottom: 6 }}><strong>Subject:</strong> <span style={{ color: 'var(--text-muted)' }}>{t.subject || t.type || '—'}</span></div>
                                <div style={{ color: 'var(--text-main)', marginBottom: 6 }}><strong>Total Ques:</strong> <span style={{ color: 'var(--text-muted)' }}>{(counts && counts[t._id] !== undefined) ? counts[t._id] : (t.totalQuestions != null ? t.totalQuestions : (t.questions ? t.questions.length : 0))}</span></div>
                                <div style={{ color: 'var(--text-main)', marginBottom: 12 }}><strong>Duration:</strong> <span style={{ color: 'var(--text-muted)' }}>{t.durationMinutes ? `${t.durationMinutes} min` : (t.duration ? `${t.duration} min` : '—')}</span></div>
                                <div style={{ color: 'var(--text-main)', marginBottom: 16 }}><strong>Added By:</strong> <span style={{ color: 'var(--text-muted)' }}>{(() => {
                                    const cb = t.createdBy
                                    if (!cb) return '—'
                                    if (typeof cb === 'string') return cb
                                    const role = cb.role ? String(cb.role).charAt(0).toUpperCase() + String(cb.role).slice(1) : 'Added by'
                                    const name = cb.name || cb.username || ''
                                    return `${role}: ${name || (cb._id ? cb._id : '')}`
                                })()}</span></div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
                                    <button onClick={() => openViewQuestions(t)} style={{ padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', color: '#fff' }}>View Questions</button>
                                    <button onClick={() => openEditQuestions(t)} style={{ padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(90deg,#f59e0b,#b45309)', color: '#fff' }}>Edit Questions</button>
                                    <button onClick={() => openAddQuestions(t)} style={{ padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(90deg,#7c3aed,#60a5fa)', color: '#fff' }}>Add More Questions</button>
                                    <button onClick={() => openManage(t)} style={{ padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(90deg,#10b981,#06b6d4)', color: '#fff' }}>Manage Test Series</button>
                                    <button onClick={() => handleDelete(t._id)} style={{ padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(90deg,#f43f5e,#fb7185)', color: '#fff' }}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Questions View Modal */}
                {showQuestionsModal && (
                    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                        <div style={{ width: 800, maxWidth: '96%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 10, padding: 18, border: '1px solid var(--border)', color: 'var(--text-main)' }}>
                            <h3 style={{ marginTop: 0 }}>Questions — {selected && selected.title}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {loading && <div>Loading...</div>}
                                {!loading && questions.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No questions available.</div>}
                                {questions.map((q, i) => (
                                    <div key={q._id || i} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                                        {q.questionImage ? <div style={{ marginBottom: 6 }}><img src={`${String(q.questionImage).startsWith('http') ? q.questionImage : (API_BASE + q.questionImage)}`} alt={`q${i + 1}`} style={{ maxHeight: 160, borderRadius: 6 }} /></div> : null}
                                        <div style={{ fontWeight: 700 }}>{i + 1}. {q.questionText}</div>
                                        {q.options && q.options.length > 0 ? (
                                            <ul>
                                                {q.options.map((opt, oi) => (
                                                    <li key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span>{opt}</span>
                                                        {(q.optionImages && q.optionImages[oi]) ? <img src={`${String(q.optionImages[oi]).startsWith('http') ? q.optionImages[oi] : (API_BASE + q.optionImages[oi])}`} alt={`opt-${oi}`} style={{ maxHeight: 40, borderRadius: 4 }} /> : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}
                                        <div style={{ marginTop: 6, color: '#6b7280' }}><strong>Marks:</strong> {q.marks || 0}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                <button onClick={() => setShowQuestionsModal(false)} style={{ padding: '8px 12px' }}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Questions Modal */}
                {showEditModal && (
                    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
                        <div style={{ width: 900, maxWidth: '98%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 10, padding: 18, border: '1px solid var(--border)', color: 'var(--text-main)' }}>
                            <h3 style={{ marginTop: 0 }}>Edit Questions — {selected && selected.title}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {questions.map((q, i) => (
                                    <div key={q._id || i} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
                                        <div style={{ fontWeight: 800 }}>{i + 1}</div>
                                        <textarea value={q.questionText || ''} onChange={e => changeQuestionField(i, 'questionText', e.target.value)} rows={2} style={{ width: '100%', padding: 8, marginTop: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                            <label style={{ fontWeight: 700 }}>Question Image:</label>
                                            <input type="file" accept="image/*" onChange={async e => {
                                                const f = e.target.files && e.target.files[0]
                                                if (!f) return
                                                try { const fd = new FormData(); fd.append('file', f); const { token } = getAuth(); const res = await uploadFile(fd, token); changeQuestionField(i, 'questionImage', (res && res.url) || '') } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                                            }} />
                                            {q.questionImage ? <img src={`${String(q.questionImage).startsWith('http') ? q.questionImage : (API_BASE + q.questionImage)}`} alt={`qimg-${i}`} style={{ maxHeight: 70, borderRadius: 6 }} /> : null}
                                            {q.questionImage ? <button onClick={() => changeQuestionField(i, 'questionImage', '')} style={{ padding: '6px 8px' }}>Remove</button> : null}
                                        </div>
                                        {q.options && q.options.length > 0 && (
                                            <div style={{ marginTop: 8 }}>
                                                {q.options.map((opt, oi) => (
                                                    <div key={oi} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <input type="radio" name={`correct_${i}`} checked={q.correctAnswer === opt} onChange={() => changeQuestionField(i, 'correctAnswer', opt)} />
                                                            <input value={opt} onChange={e => {
                                                                const prev = q.options[oi]
                                                                const updated = q.options.map((o, idx2) => idx2 === oi ? e.target.value : o)
                                                                const newCorrect = q.correctAnswer === prev ? e.target.value : q.correctAnswer
                                                                changeQuestionField(i, 'options', updated)
                                                                changeQuestionField(i, 'correctAnswer', newCorrect)
                                                            }} style={{ flex: 1, padding: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <input type="file" accept="image/*" onChange={async e => {
                                                                const f = e.target.files && e.target.files[0]
                                                                if (!f) return
                                                                try { const fd = new FormData(); fd.append('file', f); const { token } = getAuth(); const res = await uploadFile(fd, token); const imgs = Array.isArray(q.optionImages) ? q.optionImages.slice() : []; imgs[oi] = (res && res.url) || ''; changeQuestionField(i, 'optionImages', imgs) } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                                                            }} />
                                                            {q.optionImages && q.optionImages[oi] ? (
                                                                <>
                                                                    <img src={`${String(q.optionImages[oi]).startsWith('http') ? q.optionImages[oi] : (API_BASE + q.optionImages[oi])}`} alt={`opt-${oi}`} style={{ maxHeight: 40, borderRadius: 4 }} />
                                                                    <button onClick={() => { const imgs = Array.isArray(q.optionImages) ? q.optionImages.slice() : []; imgs[oi] = ''; changeQuestionField(i, 'optionImages', imgs) }} style={{ padding: '4px 6px' }}>X</button>
                                                                </>
                                                            ) : null}
                                                            <button onClick={() => {
                                                                const newOpts = q.options.filter((_, k) => k !== oi)
                                                                const newImgs = (q.optionImages || []).filter((_, k) => k !== oi)
                                                                let newCorrect = q.correctAnswer
                                                                if (newCorrect && !newOpts.includes(newCorrect)) newCorrect = ''
                                                                changeQuestionField(i, 'options', newOpts)
                                                                changeQuestionField(i, 'optionImages', newImgs)
                                                                changeQuestionField(i, 'correctAnswer', newCorrect)
                                                            }} style={{ padding: '6px 8px' }}>Remove</button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div style={{ marginTop: 6 }}>
                                                    <button onClick={() => {
                                                        const newOpts = [...(q.options || []), '']
                                                        const newImgs = [...(q.optionImages || []), '']
                                                        changeQuestionField(i, 'options', newOpts)
                                                        changeQuestionField(i, 'optionImages', newImgs)
                                                    }} style={{ padding: '6px 10px' }}>Add Option</button>
                                                </div>
                                                <div style={{ fontSize: 12, color: '#6b7280' }}>Select the radio to mark the correct option.</div>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <input type="number" value={q.marks || 0} onChange={e => changeQuestionField(i, 'marks', Number(e.target.value))} style={{ width: 120, padding: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                <button onClick={() => setShowEditModal(false)} style={{ padding: '8px 12px' }}>Cancel</button>
                                <button onClick={saveEditedQuestions} style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>Save</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Questions Modal */}
                {showAddModal && (
                    <AddQuestionsModal onCancel={() => setShowAddModal(false)} onSave={saveAddedQuestions} />
                )}

                {/* Create Test Modal (admin-style) */}
                {showCreateModal && (
                    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
                        <div style={{ width: 720, maxWidth: '96%', background: 'var(--bg-card)', borderRadius: 10, padding: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', maxHeight: '80vh', overflowY: 'auto', color: 'var(--text-main)' }}>
                            {metaStep === 1 && (
                                <div>
                                    <h3 style={{ marginTop: 0 }}>Create Test — Details</h3>
                                    {formError && <div style={{ color: '#b91c1c', marginBottom: 8, fontWeight: 700 }}>{formError}</div>}
                                    {formSuccess && <div style={{ color: '#065f46', marginBottom: 8, fontWeight: 700 }}>{formSuccess}</div>}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Title</label>
                                        <input value={meta.title} onChange={e => setMeta(s => ({ ...s, title: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }} />

                                        <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Subject</label>
                                        <input value={meta.subject} onChange={e => setMeta(s => ({ ...s, subject: e.target.value }))} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', outline: 'none' }} />

                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Class (comma separated)</label>
                                                <input value={meta.classes} onChange={e => setMeta(s => ({ ...s, classes: e.target.value }))} placeholder="6,7" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Section (comma separated)</label>
                                                <input value={meta.sections} onChange={e => setMeta(s => ({ ...s, sections: e.target.value }))} placeholder="A,B" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Start Date</label>
                                                <input type="date" value={meta.startDate} onChange={e => setMeta(s => ({ ...s, startDate: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Start Time</label>
                                                <input type="time" value={meta.startTime} onChange={e => setMeta(s => ({ ...s, startTime: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>End Date (optional)</label>
                                                <input type="date" value={meta.endDate} onChange={e => setMeta(s => ({ ...s, endDate: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>End Time (optional)</label>
                                                <input type="time" value={meta.endTime} onChange={e => setMeta(s => ({ ...s, endTime: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                            </div>
                                        </div>

                                        <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Created By (optional)</label>
                                        <input value={meta.createdBy} onChange={e => setMeta(s => ({ ...s, createdBy: e.target.value }))} placeholder="Name" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />

                                        <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Description / Instructions</label>
                                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />

                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Duration (minutes, required)</label>
                                                <input type="number" value={meta.duration || ''} onChange={e => setMeta(s => ({ ...s, duration: e.target.value }))} placeholder="e.g., 30" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                            </div>
                                            <div style={{ width: 180 }}>
                                                <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Attempts per student</label>
                                                <input type="number" min={1} value={meta.attempts || 1} onChange={e => setMeta(s => ({ ...s, attempts: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                            <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-main)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>Cancel</button>
                                            <button onClick={() => {
                                                setFormError('')
                                                if (!meta.title) { setFormError('Title required'); return }
                                                if (!meta.duration) { setFormError('Duration (minutes) is required'); return }
                                                setMetaStep(2)
                                            }} style={{ background: 'linear-gradient(90deg,#06b6d4,#0ea5a5)', color: '#fff', padding: '8px 12px', borderRadius: 8, border: '2px solid rgba(0,0,0,0.7)' }}>Proceed</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {metaStep === 2 && (
                                <div>
                                    <h3 style={{ marginTop: 0 }}>Choose Creation Method</h3>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div style={{ flex: 1, padding: 16, borderRadius: 10, background: selectedOption === 'google' ? 'var(--bg-hover)' : 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                            <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Google Form</h4>
                                            <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>Paste a Google Form link and the test will be created referencing it.</p>
                                            <div>
                                                <input placeholder="https://forms.gle/..." value={link} onChange={e => setLink(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                            </div>
                                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                                                <button onClick={async () => {
                                                    setFormError('')
                                                    if (!meta.title) { setFormError('Title required'); return }
                                                    if (!link) { setFormError('Google Form link required'); return }
                                                    if (!meta.duration) { setFormError('Duration (minutes) is required'); return }
                                                    setLoading(true)
                                                    try {
                                                        const fd = new FormData()
                                                        fd.append('title', meta.title)
                                                        fd.append('type', 'google_form')
                                                        fd.append('link', link)
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
                                                        if (description) fd.append('description', description)
                                                        await createTest(fd, getAuth().token)
                                                        await load()
                                                        setFormSuccess('Google form test created')
                                                        setShowCreateModal(false)
                                                    } catch (err) { console.error(err); setFormError(err && err.message ? err.message : 'Failed') } finally { setLoading(false) }
                                                }} style={{ background: 'linear-gradient(90deg,#2563eb,#4f46e5)', color: '#fff', padding: '8px 12px', borderRadius: 8, border: '2px solid rgba(0,0,0,0.7)' }}>Create</button>
                                            </div>
                                        </div>

                                        <div style={{ flex: 1, padding: 16, borderRadius: 10, background: selectedOption === 'bulk' ? 'var(--bg-hover)' : 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                            <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Bulk Upload</h4>
                                            <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>Upload a .docx (or PDF) following the format: question, then 4 options, correct answer and marks mentioned. The server will parse and create questions.</p>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={bulkProceedChecked} onChange={e => setBulkProceedChecked(e.target.checked)} /> <span style={{ color: 'var(--text-main)' }}>I confirm my document matches the required format.</span></label>
                                            <div style={{ marginTop: 8 }}>
                                                <input type="file" accept=".docx,.pdf" onChange={e => setBulkFile(e.target.files && e.target.files[0])} style={{ padding: 6 }} />
                                            </div>
                                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                                                <button onClick={async () => {
                                                    setFormError('')
                                                    setFormSuccess('')
                                                    if (!bulkProceedChecked) { setFormError('Please confirm document format'); return }
                                                    if (!bulkFile) { setFormError('Please choose a file'); return }
                                                    setLoading(true)
                                                    try {
                                                        const fd = new FormData()
                                                        fd.append('file', bulkFile)
                                                        const res = await parseTestFile(fd, getAuth().token)
                                                        const parsed = (res && res.questions) ? res.questions.map(q => ({ questionText: q.questionText || '', options: q.options || [], correctAnswer: q.correctAnswer || '', marks: q.marks || 1 })) : []
                                                        if (!parsed.length) {
                                                            setFormError('No questions were extracted. Please check document format.')
                                                        } else {
                                                            setSeriesQuestions(parsed)
                                                            const hasOpts = parsed.filter(p => p.options && p.options.length).length
                                                            setSeriesMode(hasOpts > 0 ? 'mcq' : 'subjective')
                                                            setFormSuccess(`Extraction complete — ${parsed.length} questions parsed. Review and Edit them in Create Series section, then click Submit Test.`)
                                                        }
                                                    } catch (err) { console.error(err); setFormError(err && err.message ? err.message : 'Failed to extract') } finally { setLoading(false) }
                                                }} style={{ background: 'linear-gradient(90deg,#b45309,#ea580c)', color: '#fff', padding: '8px 12px', borderRadius: 8, border: '2px solid rgba(0,0,0,0.7)' }}>Extract & Preview</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', maxHeight: '60vh', overflowY: 'auto' }}>
                                            <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Create Series (manual)</h4>
                                            <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>Build a test series by adding subjective or MCQ questions manually.</p>
                                            {!seriesMode && (
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button onClick={() => setSeriesMode('subjective')} style={{ padding: '8px 12px', background: 'linear-gradient(90deg,#06b6d4,#10b981)', color: '#fff', borderRadius: 8, border: '2px solid #000' }}>Subjective</button>
                                                    <button onClick={() => setSeriesMode('mcq')} style={{ padding: '8px 12px', background: 'linear-gradient(90deg,#7c3aed,#2563eb)', color: '#fff', borderRadius: 8, border: '2px solid #000' }}>MCQ</button>
                                                </div>
                                            )}

                                            {seriesMode && (
                                                <div style={{ marginTop: 8 }}>
                                                    <div style={{ marginBottom: 8 }}>
                                                        <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Question</label>
                                                        <textarea value={seriesQ.questionText} onChange={e => setSeriesQ(s => ({ ...s, questionText: e.target.value }))} rows={3} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <label style={{ fontWeight: 700 }}>Question Image:</label>
                                                            <input type="file" accept="image/*" onChange={async e => {
                                                                const f = e.target.files && e.target.files[0]
                                                                if (!f) return
                                                                try {
                                                                    const fd = new FormData(); fd.append('file', f)
                                                                    const { token } = getAuth()
                                                                    const res = await uploadFile(fd, token)
                                                                    setSeriesQ(s => ({ ...s, questionImage: (res && res.url) || '' }))
                                                                } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                                                            }} />
                                                            {seriesQ.questionImage ? <img src={`${seriesQ.questionImage.startsWith('http') ? seriesQ.questionImage : (API_BASE + seriesQ.questionImage)}`} alt="question" style={{ maxHeight: 60, borderRadius: 6 }} /> : null}
                                                            {seriesQ.questionImage ? <button onClick={() => setSeriesQ(s => ({ ...s, questionImage: '' }))} style={{ padding: '6px 8px' }}>Remove</button> : null}
                                                        </div>
                                                    </div>
                                                    {seriesMode === 'mcq' && (
                                                        <div>
                                                            <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Options (4 default)</label>
                                                            {seriesQ.options.map((opt, i) => (
                                                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                        <input value={opt} onChange={e => setSeriesQ(s => ({ ...s, options: s.options.map((o, idx) => idx === i ? e.target.value : o) }))} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="radio" name="correct" checked={seriesQ.correctIndex === i} onChange={() => setSeriesQ(s => ({ ...s, correctIndex: i }))} /> <span style={{ color: 'var(--text-main)' }}>Correct</span></label>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <input type="file" accept="image/*" onChange={async e => {
                                                                            const f = e.target.files && e.target.files[0]
                                                                            if (!f) return
                                                                            try {
                                                                                const fd = new FormData(); fd.append('file', f)
                                                                                const { token } = getAuth()
                                                                                const res = await uploadFile(fd, token)
                                                                                setSeriesQ(s => ({ ...s, optionImages: s.optionImages.map((img, idx) => idx === i ? ((res && res.url) || '') : img) }))
                                                                            } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                                                                        }} />
                                                                        {seriesQ.optionImages && seriesQ.optionImages[i] ? (
                                                                            <>
                                                                                <img src={`${seriesQ.optionImages[i].startsWith('http') ? seriesQ.optionImages[i] : (API_BASE + seriesQ.optionImages[i])}`} alt={`opt-${i}`} style={{ maxHeight: 40, borderRadius: 4 }} />
                                                                                <button onClick={() => setSeriesQ(s => ({ ...s, optionImages: s.optionImages.map((img, idx) => idx === i ? '' : img) }))} style={{ padding: '4px 6px' }}>X</button>
                                                                            </>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {seriesMode === 'subjective' && (
                                                        <div>
                                                            <label style={{ fontWeight: 800, color: 'var(--text-main)' }}>Answer / Model Answer</label>
                                                            <textarea value={seriesQ.answerText} onChange={e => setSeriesQ(s => ({ ...s, answerText: e.target.value }))} rows={2} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                        <input type="number" value={seriesQ.marks} onChange={e => setSeriesQ(s => ({ ...s, marks: Number(e.target.value) }))} style={{ width: 120, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                                        <input type="number" value={seriesQ.negative} onChange={e => setSeriesQ(s => ({ ...s, negative: Number(e.target.value) }))} style={{ width: 120, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                                        <button onClick={() => {
                                                            setFormError('')
                                                            if (!seriesQ.questionText) { setFormError('Question text required'); return }
                                                            const qobj = seriesMode === 'mcq' ? { questionText: seriesQ.questionText, questionImage: seriesQ.questionImage || '', options: seriesQ.options.slice(), optionImages: (seriesQ.optionImages || []).slice(0, seriesQ.options.length), correctAnswer: seriesQ.options[seriesQ.correctIndex] || '', marks: seriesQ.marks || 1 } : { questionText: seriesQ.questionText, questionImage: seriesQ.questionImage || '', options: [], optionImages: [], correctAnswer: seriesQ.answerText || '', marks: seriesQ.marks || 1 }
                                                            setSeriesQuestions(s => ([...s, qobj]))
                                                            setSeriesQ({ questionText: '', questionImage: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], correctIndex: 0, marks: 1, negative: 0, answerText: '' })
                                                        }} style={{ padding: '8px 12px', background: 'linear-gradient(90deg,#06b6d4,#10b981)', color: '#fff', borderRadius: 8, border: '2px solid #000' }}>Add Question</button>
                                                    </div>

                                                    <div style={{ marginTop: 12 }}>
                                                        <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden', border: '1px dashed var(--border)', padding: 8 }}>
                                                            {seriesQuestions.length === 0 && <div style={{ color: '#6b7280' }}>No questions added yet.</div>}
                                                            {seriesQuestions.map((q, idx) => (
                                                                <div key={idx} style={{ padding: 10, borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 6, marginBottom: 8 }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <div style={{ fontWeight: 700 }}>{idx + 1}. Question</div>
                                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                                            <button onClick={() => {
                                                                                setSeriesQuestions(s => s.filter((_, i) => i !== idx))
                                                                            }} style={{ padding: '6px 10px', background: '#ef4444', color: '#fff', borderRadius: 6, border: 'none' }}>Delete</button>
                                                                        </div>
                                                                    </div>

                                                                    <div style={{ marginTop: 8 }}>
                                                                        <textarea value={q.questionText || ''} onChange={e => setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, questionText: e.target.value }) : it))} rows={2} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                                                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                            <label style={{ fontWeight: 700 }}>Question Image:</label>
                                                                            <input type="file" accept="image/*" onChange={async e => {
                                                                                const f = e.target.files && e.target.files[0]
                                                                                if (!f) return
                                                                                try { const fd = new FormData(); fd.append('file', f); const { token } = getAuth(); const res = await uploadFile(fd, token); setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, questionImage: (res && res.url) || '' }) : it)) } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                                                                            }} />
                                                                            {q.questionImage ? <img src={`${q.questionImage.startsWith('http') ? q.questionImage : (API_BASE + q.questionImage)}`} alt="qimg" style={{ maxHeight: 60, borderRadius: 6 }} /> : null}
                                                                            {q.questionImage ? <button onClick={() => setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, questionImage: '' }) : it))} style={{ padding: '6px 8px' }}>Remove</button> : null}
                                                                        </div>
                                                                    </div>

                                                                    {q.options && q.options.length > 0 ? (
                                                                        <div style={{ marginTop: 8 }}>
                                                                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Options</div>
                                                                            {q.options.map((opt, oi) => (
                                                                                <div key={oi} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                                        <input value={opt} onChange={e => setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, options: it.options.map((o, oi2) => oi2 === oi ? e.target.value : o) }) : it))} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                                                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                            <input type="radio" name={`correct-${idx}`} checked={q.correctAnswer === opt} onChange={() => setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, correctAnswer: opt }) : it))} />
                                                                                            <span style={{ fontSize: 13 }}>Correct</span>
                                                                                        </label>
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                        <input type="file" accept="image/*" onChange={async e => {
                                                                                            const f = e.target.files && e.target.files[0]
                                                                                            if (!f) return
                                                                                            try { const fd = new FormData(); fd.append('file', f); const { token } = getAuth(); const res = await uploadFile(fd, token); setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, optionImages: (it.optionImages || []).map((img, jj) => jj === oi ? ((res && res.url) || '') : img) }) : it)) } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                                                                                        }} />
                                                                                        {q.optionImages && q.optionImages[oi] ? (
                                                                                            <>
                                                                                                <img src={`${q.optionImages[oi].startsWith('http') ? q.optionImages[oi] : (API_BASE + q.optionImages[oi])}`} alt={`opt-${oi}`} style={{ maxHeight: 40, borderRadius: 4 }} />
                                                                                                <button onClick={() => setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, optionImages: (it.optionImages || []).map((img, jj) => jj === oi ? '' : img) }) : it))} style={{ padding: '4px 6px' }}>X</button>
                                                                                            </>
                                                                                        ) : null}
                                                                                        <button onClick={() => {
                                                                                            setSeriesQuestions(s => s.map((it, i) => {
                                                                                                if (i !== idx) return it
                                                                                                const newOpts = it.options.filter((_, k) => k !== oi)
                                                                                                const newImgs = (it.optionImages || []).filter((_, k) => k !== oi)
                                                                                                let newCorrect = it.correctAnswer
                                                                                                if (it.correctAnswer && !newOpts.includes(it.correctAnswer)) newCorrect = ''
                                                                                                return { ...it, options: newOpts, optionImages: newImgs, correctAnswer: newCorrect }
                                                                                            }))
                                                                                        }} style={{ padding: '6px 8px', background: '#f97316', color: '#fff', borderRadius: 6, border: 'none' }}>Remove</button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                            <div style={{ marginTop: 6 }}>
                                                                                <button onClick={() => setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, options: [...(it.options || []), ''], optionImages: [...(it.optionImages || []), ''] }) : it))} style={{ padding: '6px 10px', background: '#06b6d4', color: '#fff', borderRadius: 6, border: 'none' }}>Add Option</button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ marginTop: 8 }}>
                                                                            <div style={{ fontWeight: 700 }}>Model Answer</div>
                                                                            <textarea value={q.correctAnswer || ''} onChange={e => setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, correctAnswer: e.target.value }) : it))} rows={2} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)' }} />
                                                                        </div>
                                                                    )}

                                                                    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                        <div>
                                                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Marks</div>
                                                                            <input type="number" value={q.marks || 1} onChange={e => setSeriesQuestions(s => s.map((it, i) => i === idx ? ({ ...it, marks: Number(e.target.value) }) : it))} style={{ width: 100, padding: 6, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                                                                        </div>
                                                                        <div style={{ marginLeft: 'auto' }}>
                                                                            <button onClick={() => {
                                                                                setSeriesQuestions(s => {
                                                                                    const copy = [...s]
                                                                                    const item = copy.splice(idx, 1)[0]
                                                                                    copy.unshift(item)
                                                                                    return copy
                                                                                })
                                                                            }} style={{ padding: '6px 10px', background: '#10b981', color: '#fff', borderRadius: 6, border: 'none' }}>Move Top</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                                <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '2px solid #000' }}>Cancel</button>
                                                <button disabled={loading || seriesQuestions.length === 0} onClick={submitSeriesTest} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', color: '#fff', background: seriesQuestions.length ? 'linear-gradient(90deg,#06b6d4,#10b981)' : '#9ca3af', cursor: loading || seriesQuestions.length === 0 ? 'not-allowed' : 'pointer' }}>
                                                    {loading ? 'Submitting...' : 'Submit Test'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Manage Test Modal */}
                {showManageModal && selected && (
                    <ManageTestModal test={selected} onCancel={() => setShowManageModal(false)} onSave={saveManageDetails} />
                )}
            </div>
        </FacultyLayout>
    )

}

function AddQuestionsModal({ onCancel, onSave }) {
    const [items, setItems] = useState([])
    const [cur, setCur] = useState({ questionText: '', questionImage: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], marks: 1 })

    function addCurrent() {
        if (!cur.questionText) return alert('Question text required')
        const copy = JSON.parse(JSON.stringify(cur))
        if (typeof cur.correctIndex === 'number' && cur.options && cur.options[cur.correctIndex]) {
            copy.correctAnswer = cur.options[cur.correctIndex]
        } else {
            copy.correctAnswer = copy.correctAnswer || ''
        }
        setItems(s => ([...s, copy]))
        setCur({ questionText: '', questionImage: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], marks: 1 })
    }

    return (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
            <div style={{ width: 900, maxWidth: '98%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 10, padding: 18, border: '1px solid var(--border)', color: 'var(--text-main)' }}>
                <h3>Add Questions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label>Question</label>
                    <textarea value={cur.questionText} onChange={e => setCur(c => ({ ...c, questionText: e.target.value }))} rows={3} style={{ width: '100%', padding: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-main)', color: 'var(--text-main)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontWeight: 700 }}>Question Image:</label>
                        <input type="file" accept="image/*" onChange={async e => {
                            const f = e.target.files && e.target.files[0]; if (!f) return
                            try { const fd = new FormData(); fd.append('file', f); const { token } = getAuth(); const res = await uploadFile(fd, token); setCur(c => ({ ...c, questionImage: (res && res.url) || '' })) } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                        }} />
                        {cur.questionImage ? <img src={`${cur.questionImage.startsWith('http') ? cur.questionImage : (API_BASE + cur.questionImage)}`} alt="qimg" style={{ maxHeight: 60, borderRadius: 6 }} /> : null}
                        {cur.questionImage ? <button onClick={() => setCur(c => ({ ...c, questionImage: '' }))} style={{ padding: '6px 8px' }}>Remove</button> : null}
                    </div>
                    <label>Options (optional)</label>
                    <div style={{ border: '2px solid #000', padding: 10, borderRadius: 6, marginBottom: 8, background: '#fff' }}>
                        {cur.options.map((opt, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input type="radio" name="correctOption" checked={cur.correctIndex === i} onChange={() => setCur(c => ({ ...c, correctIndex: i }))} />
                                    <input value={opt} onChange={e => setCur(c => ({ ...c, options: c.options.map((o, idx) => idx === i ? e.target.value : o) }))} style={{ padding: 8, width: '100%', border: '2px solid #000', borderRadius: 6 }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <input type="file" accept="image/*" onChange={async e => {
                                        const f = e.target.files && e.target.files[0]; if (!f) return
                                        try { const fd = new FormData(); fd.append('file', f); const { token } = getAuth(); const res = await uploadFile(fd, token); setCur(c => ({ ...c, optionImages: c.optionImages.map((img, idx) => idx === i ? ((res && res.url) || '') : img) })) } catch (err) { alert(err && err.message ? err.message : 'Upload failed') }
                                    }} />
                                    {cur.optionImages && cur.optionImages[i] ? (
                                        <>
                                            <img src={`${cur.optionImages[i].startsWith('http') ? cur.optionImages[i] : (API_BASE + cur.optionImages[i])}`} alt={`opt-${i}`} style={{ maxHeight: 40, borderRadius: 4 }} />
                                            <button onClick={() => setCur(c => ({ ...c, optionImages: c.optionImages.map((img, idx) => idx === i ? '' : img) }))} style={{ padding: '4px 6px' }}>X</button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        <div>
                            <button onClick={() => setCur(c => ({ ...c, options: [...c.options, ''], optionImages: [...(c.optionImages || []), ''] }))} style={{ padding: '6px 10px' }}>Add Option</button>
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Select the radio to mark the correct option.</div>
                    </div>
                    <label>Marks</label>
                    <input type="number" value={cur.marks} onChange={e => setCur(c => ({ ...c, marks: Number(e.target.value) }))} style={{ width: 120, padding: 8, border: '2px solid #000', borderRadius: 6 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={addCurrent} style={{ padding: '8px 12px' }}>Add to list</button>
                        <button onClick={() => { if (!items.length) return alert('Add at least one question'); onSave(items) }} style={{ padding: '8px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6 }}>Save All</button>
                        <button onClick={onCancel} style={{ padding: '8px 12px' }}>Cancel</button>
                    </div>
                </div>

                {items.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <h4>Queued Questions</h4>
                        <ol>
                            {items.map((it, i) => <li key={i}><div style={{ fontWeight: 700 }}>{it.questionText}{it.correctAnswer ? (<div style={{ fontWeight: 400, fontSize: 13, color: '#374151' }}>Correct: {it.correctAnswer}</div>) : null}</div></li>)}
                        </ol>
                    </div>
                )}
            </div>
        </div>
    )
}

function ManageTestModal({ test, onCancel, onSave }) {
    const [form, setForm] = useState({ title: test.title || '', description: test.description || '', price: test.price || test.fee || 0, durationMinutes: test.durationMinutes || test.duration || 0, classes: (test.classes || []).join(','), sections: (test.sections || []).join(',') })

    return (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
            <div style={{ width: 720, maxWidth: '96%', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 10, padding: 18, border: '2px solid #000' }}>
                <h3>Manage Test Series — {test.title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label>Title</label>
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ padding: 8, border: '2px solid #000', borderRadius: 6 }} />
                    <label>Description / Instructions</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ padding: 8, border: '2px solid #000', borderRadius: 6 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <div>
                            <label>Price</label>
                            <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} style={{ padding: 8, border: '2px solid #000', borderRadius: 6 }} />
                        </div>
                        <div>
                            <label>Duration (minutes)</label>
                            <input type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} style={{ padding: 8, border: '2px solid #000', borderRadius: 6 }} />
                        </div>
                    </div>
                    <label>Classes (comma separated)</label>
                    <input value={form.classes} onChange={e => setForm(f => ({ ...f, classes: e.target.value }))} style={{ padding: 8, border: '2px solid #000', borderRadius: 6 }} />
                    <label>Sections (comma separated)</label>
                    <input value={form.sections} onChange={e => setForm(f => ({ ...f, sections: e.target.value }))} style={{ padding: 8, border: '2px solid #000', borderRadius: 6 }} />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button onClick={onCancel} style={{ padding: '8px 12px' }}>Cancel</button>
                        <button onClick={() => {
                            const payload = {
                                title: form.title,
                                description: form.description,
                                price: Number(form.price || 0),
                                durationMinutes: Number(form.durationMinutes || 0),
                                classes: form.classes ? form.classes.split(',').map(s => s.trim()).filter(Boolean) : [],
                                sections: form.sections ? form.sections.split(',').map(s => s.trim()).filter(Boolean) : []
                            }
                            onSave(payload)
                        }} style={{ padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}>Save</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
