import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { API_BASE } from '../../api'
import { getAuth } from '../../utils/session'

export default function AnalyticsStudentRank() {
    const [cls, setCls] = useState('')
    const [section, setSection] = useState('')
    const [source, setSource] = useState('testResults')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)

    async function load() {
        setLoading(true)
        try {
            const { token } = getAuth() || {}
            const params = new URLSearchParams()
            if (cls) params.append('class', cls)
            if (section) params.append('section', section)
            // force test-results only on server side
            params.append('source', 'testResults')
            if (from) params.append('from', from)
            if (to) params.append('to', to)
            params.append('limit', '1000')

            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`

            const res = await fetch(`${API_BASE}/api/admin/analytics/student-rank?${params.toString()}`, { headers })
            if (!res.ok) throw new Error('Failed to load rankings')
            const data = await res.json()
            setRows(data || [])
        } catch (e) {
            console.error(e)
            setRows([])
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    function exportCSV() {
        if (!rows || rows.length === 0) return
        const headers = ['Rank', 'Name', 'Email', 'RollNo', 'Class', 'Section', 'AvgScore', 'Count']
        const csv = [headers.join(',')].concat(rows.map(r => [r.rank, `"${(r.name || '').replace(/"/g, '""')}"`, `"${(r.email || '').replace(/"/g, '""')}"`, `"${(r.rollNumber || '').replace(/"/g, '""')}"`, r.class, r.section, r.avg, r.count].join(','))).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'student_rankings.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <AdminLayout title="Analytics — Student Rank">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Analytics — Student Rank</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Filter by class and section — rankings are computed from Test Results only.</p>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end', marginBottom: 20 }}>
                        <div className="form-group">
                            <label>Class</label>
                            <input className="admin-input" placeholder="e.g. 10" value={cls} onChange={e => setCls(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Section</label>
                            <input className="admin-input" placeholder="e.g. A" value={section} onChange={e => setSection(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>From Date</label>
                            <input className="admin-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>To Date</label>
                            <input className="admin-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-primary" onClick={load}>Apply</button>
                            <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
                        </div>
                    </div>

                    {loading && <div className="info">Loading…</div>}

                    {!loading && rows && rows.length === 0 && <div className="empty-state">No data for selected filters.</div>}

                    {!loading && rows && rows.length > 0 && (
                        <div className="table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Roll No</th>
                                        <th>Class</th>
                                        <th>Section</th>
                                        <th>Avg Score</th>
                                        <th>Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => (
                                        <tr key={r.key}>
                                            <td>{r.rank}</td>
                                            <td>{r.name}</td>
                                            <td>{r.email}</td>
                                            <td>{r.rollNumber}</td>
                                            <td>{r.class}</td>
                                            <td>{r.section}</td>
                                            <td>{r.avg}</td>
                                            <td>{r.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
