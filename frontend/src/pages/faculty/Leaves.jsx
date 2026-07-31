import React, { useState, useMemo, useEffect } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { postLeave, getMyLeaves, getLeaves, getMyFaculty } from '../../api'
import { getAuth } from '../../utils/session'

export default function Leaves() {
    // Start with no demo data; real applications should come from server
    const [applications, setApplications] = useState([])
    const [query, setQuery] = useState('')

    const [myLeaves, setMyLeaves] = useState([])
    const [form, setForm] = useState({ from: '', to: '', reason: '' })
    const [loading, setLoading] = useState(false)

    // resolve faculty assignments and load student leaves for assigned classes/sections
    const [assigned, setAssigned] = useState(null)
    const [notAssigned, setNotAssigned] = useState(false)

    async function loadMy() {
        try {
            const { token } = getAuth()
            const items = await getMyLeaves(token)
            setMyLeaves(items || [])
        } catch (e) { setMyLeaves([]) }
    }

    async function loadStudentLeaves() {
        try {
            if (notAssigned) { setApplications([]); return }
            if (assigned === null) return
            const { token } = getAuth()
            const results = []
            for (const a of assigned) {
                if (a.isClassTeacher) {
                    const r = await getLeaves({ role: 'student', class: a.class }, token).catch(() => [])
                    results.push(...(r || []))
                } else {
                    for (const s of (a.sections || [])) {
                        const r = await getLeaves({ role: 'student', class: a.class, section: s }, token).catch(() => [])
                        results.push(...(r || []))
                    }
                }
            }
            setApplications(results)
        } catch (e) { console.error('Failed to load student leaves', e); setApplications([]) }
    }

    useEffect(() => {
        let mounted = true
        async function resolve() {
            try {
                const { token } = getAuth()
                const f = await getMyFaculty(token).catch(() => null)
                if (!f || !Array.isArray(f.assignments) || f.assignments.length === 0) {
                    if (mounted) { setNotAssigned(true); setAssigned([]); setApplications([]) }
                    return
                }
                const map = {}
                for (const a of f.assignments || []) {
                    const cls = String(a.class || '')
                    if (!cls) continue
                    if (!map[cls]) map[cls] = { sections: new Set(), isClassTeacher: false }
                    if (a.section) map[cls].sections.add(String(a.section))
                    if (a.isClassTeacher) map[cls].isClassTeacher = true
                }
                const assignedList = Object.keys(map).map(k => ({ class: k, sections: Array.from(map[k].sections), isClassTeacher: !!map[k].isClassTeacher }))
                if (mounted) {
                    setAssigned(assignedList)
                    setNotAssigned(false)
                }
            } catch (e) { console.warn('resolve assignments failed', e); if (mounted) setNotAssigned(true) }
        }
        resolve()
        return () => { mounted = false }
    }, [])

    useEffect(() => { loadMy(); loadStudentLeaves() }, [assigned, notAssigned])

    async function submitLeave(e) {
        e.preventDefault()
        if (!form.from || !form.to || !form.reason) return alert('Please fill all fields')
        try {
            const { token } = getAuth()
            setLoading(true)
            await postLeave(form.from, form.to, form.reason, token)
            setForm({ from: '', to: '', reason: '' })
            await loadMy()
            alert('Leave request submitted')
        } catch (err) { console.error(err); alert('Failed to submit leave') }
        finally { setLoading(false) }
    }

    function action(app, status) {
        const updated = applications.map(a => a.id === app.id ? { ...a, status } : a)
        setApplications(updated)
        alert(`${app.name} marked ${status}`)
    }

    const filtered = useMemo(() => {
        const q = (query || '').trim().toLowerCase()
        if (!q) return applications
        return applications.filter(a => (
            String(a.name).toLowerCase().includes(q) ||
            String(a.class).toLowerCase().includes(q) ||
            String(a.roll).toLowerCase().includes(q) ||
            String(a.reason).toLowerCase().includes(q) ||
            String(a.date).toLowerCase().includes(q)
        ))
    }, [applications, query])

    return (
        <FacultyLayout title="Leaves">
            <div className="faculty-page">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h2 style={{ margin: 0 }}>Student Leave Applications</h2>
                    <div className="leaves-toolbar">
                        <input className="leaves-search" placeholder="Search name, class, roll, reason or date" value={query} onChange={e => setQuery(e.target.value)} />
                    </div>
                </div>

                <div className="card leaves-card" style={{ padding: 12 }}>
                    <div className="table-container">
                        <table className="data-table leaves-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Class</th>
                                    <th>Roll</th>
                                    <th>Reason</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No leave applications found.</td></tr>
                                )}
                                {filtered.map((a, i) => (
                                    <tr key={a._id || a.id || i} className={`leave-row ${a.status === 'Approved' ? 'bg-green-50' : a.status === 'Rejected' ? 'bg-red-50' : ''}`}>
                                        <td>{a.name}</td>
                                        <td>{a.class}</td>
                                        <td>{a.roll}</td>
                                        <td>{a.reason}</td>
                                        <td>{a.date}</td>
                                        <td><strong>{a.status}</strong></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="action-btn" style={{ background: '#10b981', color: '#fff', border: 'none' }} onClick={() => action(a, 'Approved')}>Approve</button>
                                                <button className="action-btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={() => action(a, 'Rejected')}>Reject</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ marginTop: 18 }} className="card" >
                    <h3 style={{ marginTop: 0 }}>Request Leave</h3>
                    <form className="leave-form" onSubmit={submitLeave}>
                        <label>From
                            <input type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} />
                        </label>
                        <label>To
                            <input type="date" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} />
                        </label>
                        <label>Reason
                            <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit'}</button>
                            <button type="button" className="btn-outline" onClick={() => setForm({ from: '', to: '', reason: '' })}>Reset</button>
                        </div>
                    </form>

                    <h3 style={{ marginTop: 18 }}>My Leave Requests</h3>
                    <div className="leaves-list">
                        {myLeaves.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No leaves submitted yet.</div>}
                        {myLeaves.map(l => (
                            <div key={l._id || l.id} className={`leave-item ${l.status === 'Approved' ? 'approved' : ''}`}>
                                <div><strong>{String(l.from).slice(0, 10)}</strong> → <strong>{String(l.to).slice(0, 10)}</strong></div>
                                <div>{l.reason}</div>
                                <div className="status">Status: {l.status}{l.reviewNote ? ` — Note: ${l.reviewNote}` : ''}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </FacultyLayout>
    )
}
