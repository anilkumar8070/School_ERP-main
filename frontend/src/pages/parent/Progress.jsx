import React, { useEffect, useMemo, useState } from 'react'
import ParentLayout from '../../components/parent/ParentLayout'
import { getAuth } from '../../utils/session'
import { getMyMarks, getTestResultsByStudent } from '../../api'

export default function ParentProgress() {
    const [linked, setLinked] = useState(null)
    const [marks, setMarks] = useState([])
    const [loading, setLoading] = useState(false)
    const [testResults, setTestResults] = useState([])
    const [loadingTests, setLoadingTests] = useState(false)

    useEffect(() => {
        try {
            const v = localStorage.getItem('parent_linked_student')
            if (v) setLinked(JSON.parse(v))
        } catch (e) { }
    }, [])

    useEffect(() => {
        async function load() {
            if (!linked) return
            setLoading(true)
            try {
                const { token } = getAuth()
                const items = await getMyMarks(token, linked.id)
                setMarks(items)
            } catch (e) { /* ignore */ } finally { setLoading(false) }
        }
        load()
    }, [linked])

    useEffect(() => {
        async function loadTests() {
            if (!linked) return
            setLoadingTests(true)
            try {
                const { token } = getAuth()
                const items = await getTestResultsByStudent(linked.id, token)
                setTestResults(items || [])
            } catch (e) { setTestResults([]) } finally { setLoadingTests(false) }
        }
        loadTests()
    }, [linked])

    const displayedResults = useMemo(() => {
        const list = testResults || []
        // Deduplicate by test title and keep the latest
        const map = new Map()
        list.forEach(r => {
            const title = ((r.raw && r.raw.testTitle) || r.test || '').toString().trim().toLowerCase()
            const key = title || (r.testId || r._id || '')
            const ts = new Date(r.submittedAt || r.createdAt || 0).getTime()
            const prev = map.get(key)
            if (!prev || ts > prev.ts) map.set(key, { r, ts })
        })
        return Array.from(map.values()).map(v => v.r)
    }, [testResults])

    return (
        <ParentLayout>
            <div className="parent-page">
                <h2>Student Progress</h2>
                {!linked && (
                    <div style={{ marginTop: 12, padding: 14, border: '1px solid #334155', borderRadius: 10, background: '#0f172a' }}>
                        <div style={{ color: '#e2e8f0' }}>No student linked. Link a student using the access code.</div>
                        <a href="/parent/link-student" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/parent/link-student'); window.dispatchEvent(new PopStateEvent('popstate')) }} className="btn-primary" style={{ marginTop: 10, display: 'inline-block' }}>Link Student</a>
                    </div>
                )}
                {linked && (
                    <div className="mt-3">
                        <div className="text-subtle mb-2">Showing marks for: <strong className="text-normal">{linked.name}</strong> (Class {linked.class}{linked.section ? `-${linked.section}` : ''})</div>
                        {loading ? <div>Loading...</div> : (
                            <div className="grid gap-2">
                                {marks.length === 0 && <div className="text-subtle">No marks available.</div>}
                                {marks.map((m, i) => (
                                    <div key={i} className="marks-card">
                                        <div className="flex justify-between items-center">
                                            <div className="text-strong">{m.subject}</div>
                                            <div className="text-strong">{m.obtained} / {m.total || 100}</div>
                                        </div>
                                        <div className="text-subtle mt-2">Term: {m.term || '-'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-5">
                            <div className="text-subtle mb-2">Test Series Results</div>
                            {loadingTests ? <div>Loading...</div> : (
                                <div className="responsive-grid">
                                    {displayedResults.length === 0 && <div className="text-subtle col-span-full">No test results yet.</div>}
                                    {displayedResults.map(r => {
                                        const answers = (r.raw && Array.isArray(r.raw.answers)) ? r.raw.answers : null
                                        const correctCount = (r.raw && typeof r.raw.correct === 'number') ? r.raw.correct : (answers ? answers.filter(a => a && a.correct).length : 0)
                                        const wrongCount = (r.raw && typeof r.raw.wrong === 'number') ? r.raw.wrong : (answers ? answers.filter(a => a && a.correct === false && (a.given !== '' && a.given != null)).length : 0)
                                        const skippedCount = (r.raw && typeof r.raw.skipped === 'number') ? r.raw.skipped : (answers ? answers.filter(a => a && (a.given === '' || a.given == null)).length : 0)
                                        return (
                                            <div key={r._id} className="test-result-card">
                                                <div className="flex justify-between items-center">
                                                    <div className="text-strong text-base">{(r.raw && r.raw.testTitle) || r.test || 'Test'}</div>
                                                    <div className="text-subtle text-xs">{new Date(r.submittedAt || r.createdAt || Date.now()).toLocaleString()}</div>
                                                </div>
                                                <div className="flex gap-2 mt-3 flex-wrap">
                                                    <span className="test-badge">Subject: {r.class || (r.raw && r.raw.subject) || '—'}</span>
                                                    {r.raw && r.raw.duration ? <span className="test-badge">Duration: {r.raw.duration}</span> : null}
                                                    <span className="test-badge">Total Marks: {r.total != null ? r.total : '—'}</span>
                                                </div>
                                                <div className="mt-3 grid grid-cols-2 gap-2">
                                                    <div className="font-bold text-green-500">Score: {r.score != null ? r.score : 0}</div>
                                                    <div className="font-bold text-blue-400">Percentage: {r.percentage != null ? r.percentage + '%' : '0%'}</div>
                                                </div>
                                                <div className="mt-3 text-subtle font-bold">Summary</div>
                                                <div className="mt-2 flex gap-2 flex-wrap">
                                                    <span className="summary-badge badge-correct">Correct: {correctCount}</span>
                                                    <span className="summary-badge badge-wrong">Wrong: {wrongCount}</span>
                                                    <span className="summary-badge badge-skipped">Skipped: {skippedCount}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </ParentLayout>
    )
}
