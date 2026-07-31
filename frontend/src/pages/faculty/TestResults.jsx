import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getMyTests, getTestResults, uploadTestResults } from '../../api'
import { getAuth } from '../../utils/session'

export default function FacultyTestResults() {
    const [tests, setTests] = useState([])
    const [selected, setSelected] = useState(null)
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)

    async function loadTests() {
        try {
            const { token } = getAuth()
            const data = await getMyTests(token)
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
            setResults(r || [])
        } catch (e) { console.error(e); setResults([]) }
        finally { setLoading(false) }
    }

    useEffect(() => { loadTests() }, [])
    useEffect(() => { if (selected) loadResults(selected) }, [selected])

    async function handleUpload(e) {
        const f = e.target.files && e.target.files[0]
        if (!f) return
        try {
            const fd = new FormData()
            fd.append('file', f)
            const { token } = getAuth()
            const res = await uploadTestResults(selected, fd, token)
            alert(`Imported ${res.imported} rows`)
            await loadResults(selected)
        } catch (err) { console.error(err); alert(err && err.message ? err.message : 'Upload failed') }
    }

    return (
        <FacultyLayout>
            <div style={{ padding: 20 }}>
                <h2>Test Results (Your tests)</h2>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 320 }}>
                        <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <h4>Select Test</h4>
                            <select value={selected || ''} onChange={e => setSelected(e.target.value)} style={{ width: '100%', padding: 8, background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: 4 }}>
                                <option value="">-- Select --</option>
                                {tests.map(t => <option key={t._id} value={t._id}>{t.title} • {t.type}</option>)}
                            </select>

                            <div style={{ marginTop: 12 }}>
                                <label style={{ fontWeight: 700 }}>Upload CSV results</label>
                                <input type="file" accept=".csv" onChange={handleUpload} />
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <h4>Results</h4>
                            <div style={{ overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid var(--border)', padding: 8 }}>Name</th>
                                            <th style={{ border: '1px solid var(--border)', padding: 8 }}>Email</th>
                                            <th style={{ border: '1px solid var(--border)', padding: 8 }}>Roll</th>
                                            <th style={{ border: '1px solid var(--border)', padding: 8 }}>Class</th>
                                            <th style={{ border: '1px solid var(--border)', padding: 8 }}>Section</th>
                                            <th style={{ border: '1px solid var(--border)', padding: 8 }}>Score</th>
                                            <th style={{ border: '1px solid var(--border)', padding: 8 }}>Total</th>
                                            <th style={{ border: '1px solid var(--border)', padding: 8 }}>Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 12 }}>Loading...</td></tr> : (
                                            results.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 12 }}>No results</td></tr> : (
                                                results.map((r, idx) => (
                                                    <tr key={r._id} style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-surface)' }}>
                                                        <td style={{ border: '1px solid var(--border)', padding: 8 }}>{r.name}</td>
                                                        <td style={{ border: '1px solid var(--border)', padding: 8 }}>{r.email}</td>
                                                        <td style={{ border: '1px solid var(--border)', padding: 8 }}>{r.rollNo}</td>
                                                        <td style={{ border: '1px solid var(--border)', padding: 8 }}>{r.class}</td>
                                                        <td style={{ border: '1px solid var(--border)', padding: 8 }}>{r.section}</td>
                                                        <td style={{ border: '1px solid var(--border)', padding: 8 }}>{r.score != null ? r.score : ''}</td>
                                                        <td style={{ border: '1px solid var(--border)', padding: 8 }}>{r.total != null ? r.total : ''}</td>
                                                        <td style={{ border: '1px solid var(--border)', padding: 8 }}>{r.percentage != null ? r.percentage + '%' : ''}</td>
                                                    </tr>
                                                ))
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </FacultyLayout>
    )
}
