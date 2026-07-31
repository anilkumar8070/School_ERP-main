import React, { useEffect, useState, useMemo } from 'react'
import StudentLayout from '../../components/student/StudentLayout'
import { getMyMarks, getMyTestResults } from '../../api'

export default function Results() {
    const [marks, setMarks] = useState([])
    const [loading, setLoading] = useState(true)
    const [testResults, setTestResults] = useState([])
    const [loadingTests, setLoadingTests] = useState(true)
    const [view, setView] = useState('cards')
    const [query, setQuery] = useState('')
    const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')

    useEffect(() => { load(); loadTestResults() }, [])

    async function load() {
        setLoading(true)
        try {
            if (!token) throw new Error('Not authenticated')
            const data = await getMyMarks(token)
            setMarks(data || [])
        } catch (e) { console.warn('Failed to load marks', e); setMarks([]) }
        finally { setLoading(false) }
    }

    async function loadTestResults() {
        setLoadingTests(true)
        try {
            if (!token) throw new Error('Not authenticated')
            const data = await getMyTestResults(token)
            setTestResults(data || [])
        } catch (e) { console.warn('Failed to load test results', e); setTestResults([]) }
        finally { setLoadingTests(false) }
    }

    // helper: format date/time with seconds and AM/PM
    function formatDateTime(ts) {
        try {
            const d = new Date(ts || Date.now())
            return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
        } catch (e) { return String(ts || '') }
    }

    // helper: human-friendly subject display (prefer raw.subject over class)
    function formatSubject(subj) {
        if (!subj && subj !== 0) return '—'
        // if subject is provided as part of the raw payload and is an object
        if (typeof subj === 'object') return subj.name || subj.title || subj.label || String(subj._id || JSON.stringify(subj))
        // if subject is a string/number
        if (typeof subj === 'string' || typeof subj === 'number') {
            const s = String(subj)
            // try to parse JSON-like string
            if (s.startsWith('{') || s.startsWith('[')) {
                try { const parsed = JSON.parse(s); return formatSubject(parsed) } catch (e) { }
            }
            return s || '—'
        }
        return String(subj)
    }

    // prepare displayed results: filter by query and deduplicate by test title (keep latest submission)
    const displayedResults = useMemo(() => {
        const filtered = (testResults || []).filter(r => {
            if (!query) return true
            const q = query.toLowerCase()
            const title = (r.raw && r.raw.testTitle) || r.test || ''
            const subj = (r.raw && r.raw.subject) || r.class || ''
            const dur = (r.raw && r.raw.duration) || ''
            const dt = r.submittedAt || r.createdAt || ''
            return (title + ' ' + subj + ' ' + dur + ' ' + dt).toString().toLowerCase().includes(q)
        })

        // dedupe by title (lowercased); keep the most recent by submittedAt/createdAt
        const map = new Map()
        filtered.forEach(r => {
            const title = ((r.raw && r.raw.testTitle) || r.test || '').toString().trim().toLowerCase()
            const key = title || (r.testId || r._id || '')
            const ts = new Date(r.submittedAt || r.createdAt || 0).getTime()
            const prev = map.get(key)
            if (!prev || ts > prev.ts) map.set(key, { r, ts })
        })
        return Array.from(map.values()).map(v => v.r)
    }, [testResults, query])

    const roundScore = (num) => {
        if (num == null) return 0
        const n = parseFloat(num)
        if (isNaN(n)) return 0
        return Math.round(n * 100) / 100 // 2 decimal places
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Test Results</h3>
            </header>

            <div className="mb-6 flex gap-4">
                <div className="flex-1 card p-3 flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                        <path d="M21 21l-4.35-4.35" />
                        <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
                    </svg>
                    <input
                        className="bg-transparent border-none outline-none flex-1 text-main"
                        placeholder="Search by series name, subject, duration..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {loadingTests ? (
                    <div className="text-muted">Loading...</div>
                ) : (
                    displayedResults.map((r) => {
                        const answers = (r.raw && Array.isArray(r.raw.answers)) ? r.raw.answers : null
                        const correctCount = (r.raw && typeof r.raw.correct === 'number') ? r.raw.correct : (answers ? answers.filter(a => a && a.correct).length : 0)
                        const wrongCount = (r.raw && typeof r.raw.wrong === 'number') ? r.raw.wrong : (answers ? answers.filter(a => a && a.correct === false && (a.given !== '' && a.given != null)).length : 0)

                        return (
                            <div key={r._id} className="card p-6 relative overflow-hidden">
                                {/* Top Section: Title & Date (left), Student Info (right) */}
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="font-bold text-lg text-main truncate m-0 pr-2">{(r.raw && r.raw.testTitle) || r.test || 'Test'}</h4>
                                            {/* "Mark as Read" Badge positioned cleanly */}
                                            <span className="bg-purple-500/10 text-purple-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-purple-500/20 whitespace-nowrap">
                                                Mark
                                            </span>
                                        </div>
                                        <div className="text-sm text-muted">{formatDateTime(r.submittedAt || r.createdAt || Date.now())}</div>

                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <span className="badge blue text-xs px-2 py-1">Subject: {formatSubject((r.raw && r.raw.subject) || r.class)}</span>
                                            {r.raw && r.raw.duration ? <span className="badge gray text-xs px-2 py-1">Duration: {r.raw.duration}</span> : null}
                                        </div>
                                    </div>

                                    <div className="text-xs text-muted flex flex-col items-end text-right min-w-fit pt-1">
                                        <div className="font-medium text-main mb-0.5">Name: {r.name || 'Student'}</div>
                                        <div className="mb-0.5">Roll: {r.rollNo || '-'}</div>
                                        <div>Email: {r.email || '-'}</div>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-surface rounded-xl border border-subtle">
                                    <div className="text-center p-2">
                                        <div className="text-2xl font-bold text-primary truncate" title={r.score}>{roundScore(r.score)}</div>
                                        <div className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">Score</div>
                                    </div>
                                    <div className="text-center p-2 border-l border-subtle">
                                        <div className="text-2xl font-bold text-main truncate">{r.percentage != null ? roundScore(r.percentage) + '%' : '0%'}</div>
                                        <div className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">Percentage</div>
                                    </div>
                                    <div className="text-center p-2 border-l border-subtle">
                                        <div className="text-2xl font-bold text-green-500 truncate">{correctCount}</div>
                                        <div className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">Correct</div>
                                    </div>
                                    <div className="text-center p-2 border-l border-subtle">
                                        <div className="text-2xl font-bold text-red-500 truncate">{wrongCount}</div>
                                        <div className="text-xs text-muted uppercase tracking-wider font-semibold mt-1">Wrong</div>
                                    </div>
                                </div>

                                <div className="absolute top-0 right-0 p-2 opacity-50 pointer-events-none">
                                    <svg className="w-24 h-24 text-surface fill-current -mr-6 -mt-6 opacity-20 transform rotate-12" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path></svg>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
