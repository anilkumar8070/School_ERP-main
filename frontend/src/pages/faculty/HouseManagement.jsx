import React, { useEffect, useMemo, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getStudents, getMyFaculty } from '../../api'
import { getAuth } from '../../utils/session'

const HOUSES = ['Red', 'Green', 'Yellow', 'Blue', 'Purple']
const HOUSE_COLORS = {
    Red: '#ef4444', Green: '#22c55e', Yellow: '#f59e0b', Blue: '#3b82f6', Purple: '#a855f7'
}

export default function HouseManagement() {
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(false)
    const [q, setQ] = useState('')
    const { token } = getAuth()

    const [assigned, setAssigned] = useState(null)
    const [notAssigned, setNotAssigned] = useState(false)

    async function load() {
        setLoading(true)
        try {
            if (notAssigned) { setStudents([]); return }
            if (assigned === null) return
            const houses = Array.isArray(assigned) ? assigned : []
            if (houses.length === 0) { setStudents([]); return }
            // fetch students for those houses only
            const promises = houses.map(h => getStudents({ house: h }, token).catch(() => []))
            const lists = await Promise.all(promises)
            const merged = [].concat(...lists)
            setStudents(merged)
        } catch (e) { console.error('Failed to load students', e); setStudents([]) }
        finally { setLoading(false) }
    }

    useEffect(() => {
        let mounted = true
        async function resolve() {
            try {
                const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
                const f = await getMyFaculty(token).catch(() => null)
                if (!f || !Array.isArray(f.houses) || f.houses.length === 0) { if (mounted) { setNotAssigned(true); setAssigned([]) }; return }
                // map to simple structure with house and role
                // include only houses where faculty is head mentor
                const raw = (f.houses || []).filter(h => h && h.house && String((h.role || '').toString()).toLowerCase() === 'head mentor').map(h => String(h.house))
                // canonicalize to known house names (trim + case-insensitive match)
                const canon = raw.map(r => {
                    const name = String(r || '').trim()
                    const match = HOUSES.find(hn => hn.toLowerCase() === name.toLowerCase())
                    return match || name
                }).filter(Boolean)
                if (mounted) { setAssigned(canon); setNotAssigned(false) }
            } catch (e) { console.warn('resolve houses failed', e); if (mounted) setNotAssigned(true) }
        }
        resolve()
        return () => { mounted = false }
    }, [])

    useEffect(() => { load() }, [assigned, notAssigned])

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase()
        if (!term) return students
        return students.filter(s => (
            (s.name || '').toLowerCase().includes(term) ||
            (s.rollNo || '').toLowerCase().includes(term) ||
            (s.class || '').toLowerCase().includes(term) ||
            (s.section || '').toLowerCase().includes(term) ||
            (s.house || '').toLowerCase().includes(term)
        ))
    }, [students, q])

    const byHouse = useMemo(() => {
        const map = new Map()
        HOUSES.forEach(h => map.set(h, []))
        filtered.forEach(st => {
            const h = st.house && HOUSES.includes(st.house) ? st.house : 'Unassigned'
            if (!map.has(h)) map.set(h, [])
            map.get(h).push(st)
        })
        return map
    }, [filtered])

    return (
        <FacultyLayout title="House Management">
            <div className="faculty-page">
                <h2>House Lists</h2>

                <div className="faculty-filters">
                    <input className="search-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, roll, class, section or house..." />
                    <button className="btn-primary" onClick={load}>Refresh</button>
                </div>

                {[...byHouse.entries()].map(([house, list]) => {
                    const color = HOUSE_COLORS[house] || '#64748b'
                    return (
                        <div key={house} className="faculty-form-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden', borderLeft: `4px solid ${color}` }}>
                            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
                                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>{house}</h3>
                                <span className="status-badge" style={{ background: color, color: '#fff' }}>{list.length} students</span>
                            </div>

                            <div className="table-container" style={{ borderRadius: 0, border: 'none' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Name</th>
                                            <th>Roll No</th>
                                            <th>Class</th>
                                            <th>Section</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {list.length === 0 && (
                                            <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No students in this house.</td></tr>
                                        )}
                                        {list.map((st, idx) => (
                                            <tr key={st._id}>
                                                <td>{idx + 1}</td>
                                                <td>{st.name}</td>
                                                <td>{st.rollNo || '—'}</td>
                                                <td>{st.class || '—'}</td>
                                                <td>{st.section || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                })}
            </div>
        </FacultyLayout>
    )
}
