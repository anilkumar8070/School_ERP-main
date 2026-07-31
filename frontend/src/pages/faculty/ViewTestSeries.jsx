import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getMyTests, getTestQuestions, createTestQuestions, updateTest, deleteTest } from '../../api'
import { getAuth } from '../../utils/session'

export default function ViewTestSeries() {
    const [tests, setTests] = useState([])
    const [counts, setCounts] = useState({})
    const [q, setQ] = useState('')

    async function load() {
        try {
            const { token, role } = getAuth()
            const data = await getMyTests(token)
            const testsList = data || []
            setTests(testsList)

            // fetch exact question counts per test for admin/faculty
            if (role === 'admin' || role === 'faculty') {
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
        <FacultyLayout title="My Test Series">
            <div style={{ padding: 20 }}>
                <h2 style={{ textAlign: 'center', color: '#1e3a8a', marginTop: 4 }}>My Test Series</h2>

                <div style={{ maxWidth: 1200, margin: '18px auto' }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search test series by title, subject or creator" style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                        <button onClick={() => setQ('')} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#f3f4f6' }}>Clear</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                        {tests.filter(t => {
                            const term = q.trim().toLowerCase()
                            if (!term) return true
                            return (String(t.title || '').toLowerCase().includes(term) || String((t.subject || t.type) || '').toLowerCase().includes(term) || String((t.createdBy && (t.createdBy.name || t.createdBy)) || '').toLowerCase().includes(term))
                        }).map(t => (
                            <div key={t._id} style={{ background: 'linear-gradient(180deg,#f8f1ff,#fff5f8)', borderRadius: 12, padding: 18, boxShadow: '0 8px 24px rgba(2,6,23,0.08)', minHeight: 320 }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{t.title}</div>
                                <div style={{ color: '#374151', marginBottom: 6 }}><strong>Subject:</strong> <span style={{ color: '#6b7280' }}>{t.subject || t.type || '—'}</span></div>
                                <div style={{ color: '#374151', marginBottom: 6 }}><strong>Total Ques:</strong> <span style={{ color: '#6b7280' }}>{(counts && counts[t._id] !== undefined) ? counts[t._id] : (t.totalQuestions != null ? t.totalQuestions : (t.questions ? t.questions.length : 0))}</span></div>
                                <div style={{ color: '#374151', marginBottom: 12 }}><strong>Duration:</strong> <span style={{ color: '#6b7280' }}>{t.durationMinutes ? `${t.durationMinutes} min` : (t.duration ? `${t.duration} min` : '—')}</span></div>
                                <div style={{ color: '#374151', marginBottom: 16 }}><strong>Added By:</strong> <span style={{ color: '#6b7280' }}>{(() => {
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
            </div>

            {/* Reuse the same modals as admin page by inlining minimal view/edit modals similar to admin; for brevity they can be implemented later if needed. */}
        </FacultyLayout>
    )
}
