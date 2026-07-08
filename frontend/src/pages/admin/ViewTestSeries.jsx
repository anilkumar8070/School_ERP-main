import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getTests, getTestQuestions, createTestQuestions, updateTest, deleteTest, uploadFile, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'

export default function ViewTestSeries() {
    const [tests, setTests] = useState([])
    const [counts, setCounts] = useState({})
    const [q, setQ] = useState('')

    async function load() {
        try {
            const { token, role } = getAuth()
            const data = await getTests(token)
            const testsList = data || []
            setTests(testsList)

            // fetch exact question counts per test only for admins (avoids 403s)
            if (role === 'admin') {
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
                } catch (err) {
                    console.warn('Failed to fetch question counts', err)
                }
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

    return (
        <AdminLayout title="All Test Series">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>All Test Series</h2>
                </header>

                <div className="admin-card">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                        <input className="admin-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search test series by title, subject or creator" style={{ maxWidth: 400 }} />
                        <button className="btn-secondary" onClick={() => setQ('')} style={{ height: '100%' }}>Clear</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                        {tests.filter(t => {
                            const term = q.trim().toLowerCase()
                            if (!term) return true
                            return (String(t.title || '').toLowerCase().includes(term) || String((t.subject || t.type) || '').toLowerCase().includes(term) || String((t.createdBy && (t.createdBy.name || t.createdBy)) || '').toLowerCase().includes(term))
                        }).map(t => (
                            <div key={t._id} className="admin-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>{t.title}</div>

                                <div style={{ display: 'grid', gap: 6, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: 16 }}>
                                    <div><strong style={{ color: 'var(--text-muted)' }}>Subject:</strong> {(t.subject && typeof t.subject === 'object') ? (t.subject.name || t.subject.title || t.subject.label || JSON.stringify(t.subject)) : (t.subject || t.type || '—')}</div>
                                    <div><strong style={{ color: 'var(--text-muted)' }}>For:</strong> {((t.classes && t.classes.length) ? `Classes: ${(t.classes || []).join(',')}` : '')}{(t.classes && t.classes.length) && (t.sections && t.sections.length) ? ' · ' : ''}{(t.sections && t.sections.length) ? `Sections: ${(t.sections || []).join(',')}` : ((!t.classes || !t.classes.length) ? '—' : '')}</div>
                                    <div><strong style={{ color: 'var(--text-muted)' }}>Total Ques:</strong> {(counts && counts[t._id] !== undefined) ? counts[t._id] : (t.totalQuestions != null ? t.totalQuestions : (t.questions ? t.questions.length : 0))}</div>
                                    <div><strong style={{ color: 'var(--text-muted)' }}>Duration:</strong> {t.durationMinutes ? `${t.durationMinutes} min` : (t.duration ? `${t.duration} min` : '—')}</div>
                                    <div><strong style={{ color: 'var(--text-muted)' }}>Attempts:</strong> {t.attempts || t.attempts === 0 ? String(t.attempts) : (t.attempts === undefined && t.attempt ? String(t.attempt) : '—')}</div>
                                    <div><strong style={{ color: 'var(--text-muted)' }}>Added By:</strong> {(() => {
                                        const cb = t.createdBy
                                        if (!cb) return '—'
                                        if (typeof cb === 'string') return cb
                                        const role = cb.role ? String(cb.role).charAt(0).toUpperCase() + String(cb.role).slice(1) : 'Added by'
                                        const name = cb.name || cb.username || ''
                                        return `${role}: ${name || (cb._id ? cb._id : '')}`
                                    })()}</div>
                                </div>

                                <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
                                    <button className="btn-primary" onClick={() => openViewQuestions(t)}>View Questions</button>
                                    <button className="btn-secondary" onClick={() => openEditQuestions(t)}>Edit Questions</button>
                                    <button className="btn-secondary" onClick={() => openAddQuestions(t)}>Add More Questions</button>
                                    <button className="btn-secondary" onClick={() => openManage(t)}>Manage Test Series</button>
                                    <button className="btn-danger" style={{ background: 'var(--error, #ef4444)', color: 'white', border: 'none', padding: '8px', borderRadius: 'var(--radius-sm)' }} onClick={() => handleDelete(t._id)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {tests.length === 0 && <div className="empty-state">No test series found.</div>}
                </div>

                {/* Questions View Modal */}
                {showQuestionsModal && (
                    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                        <div className="admin-card" style={{ width: 800, maxWidth: '96%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
                            <h3 style={{ marginTop: 0 }}>Questions — {selected && selected.title}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {loading && <div>Loading...</div>}
                                {!loading && questions.length === 0 && <div className="empty-state">No questions available.</div>}
                                {questions.map((q, i) => (
                                    <div key={q._id || i} style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-main)' }}>
                                        <div style={{ fontWeight: 700 }}>{i + 1}. {q.questionText}</div>
                                        {q.options && q.options.length > 0 ? (
                                            <ul style={{ margin: '8px 0 0 20px', color: 'var(--text-muted)' }}>
                                                {q.options.map((opt, oi) => <li key={oi}>{opt}</li>)}
                                            </ul>
                                        ) : null}
                                        <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '0.9rem' }}><strong>Marks:</strong> {q.marks || 0}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                <button className="btn-secondary" onClick={() => setShowQuestionsModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Questions Modal */}
                {showEditModal && (
                    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }}>
                        <div className="admin-card" style={{ width: 900, maxWidth: '98%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
                            <h3 style={{ marginTop: 0 }}>Edit Questions — {selected && selected.title}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {questions.map((q, i) => (
                                    <div key={q._id || i} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                        <div style={{ fontWeight: 800, marginBottom: 8 }}>Question {i + 1}</div>
                                        <textarea className="admin-textarea" value={q.questionText || ''} onChange={e => changeQuestionField(i, 'questionText', e.target.value)} rows={2} />

                                        {q.options && q.options.length > 0 && (
                                            <div style={{ marginTop: 12 }}>
                                                {q.options.map((opt, oi) => (
                                                    <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                        <input type="radio" name={`correct_${i}`} checked={q.correctAnswer === opt} onChange={() => changeQuestionField(i, 'correctAnswer', opt)} />
                                                        <input className="admin-input" value={opt} onChange={e => {
                                                            const prev = q.options[oi]
                                                            const updated = q.options.map((o, idx2) => idx2 === oi ? e.target.value : o)
                                                            const newCorrect = q.correctAnswer === prev ? e.target.value : q.correctAnswer
                                                            changeQuestionField(i, 'options', updated)
                                                            changeQuestionField(i, 'correctAnswer', newCorrect)
                                                        }} />
                                                    </div>
                                                ))}
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select the radio to mark the correct option.</div>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                                            <label style={{ fontSize: '0.9rem' }}>Marks:</label>
                                            <input className="admin-input" type="number" value={q.marks || 0} onChange={e => changeQuestionField(i, 'marks', Number(e.target.value))} style={{ width: 100 }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                                <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                                <button className="btn-primary" onClick={saveEditedQuestions}>Save Changes</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Questions Modal */}
                {showAddModal && (
                    <AddQuestionsModal onCancel={() => setShowAddModal(false)} onSave={saveAddedQuestions} />
                )}

                {/* Manage Test Modal */}
                {showManageModal && selected && (
                    <ManageTestModal test={selected} onCancel={() => setShowManageModal(false)} onSave={saveManageDetails} />
                )}
            </div>
        </AdminLayout>
    )
}

function AddQuestionsModal({ onCancel, onSave }) {
    const [items, setItems] = useState([])
    const [cur, setCur] = useState({ questionText: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], marks: 1, questionImage: '' })

    function addCurrent() {
        if (!cur.questionText) return alert('Question text required')
        const copy = JSON.parse(JSON.stringify(cur))
        if (typeof cur.correctIndex === 'number' && cur.options && cur.options[cur.correctIndex]) {
            copy.correctAnswer = cur.options[cur.correctIndex]
        } else {
            copy.correctAnswer = copy.correctAnswer || ''
        }
        setItems(s => ([...s, copy]))
        setCur({ questionText: '', options: ['', '', '', ''], optionImages: ['', '', '', ''], marks: 1, questionImage: '', correctIndex: undefined })
    }

    return (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
            <div className="admin-card" style={{ width: 900, maxWidth: '98%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
                <h3>Add Questions</h3>
                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="form-group">
                        <label>Question</label>
                        <textarea className="admin-textarea" value={cur.questionText} onChange={e => setCur(c => ({ ...c, questionText: e.target.value }))} rows={3} />
                    </div>

                    <div className="form-group">
                        <label>Question Image (optional)</label>
                        <ImagePicker value={cur.questionImage} onChange={url => setCur(c => ({ ...c, questionImage: url }))} />
                    </div>

                    <div className="form-group">
                        <label>Options (optional)</label>
                        <div style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 'var(--radius-sm)', background: 'var(--bg-main)' }}>
                            {cur.options.map((opt, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, marginBottom: 16, alignItems: 'start' }}>
                                    <input type="radio" name="correctOption" checked={cur.correctIndex === i} onChange={() => setCur(c => ({ ...c, correctIndex: i }))} style={{ marginTop: 12 }} />
                                    <div>
                                        <input className="admin-input" value={opt} onChange={e => setCur(c => ({ ...c, options: c.options.map((o, idx) => idx === i ? e.target.value : o) }))} placeholder={`Option ${i + 1}`} />
                                        <div style={{ marginTop: 8 }}>
                                            <ImagePicker value={cur.optionImages[i]} onChange={url => setCur(c => ({ ...c, optionImages: c.optionImages.map((u, idx) => idx === i ? url : u) }))} label={`Option ${i + 1} Image (optional)`} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select the radio to mark the correct option.</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Marks</label>
                        <input className="admin-input" type="number" value={cur.marks} onChange={e => setCur(c => ({ ...c, marks: Number(e.target.value) }))} style={{ width: 120 }} />
                    </div>

                    <div className="btn-group">
                        <button className="btn-secondary" onClick={addCurrent}>Add to list</button>
                        <button className="btn-primary" onClick={() => { if (!items.length) return alert('Add at least one question'); onSave(items) }}>Save All</button>
                        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
                    </div>
                </div>

                {items.length > 0 && (
                    <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                        <h4>Queued Questions</h4>
                        <ol style={{ paddingLeft: 20 }}>
                            {items.map((it, i) => <li key={i}><div style={{ fontWeight: 600 }}>{it.questionText}{it.correctAnswer ? (<div style={{ fontWeight: 400, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Correct: {it.correctAnswer}</div>) : null}</div></li>)}
                        </ol>
                    </div>
                )}
            </div>
        </div>
    )
}

function ImagePicker({ value, onChange, label = 'Image (optional)' }) {
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState(value || '')
    useEffect(() => { setPreview(value || '') }, [value])

    async function onFile(e) {
        const file = e.target.files && e.target.files[0]
        if (!file) return
        try {
            setUploading(true)
            const fd = new FormData()
            fd.append('file', file)
            const { token } = getAuth()
            const res = await uploadFile(fd, token)
            const url = res && res.url ? res.url : ''
            setPreview(url)
            onChange && onChange(url)
        } catch (err) {
            alert('Upload failed')
        } finally { setUploading(false) }
    }

    return (
        <div style={{ border: '1px dashed var(--border)', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{label}</span>
                <input type="file" accept="image/*" onChange={onFile} className="admin-file-input" style={{ padding: '8px', fontSize: '0.9rem' }} />
                {uploading ? <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Uploading...</span> : null}
            </div>
            {preview ? (
                <img
                    src={`${String(preview).startsWith('http') ? preview : `${API_BASE}${preview}`}`}
                    alt="preview"
                    style={{ marginTop: 12, maxWidth: '100%', height: 'auto', maxHeight: 220, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }}
                />
            ) : null}
        </div>
    )
}

function ManageTestModal({ test, onCancel, onSave }) {
    const [form, setForm] = useState({ title: test.title || '', subject: test.subject || '', description: test.description || '', price: test.price || test.fee || 0, durationMinutes: test.durationMinutes || test.duration || 0, attempts: test.attempts || 1, classes: (test.classes || []).join(','), sections: (test.sections || []).join(',') })

    return (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120 }}>
            <div className="admin-card" style={{ width: 720, maxWidth: '96%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
                <h3>Manage Test Series — {test.title}</h3>
                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="form-group">
                        <label>Title</label>
                        <input className="admin-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>Subject</label>
                        <input className="admin-input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>Description / Instructions</label>
                        <textarea className="admin-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
                    </div>
                    <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div className="form-group">
                            <label>Price</label>
                            <input className="admin-input" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
                        </div>
                        <div className="form-group">
                            <label>Duration (min)</label>
                            <input className="admin-input" type="number" value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} />
                        </div>
                        <div className="form-group">
                            <label>Attempts</label>
                            <input className="admin-input" type="number" min={1} value={form.attempts} onChange={e => setForm(f => ({ ...f, attempts: Number(e.target.value) }))} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Classes (comma separated)</label>
                        <input className="admin-input" value={form.classes} onChange={e => setForm(f => ({ ...f, classes: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>Sections (comma separated)</label>
                        <input className="admin-input" value={form.sections} onChange={e => setForm(f => ({ ...f, sections: e.target.value }))} />
                    </div>

                    <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
                        <button className="btn-primary" onClick={() => {
                            const payload = {
                                title: form.title,
                                subject: form.subject,
                                description: form.description,
                                price: Number(form.price || 0),
                                durationMinutes: Number(form.durationMinutes || 0),
                                attempts: Number(form.attempts || 1),
                                classes: form.classes ? form.classes.split(',').map(s => s.trim()).filter(Boolean) : [],
                                sections: form.sections ? form.sections.split(',').map(s => s.trim()).filter(Boolean) : []
                            }
                            onSave(payload)
                        }}>Save</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
