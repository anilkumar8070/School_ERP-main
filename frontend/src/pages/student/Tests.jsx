import React, { useEffect, useState, useRef } from 'react'
import StudentLayout from '../../components/student/StudentLayout'
import { getMyTests, getMyStudent } from '../../api'
import { getAuth } from '../../utils/session'
import { useNavigate } from 'react-router-dom'

function Timer({ seconds, onFinish }) {
    const [s, setS] = useState(seconds)
    const ref = useRef(null)
    useEffect(() => {
        setS(seconds)
        if (ref.current) clearInterval(ref.current)
        if (seconds && seconds > 0) {
            ref.current = setInterval(() => setS(prev => {
                if (prev <= 1) {
                    clearInterval(ref.current)
                    if (onFinish) onFinish()
                    return 0
                }
                return prev - 1
            }), 1000)
        }
        return () => { if (ref.current) clearInterval(ref.current) }
    }, [seconds])
    const mm = Math.floor((s || 0) / 60).toString().padStart(2, '0')
    const ss = Math.floor((s || 0) % 60).toString().padStart(2, '0')
    return <div style={{ fontWeight: 700 }}>{mm}:{ss}</div>
}

export default function StudentTests() {
    const [tests, setTests] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState({ open: false, test: null })
    const [agreed, setAgreed] = useState(false)
    const [candidate, setCandidate] = useState({ name: '', roll: '', email: '' })
    const [running, setRunning] = useState({ testId: null, secondsLeft: 0 })

    const [query, setQuery] = useState('')

    async function load() {
        setLoading(true)
        try {
            const { token } = getAuth()
            const data = await getMyTests(token)
            const items = data || []
            setTests(items)
            // don't fetch per-test questions here to avoid extra protected requests
        } catch (e) {
            console.error('Failed to load tests', e)
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    async function openInstructions(test) {
        // Open modal and attempt to auto-fill candidate details from the student's profile
        setAgreed(true)
        setCandidate({ name: '', roll: '', email: '' })
        setModal({ open: true, test })
        try {
            const { token } = getAuth()
            let stu = null
            try { stu = await getMyStudent(token) } catch (e) { stu = null }
            if (stu) {
                setCandidate({ name: stu.name || '', roll: stu.rollNo || stu.roll || '', email: stu.email || '' })
            }
        } catch (e) {
            // ignore — we'll just leave the fields empty
            console.warn('Failed to auto-fill student details for test enrollment', e)
        }
    }

    const navigate = useNavigate()

    function startTest(test) {
        setModal({ open: false, test: null })
        if (test.type === 'google_form' && test.link) {
            try { window.open(test.link, '_blank') } catch (e) { }
            return
        }
        navigate(`/student/tests/${test._id}/start`, { state: { candidate, test } })
    }

    function handleTimerFinish() {
        setRunning({ testId: null, secondsLeft: 0 })
        alert('Time is up. Please ensure you have submitted your answers in the opened form (if applicable).')
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Available Test Series</h3>
            </header>

            <div className="mb-6 flex gap-4">
                <input
                    className="flex-1 p-3 rounded-xl border border-border bg-card text-main outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Search by name, subject..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
                <button onClick={() => load()} className="btn primary">Refresh</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading && <div className="text-muted col-span-full">Loading tests...</div>}
                {!loading && tests.filter(t => {
                    const q = query.trim().toLowerCase()
                    if (!q) return true
                    return (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
                }).map(t => (
                    <div key={t._id} className="card flex flex-col h-full">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-main mb-2 line-clamp-2">{t.title}</h3>
                            <div className="text-sm text-muted">Subject: {(() => {
                                const subj = t.subject
                                if (!subj) return '—'
                                if (typeof subj === 'string') return subj
                                return subj.name || subj.title || subj.label
                            })()}</div>
                        </div>

                        <div className="flex-1 text-sm space-y-2 mb-4">
                            <div className="flex justify-between border-b border-subtle pb-2">
                                <span className="text-muted">Duration</span>
                                <span className="font-semibold text-main">{t.durationMinutes ? `${t.durationMinutes} min` : '—'}</span>
                            </div>
                            <div className="flex justify-between border-b border-subtle pb-2">
                                <span className="text-muted">Questions</span>
                                <span className="font-semibold text-main">{t.totalQuestions !== undefined ? t.totalQuestions : (t.questions ? t.questions.length : '—')}</span>
                            </div>
                            <div className="flex justify-between border-b border-subtle pb-2">
                                <span className="text-muted">Starts</span>
                                <span className="font-semibold text-main">{t.start ? new Date(t.start).toLocaleDateString() : '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Price</span>
                                <span className="font-bold text-primary">{t.price ? `₹${t.price}` : 'Free'}</span>
                            </div>
                        </div>

                        <button className="btn primary w-full mt-auto" onClick={() => openInstructions(t)}>Enroll Now</button>
                    </div>
                ))}
            </div>

            {modal.open && modal.test && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card w-full max-w-4xl rounded-xl shadow-2xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
                        <div className="bg-surface p-8 md:w-1/3 border-r border-subtle">
                            <h3 className="font-bold text-xl mb-6 text-main">Instructions</h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="font-bold text-main mb-1">1. Maintain decorum</div>
                                    <div className="text-sm text-muted">Please maintain test decorum during the session.</div>
                                </div>
                                <div>
                                    <div className="font-bold text-main mb-1">2. No malicious activity</div>
                                    <div className="text-sm text-muted">Don't attempt to cheat or use unauthorised resources.</div>
                                </div>
                                <div>
                                    <div className="font-bold text-main mb-1">3. Complete all questions</div>
                                    <div className="text-sm text-muted">Try to answer every question before submitting.</div>
                                </div>
                                <div>
                                    <div className="font-bold text-main mb-1">4. Timer</div>
                                    <div className="text-sm text-muted">Test will auto-submit when the timer expires.</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 md:w-2/3 flex flex-col overflow-y-auto">
                            <div className="mb-6">
                                <div className="flex justify-between items-start mb-2">
                                    <h2 className="text-2xl font-bold text-main">{modal.test.title}</h2>
                                    <span className="badge gray">{modal.test.type}</span>
                                </div>
                                <p className="text-muted">{modal.test.description || 'Please confirm your details below.'}</p>
                            </div>

                            <div className="grid gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-muted mb-1">Full Name</label>
                                    <input className="w-full p-2 border border rounded bg-main text-main" value={candidate.name} onChange={e => setCandidate(c => ({ ...c, name: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-muted mb-1">Roll Number</label>
                                        <input className="w-full p-2 border border rounded bg-main text-main" value={candidate.roll} onChange={e => setCandidate(c => ({ ...c, roll: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-muted mb-1">Email</label>
                                        <input className="w-full p-2 border border rounded bg-main text-main" value={candidate.email} onChange={e => setCandidate(c => ({ ...c, email: e.target.value }))} />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-6 border-t border-subtle">
                                <label className="flex items-center gap-3 mb-6 cursor-pointer select-none">
                                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                                    <span className="text-main">I agree to the rules and will not engage in misconduct.</span>
                                </label>

                                <div className="flex gap-4 justify-end">
                                    <button className="btn outline" onClick={() => setModal({ open: false, test: null })}>Cancel</button>
                                    <button className="btn primary" disabled={!agreed || !candidate.name || !candidate.email} onClick={() => startTest(modal.test)}>Start Test</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
