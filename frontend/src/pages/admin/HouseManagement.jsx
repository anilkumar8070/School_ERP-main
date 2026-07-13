import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getStudents, changeStudentHouse, bulkChangeStudentHouse, setStudentHouseRole } from '../../api'
import { getAuth } from '../../utils/session'

const HOUSES = ['Red', 'Green', 'Yellow', 'Blue', 'Purple']

export default function HouseManagement() {
    const { token } = getAuth()
    const [q, setQ] = useState('')
    const [houseFilter, setHouseFilter] = useState('')
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function load() {
        setLoading(true); setError('')
        try {
            const query = {}
            if (q) query.name = q
            if (houseFilter) query.house = houseFilter
            const list = await getStudents(query, token)
            setRows(Array.isArray(list) ? list : [])
        } catch (e) { setError(e.message || 'Failed to load students') }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    async function assignHouse(id, house) {
        try {
            await changeStudentHouse(id, house, token)
            setRows(prev => prev.map(r => r._id === id ? { ...r, house } : r))
        } catch (e) { setError(e.message || 'Failed to assign house') }
    }

    async function autoAssign() {
        const unassigned = rows.filter(st => !st.house)
        const n = unassigned.length
        if (n === 0) return
        const colors = [...HOUSES]
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const tmp = colors[i]; colors[i] = colors[j]; colors[j] = tmp
        }
        const students = [...unassigned]
        for (let i = students.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const tmp = students[i]; students[i] = students[j]; students[j] = tmp
        }
        const updates = students.map((st, idx) => ({ id: st._id, house: colors[idx % colors.length] }))
        setLoading(true); setError('')
        try {
            await bulkChangeStudentHouse(updates, token)
            await load()
        } catch (e) {
            setError(e.message || 'Auto-assign failed')
        }
        setLoading(false)
    }

    async function makeRole(id, role) {
        try {
            await setStudentHouseRole(id, role, token)
            setRows(prev => prev.map(r => r._id === id ? { ...r, houseRole: role } : r))
        } catch (e) { setError(e.message || 'Failed to set role') }
    }

    const filtered = useMemo(() => rows, [rows])

    return (
        <AdminLayout title="House Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>House Management</h2>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ gridTemplateColumns: 'minmax(200px, 1fr) minmax(150px, 200px) auto auto' }}>
                        <input className="admin-input" placeholder="Search by name" value={q} onChange={e => setQ(e.target.value)} />
                        <select className="admin-select" value={houseFilter} onChange={e => setHouseFilter(e.target.value)}>
                            <option value="">All Houses</option>
                            {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <button className="btn-primary" onClick={load}>Search</button>
                        <button className="btn-secondary" onClick={autoAssign}>Auto Assign</button>
                    </div>
                    {error && <div className="error-msg" style={{ marginTop: 10, color: 'var(--error)' }}>{error}</div>}
                </div>

                <div className="admin-card">
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Sr No</th>
                                    <th>Name</th>
                                    <th>Class</th>
                                    <th>Section</th>
                                    <th>House</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center' }}>Loading...</td></tr>}
                                {!loading && filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No students found</td></tr>}
                                {!loading && filtered.map((st, idx) => (
                                    <tr key={st._id}>
                                        <td>{idx + 1}</td>
                                        <td>{st.name}</td>
                                        <td>{st.class || '-'}</td>
                                        <td>{st.section || '-'}</td>
                                        <td>
                                            <select className="admin-select" value={st.house || ''} onChange={e => assignHouse(st._id, e.target.value)} style={{ padding: '4px 8px', fontSize: '0.9rem' }}>
                                                <option value="">Unassigned</option>
                                                {HOUSES.map(h => <option key={h} value={h}>{h}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <span className="small text-muted">{st.houseRole ? `Role: ${st.houseRole}` : ''}</span>
                                                <div className="btn-group">
                                                    <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 8px' }} onClick={() => makeRole(st._id, 'Captain')}>Make Captain</button>
                                                    <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 8px' }} onClick={() => makeRole(st._id, 'Leader')}>Make Leader</button>
                                                    <button className="btn-danger" style={{ fontSize: '0.8rem', padding: '4px 8px' }} onClick={() => makeRole(st._id, '')}>Clear</button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
