import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getTests, getTestResults, uploadTestResults } from '../../api'
import { getAuth } from '../../utils/session'

export default function AdminTestResults() {
    const [tests, setTests] = useState([])
    const [selected, setSelected] = useState(null)
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [view, setView] = useState('cards')

    async function loadTests() {
        try {
            const { token } = getAuth()
            const data = await getTests(token)
            setTests(data || [])
            if ((data || []).length && !selected) setSelected(data[0]._id)
        } catch (e) { console.error(e) }
    }

    async function loadResults(testId) {
        if (!testId) return setResults([])
        setLoading(true)
        try {
            const { token } = getAuth()
            const r = await getTestResults(testId, token)
            // dedupe results that may have been uploaded twice or created as duplicates
            const raw = r || []
            const map = new Map()
            raw.forEach(item => {
                const when = new Date(item.submittedAt || item.createdAt || 0).getTime()
                const who = (item.email || item.rollNo || item.name || '').toString().trim().toLowerCase()
                const key = `${who}-${when}`
                const prev = map.get(key)
                // keep the item with latest timestamp (if duplicates exist) or the first seen
                if (!prev || when > prev.when) map.set(key, { item, when })
            })
            setResults(Array.from(map.values()).map(v => v.item))
        } catch (e) { console.error(e); setResults([]) }
        finally { setLoading(false) }
    }

    useEffect(() => { loadTests() }, [])
    useEffect(() => { if (selected) loadResults(selected) }, [selected])

    async function handleUpload(e) {
        // handle CSV file upload and send to backend
        const file = e?.target?.files && e.target.files[0]
        if (!file) return
        if (!selected) return alert('Please select a test before uploading results')
        const form = new FormData()
        form.append('file', file)
        try {
            setLoading(true)
            const { token } = getAuth()
            await uploadTestResults(selected, form, token)
            await loadResults(selected)
            alert('Upload successful')
        } catch (err) {
            console.error(err)
            alert('Upload failed')
        } finally {
            setLoading(false)
        }
    }

    function formatDateTime(ts) {
        try {
            const d = new Date(ts || Date.now())
            return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
        } catch (e) { return String(ts || '') }
    }

    function formatSubject(subj) {
        if (!subj && subj !== 0) return '—'
        if (typeof subj === 'object') return subj.name || subj.title || subj.label || String(subj._id || JSON.stringify(subj))
        if (typeof subj === 'string' || typeof subj === 'number') {
            const s = String(subj)
            if (s.startsWith('{') || s.startsWith('[')) {
                try { const parsed = JSON.parse(s); return formatSubject(parsed) } catch (e) { }
            }
            return s || '—'
        }
        return String(subj)
    }

    return (
        <AdminLayout title="Test Results">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Test Results</h2>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
                    {/* Changed to 1fr vertical layout or responsive grid if needed. Keeping side-by-side for desktop. */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 3fr', gap: 24, alignItems: 'start' }}>

                        {/* Sidebar / Filter Card */}
                        <div className="admin-card">
                            <h3>Select Test</h3>
                            <div className="form-group">
                                <label>Test Series</label>
                                <select className="admin-select" value={selected || ''} onChange={e => setSelected(e.target.value)}>
                                    <option value="">-- Select --</option>
                                    {tests.map(t => <option key={t._id} value={t._id}>{t.title} • {t.type}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Upload CSV results</label>
                                <input className="admin-file-input" type="file" accept=".csv" onChange={handleUpload} />
                            </div>
                            <div className="btn-group">
                                <button className={`btn-secondary ${view === 'cards' ? 'active' : ''}`} onClick={() => setView('cards')} style={view === 'cards' ? { background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' } : {}}>Cards</button>
                                <button className={`btn-secondary ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')} style={view === 'table' ? { background: 'var(--primary-light)', color: 'var(--primary)', borderColor: 'var(--primary)' } : {}}>Table</button>
                            </div>
                        </div>

                        {/* Results Area */}
                        <div className="admin-card">
                            {view === 'cards' ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
                                    {loading ? (
                                        <div className="info">Loading...</div>
                                    ) : (
                                        (results || []).length === 0 ? (
                                            <div className="empty-state">No results found</div>
                                        ) : (
                                            results.map((r) => {
                                                const answers = (r.raw && Array.isArray(r.raw.answers)) ? r.raw.answers : null
                                                const correctCount = (r.raw && typeof r.raw.correct === 'number') ? r.raw.correct : (answers ? answers.filter(a => a && a.correct).length : 0)
                                                const wrongCount = (r.raw && typeof r.raw.wrong === 'number') ? r.raw.wrong : (answers ? answers.filter(a => a && a.correct === false && (a.given !== '' && a.given != null)).length : 0)
                                                const skippedCount = (r.raw && typeof r.raw.skipped === 'number') ? r.raw.skipped : (answers ? answers.filter(a => a && (a.given === '' || a.given == null)).length : 0)
                                                return (
                                                    <div key={r._id} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success)', padding: 16 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                            <div style={{ fontWeight: 700, color: 'var(--success)' }}>{(selected && (tests.find(t => t._id === selected) || {}).title) || 'Test'}</div>
                                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDateTime(r.submittedAt || r.createdAt || Date.now())}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                                                            <span className="badge badge-success">Subject: {formatSubject((r.raw && r.raw.subject) || r.class)}</span>
                                                            <span className="badge badge-primary">Section: {r.section || '—'}</span>
                                                            <span className="badge badge-warning">Total Marks: {r.total != null ? r.total : '—'}</span>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                                                            <div style={{ color: 'var(--success)', fontWeight: 700 }}>Score: {r.score != null ? r.score : 0}</div>
                                                            <div style={{ color: 'var(--primary)', fontWeight: 700 }}>Percentage: {r.percentage != null ? r.percentage + '%' : '0%'}</div>
                                                        </div>
                                                        <div style={{ marginBottom: 8, color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>Subject-wise Analysis:</div>
                                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                                                            <span className="badge badge-success">Correct: {correctCount}</span>
                                                            <span className="badge badge-error">Wrong: {wrongCount}</span>
                                                            <span className="badge badge-secondary">Skipped: {skippedCount}</span>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                            <div>Name: {r.name || '—'}</div>
                                                            <div>Roll: {r.rollNo || '—'}</div>
                                                            <div style={{ gridColumn: '1 / -1' }}>Email: {r.email || '—'}</div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )
                                    )}
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                {['Name', 'Email', 'Roll', 'Subject', 'Section', 'Score', 'Total', 'Percentage'].map((h, i) => (
                                                    <th key={i}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 12 }}>Loading...</td></tr> : (
                                                results.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 12 }}>No results</td></tr> : (
                                                    results.map((r) => (
                                                        <tr key={r._id}>
                                                            {[r.name, r.email, r.rollNo, formatSubject((r.raw && r.raw.subject) || r.class), r.section, r.score != null ? r.score : '', r.total != null ? r.total : '', r.percentage != null ? r.percentage + '%' : ''].map((val, i) => (
                                                                <td key={i}>{val}</td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
