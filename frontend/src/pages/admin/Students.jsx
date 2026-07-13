import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getStudents, getReceiptsByStudent } from '../../api'
import { deleteStudent } from '../../api'
import { createStudent, updateStudent, blockStudent } from '../../api'
import { getAuth } from '../../utils/session'

export default function Students() {
    const [loading, setLoading] = useState(false)
    const [students, setStudents] = useState([])
    const [filters, setFilters] = useState({ name: '', class: '', section: '', email: '', gender: '', category: '', religion: '', stream: '', medium: '' })
    const [receiptsMap, setReceiptsMap] = useState({}) // studentId -> receipts

    async function load() {
        setLoading(true)
        try {
            const { token } = getAuth()
            const data = await getStudents(filters, token)
            setStudents(data)
        } catch (e) {
            console.error(e)
            setStudents([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // When students change, fetch receipts with throttled concurrency to avoid resource exhaustion
    useEffect(() => {
        async function loadReceipts(list) {
            try {
                const { token } = getAuth()
                const ids = (list || []).map(s => String(s._id))
                const map = {}
                const CONCURRENCY = 5
                for (let i = 0; i < ids.length; i += CONCURRENCY) {
                    const slice = ids.slice(i, i + CONCURRENCY)
                    const batch = await Promise.allSettled(slice.map(id => getReceiptsByStudent(id, token)))
                    batch.forEach((res, j) => {
                        const sid = slice[j]
                        map[sid] = res.status === 'fulfilled' ? (res.value || []) : []
                    })
                }
                setReceiptsMap(map)
            } catch { setReceiptsMap({}) }
        }
        if (students && students.length) loadReceipts(students)
        else setReceiptsMap({})
    }, [students])

    function normalizeTerm(t) { return String(t || '').replace(/\s+/g, '').toLowerCase() }
    function isPaid(studentId, termKey) {
        const recs = receiptsMap[String(studentId)] || []
        return recs.some(r => normalizeTerm(r.term) === termKey)
    }
    function assignedAmount(student, termKey) {
        const arr = Array.isArray(student.assignedFees) ? student.assignedFees : []
        const found = arr.find(f => normalizeTerm(f.term) === termKey)
        return found ? Number(found.amount || 0) : null
    }

    const [showAdd, setShowAdd] = useState(false)
    const [newStudent, setNewStudent] = useState({ name: '', email: '', class: '', password: '', gender: '', category: '', religion: '', stream: '', medium: 'English' })
    const [adding, setAdding] = useState(false)
    const [editing, setEditing] = useState(null)
    const [savingEdit, setSavingEdit] = useState(false)

    async function onAddStudent(e) {
        e && e.preventDefault()
        try {
            const { token } = getAuth()
            if (!newStudent.name || !newStudent.email || !newStudent.class) return alert('Name, email and class are required')
            setAdding(true)
            const payload = { name: newStudent.name, email: newStudent.email, class: newStudent.class, password: newStudent.password, gender: newStudent.gender, category: newStudent.category, religion: newStudent.religion, medium: newStudent.medium }
            if (newStudent.class === '11' || newStudent.class === '12') payload.stream = newStudent.stream || ''
            await createStudent(payload, token)
            setNewStudent({ name: '', email: '', class: '', password: '', gender: '', category: '', religion: '', stream: '', medium: 'English' })
            setShowAdd(false)
            await load()
            alert('Student created (email sent if SMTP configured)')
        } catch (err) {
            console.error(err)
            alert(err && err.message ? err.message : 'Failed to create student')
        } finally {
            setAdding(false)
        }
    }

    function startEdit(s) {
        setEditing({ ...s })
    }

    function cancelEdit() {
        setEditing(null)
    }

    async function saveEdit(e) {
        e && e.preventDefault()
        if (!editing) return
        setSavingEdit(true)
        try {
            const { token } = getAuth()
            const payload = { class: editing.class, section: editing.section, rollNo: editing.rollNo, name: editing.name, gender: editing.gender, category: editing.category, religion: editing.religion, medium: editing.medium }
            if (editing.class === '11' || editing.class === '12') payload.stream = editing.stream || ''
            await updateStudent(editing._id, payload, token)
            setEditing(null)
            await load()
            alert('Student updated')
        } catch (err) {
            console.error(err)
            alert(err && err.message ? err.message : 'Failed to update student')
        } finally {
            setSavingEdit(false)
        }
    }

    async function onToggleBlock(id, block) {
        const action = block ? 'Block' : 'Unblock'
        if (!confirm(`${action} this student account?`)) return
        try {
            const { token } = getAuth()
            await blockStudent(id, block, token)
            await load()
        } catch (e) { console.error(e); alert('Failed to update block status') }
    }

    function onSearch(e) {
        e && e.preventDefault()
        load()
    }

    return (
        <AdminLayout title="Student Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Student Management</h2>
                    <button className="btn-primary" onClick={() => setShowAdd(s => !s)}>{showAdd ? 'Cancel' : 'Add Student'}</button>
                </header>

                <div className="admin-card">
                    <form onSubmit={onSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input className="admin-input" placeholder="Name" value={filters.name} onChange={e => setFilters(f => ({ ...f, name: e.target.value }))} style={{ flex: 1, minWidth: 160 }} />
                        <input className="admin-input" placeholder="Email" value={filters.email} onChange={e => setFilters(f => ({ ...f, email: e.target.value }))} style={{ flex: 1, minWidth: 180 }} />
                        <select className="admin-select" value={filters.class} onChange={e => setFilters(f => ({ ...f, class: e.target.value }))} style={{ width: 'auto', minWidth: 120 }}>
                            <option value="">All classes</option>
                            {Array.from({ length: 12 }).map((_, i) => <option key={i} value={String(i + 1)}>{`Class ${i + 1}`}</option>)}
                        </select>
                        <select className="admin-select" value={filters.section} onChange={e => setFilters(f => ({ ...f, section: e.target.value }))} style={{ width: 'auto', minWidth: 100 }}>
                            <option value="">All sections</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                        </select>

                        <select className="admin-select" value={filters.gender} onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))} style={{ width: 'auto', minWidth: 110 }}>
                            <option value="">All genders</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                        <select className="admin-select" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))} style={{ width: 'auto', minWidth: 140 }}>
                            <option value="">All categories</option>
                            <option value="General">General</option>
                            <option value="OBC">OBC</option>
                            <option value="SC">SC</option>
                            <option value="ST">ST</option>
                            <option value="EWS">EWS</option>
                            <option value="Other">Other</option>
                        </select>
                        <select className="admin-select" value={filters.religion} onChange={e => setFilters(f => ({ ...f, religion: e.target.value }))} style={{ width: 'auto', minWidth: 140 }}>
                            <option value="">All religions</option>
                            <option value="Hindu">Hindu</option>
                            <option value="Muslim">Muslim</option>
                            <option value="Christian">Christian</option>
                            <option value="Sikh">Sikh</option>
                            <option value="Buddhist">Buddhist</option>
                            <option value="Jain">Jain</option>
                            <option value="Other">Other</option>
                        </select>
                        <select className="admin-select" value={filters.stream} onChange={e => setFilters(f => ({ ...f, stream: e.target.value }))} style={{ width: 'auto', minWidth: 160 }}>
                            <option value="">All streams</option>
                            <option value="PCM">PCM</option>
                            <option value="PCB">PCB</option>
                            <option value="Commerce">Commerce</option>
                            <option value="Arts">Arts</option>
                            <option value="Humanities">Humanities</option>
                        </select>

                        <div className="btn-group">
                            <button className="btn-primary" type="submit">Search</button>
                            <button type="button" className="btn-secondary" onClick={() => { setFilters({ name: '', class: '', section: '', email: '', gender: '', category: '', religion: '', stream: '' }); setStudents([]) }}>Reset</button>
                        </div>
                    </form>
                </div>

                {showAdd && (
                    <div className="admin-card">
                        <h3>Add New Student</h3>
                        <form onSubmit={onAddStudent} className="admin-form-grid">
                            <div className="form-group"><label>Name</label><input className="admin-input" value={newStudent.name} onChange={e => setNewStudent(ns => ({ ...ns, name: e.target.value }))} /></div>
                            <div className="form-group"><label>Email</label><input className="admin-input" value={newStudent.email} onChange={e => setNewStudent(ns => ({ ...ns, email: e.target.value }))} /></div>
                            <div className="form-group"><label>Class</label>
                                <select className="admin-select" value={newStudent.class} onChange={e => setNewStudent(ns => ({ ...ns, class: e.target.value }))}>
                                    <option value="">Select class</option>
                                    {Array.from({ length: 12 }).map((_, i) => <option key={i} value={String(i + 1)}>{`Class ${i + 1}`}</option>)}
                                </select></div>
                            <div className="form-group"><label>Medium</label>
                                <select className="admin-select" value={newStudent.medium || ''} onChange={e => setNewStudent(ns => ({ ...ns, medium: e.target.value }))}>
                                    <option value="">Medium</option>
                                    <option value="Hindi">Hindi</option>
                                    <option value="English">English</option>
                                    <option value="Bengali">Bengali</option>
                                    <option value="Tamil">Tamil</option>
                                    <option value="Telugu">Telugu</option>
                                    <option value="Marathi">Marathi</option>
                                    <option value="Gujarati">Gujarati</option>
                                    <option value="Urdu">Urdu</option>
                                    <option value="Kannada">Kannada</option>
                                    <option value="Malayalam">Malayalam</option>
                                </select></div>
                            {(newStudent.class === '11' || newStudent.class === '12') && (
                                <div className="form-group"><label>Stream</label>
                                    <select className="admin-select" value={newStudent.stream || ''} onChange={e => setNewStudent(ns => ({ ...ns, stream: e.target.value }))}>
                                        <option value="">Select stream</option>
                                        <option value="PCM">PCM</option>
                                        <option value="PCB">PCB</option>
                                        <option value="Commerce">Commerce</option>
                                        <option value="Arts">Arts</option>
                                        <option value="Humanities">Humanities</option>
                                    </select></div>
                            )}
                            <div className="form-group"><label>Gender</label>
                                <select className="admin-select" value={newStudent.gender} onChange={e => setNewStudent(ns => ({ ...ns, gender: e.target.value }))}>
                                    <option value="">Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select></div>
                            <div className="form-group"><label>Category</label>
                                <select className="admin-select" value={newStudent.category} onChange={e => setNewStudent(ns => ({ ...ns, category: e.target.value }))}>
                                    <option value="">Category</option>
                                    <option value="General">General</option>
                                    <option value="OBC">OBC</option>
                                    <option value="SC">SC</option>
                                    <option value="ST">ST</option>
                                    <option value="EWS">EWS</option>
                                    <option value="Other">Other</option>
                                </select></div>
                            <div className="form-group"><label>Religion</label>
                                <select className="admin-select" value={newStudent.religion} onChange={e => setNewStudent(ns => ({ ...ns, religion: e.target.value }))}>
                                    <option value="">Religion</option>
                                    <option value="Hindu">Hindu</option>
                                    <option value="Muslim">Muslim</option>
                                    <option value="Christian">Christian</option>
                                    <option value="Sikh">Sikh</option>
                                    <option value="Buddhist">Buddhist</option>
                                    <option value="Jain">Jain</option>
                                    <option value="Other">Other</option>
                                </select></div>
                            <div className="form-group"><label>Password (optional)</label>
                                <input className="admin-input" type="password" value={newStudent.password} onChange={e => setNewStudent(ns => ({ ...ns, password: e.target.value }))} /></div>

                            <div className="btn-group" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end', marginTop: 12 }}>
                                <button type="button" className="btn-secondary" onClick={() => { setShowAdd(false); setNewStudent({ name: '', email: '', class: '', password: '', gender: '', category: '', religion: '', stream: '', medium: '' }) }}>Cancel</button>
                                <button className="btn-primary" disabled={adding} type="submit">{adding ? 'Adding...' : 'Add'}</button>
                            </div>
                        </form>
                    </div>
                )}

                {editing && (
                    <div className="admin-card">
                        <h3>Edit student</h3>
                        <form onSubmit={saveEdit} className="admin-form-grid">
                            <div className="form-group"><label>Name</label><input className="admin-input" value={editing.name || ''} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} /></div>
                            <div className="form-group"><label>Email</label><input className="admin-input" value={editing.email || ''} readOnly /></div>
                            <div className="form-group"><label>Class</label>
                                <select className="admin-select" value={editing.class || ''} onChange={e => setEditing(s => ({ ...s, class: e.target.value }))}>
                                    <option value="">Select</option>
                                    {Array.from({ length: 12 }).map((_, i) => <option key={i} value={String(i + 1)}>{`Class ${i + 1}`}</option>)}
                                </select>
                            </div>
                            {(editing.class === '11' || editing.class === '12') && (
                                <div className="form-group"><label>Stream</label>
                                    <select className="admin-select" value={editing.stream || ''} onChange={e => setEditing(s => ({ ...s, stream: e.target.value }))}>
                                        <option value="">Select</option>
                                        <option value="PCM">PCM</option>
                                        <option value="PCB">PCB</option>
                                        <option value="Commerce">Commerce</option>
                                        <option value="Arts">Arts</option>
                                        <option value="Humanities">Humanities</option>
                                    </select>
                                </div>
                            )}
                            <div className="form-group"><label>Medium</label>
                                <select className="admin-select" value={editing.medium || ''} onChange={e => setEditing(s => ({ ...s, medium: e.target.value }))}>
                                    <option value="">Select</option>
                                    <option value="Hindi">Hindi</option>
                                    <option value="English">English</option>
                                    <option value="Bengali">Bengali</option>
                                    <option value="Tamil">Tamil</option>
                                    <option value="Telugu">Telugu</option>
                                    <option value="Marathi">Marathi</option>
                                    <option value="Gujarati">Gujarati</option>
                                    <option value="Urdu">Urdu</option>
                                    <option value="Kannada">Kannada</option>
                                    <option value="Malayalam">Malayalam</option>
                                </select>
                            </div>
                            <div className="form-group"><label>Section</label>
                                <select className="admin-select" value={editing.section || ''} onChange={e => setEditing(s => ({ ...s, section: e.target.value }))}>
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                </select>
                            </div>
                            <div className="form-group"><label>Roll No</label><input className="admin-input" value={editing.rollNo || ''} onChange={e => setEditing(s => ({ ...s, rollNo: e.target.value }))} /></div>
                            <div className="form-group"><label>Gender</label>
                                <select className="admin-select" value={editing.gender || ''} onChange={e => setEditing(s => ({ ...s, gender: e.target.value }))}>
                                    <option value="">Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="form-group"><label>Category</label>
                                <select className="admin-select" value={editing.category || ''} onChange={e => setEditing(s => ({ ...s, category: e.target.value }))}>
                                    <option value="">Select</option>
                                    <option value="General">General</option>
                                    <option value="OBC">OBC</option>
                                    <option value="SC">SC</option>
                                    <option value="ST">ST</option>
                                    <option value="EWS">EWS</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="form-group"><label>Religion</label>
                                <select className="admin-select" value={editing.religion || ''} onChange={e => setEditing(s => ({ ...s, religion: e.target.value }))}>
                                    <option value="">Select</option>
                                    <option value="Hindu">Hindu</option>
                                    <option value="Muslim">Muslim</option>
                                    <option value="Christian">Christian</option>
                                    <option value="Sikh">Sikh</option>
                                    <option value="Buddhist">Buddhist</option>
                                    <option value="Jain">Jain</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="btn-group" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end', marginTop: 12 }}>
                                <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                                <button className="btn-primary" type="submit" disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="admin-card">
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Profile</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Class</th>
                                    <th>Medium</th>
                                    <th>Stream</th>
                                    <th>Section</th>
                                    <th>Roll No</th>
                                    <th>Gender</th>
                                    <th>Category</th>
                                    <th>Religion</th>
                                    <th>Assigned Fees</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={13} style={{ textAlign: 'center', padding: 20 }}>Loading...</td></tr>
                                ) : students.length === 0 ? (
                                    <tr><td colSpan={13} style={{ textAlign: 'center', padding: 20 }}>No students found</td></tr>
                                ) : students.map((s) => (
                                    <tr key={s._id || s.email}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                {s.avatar ? <img src={s.avatar} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--text-main)' }}>{(s.name || 'S')[0]}</div>}
                                            </div>
                                        </td>
                                        <td>{s.name}</td>
                                        <td>{s.email}</td>
                                        <td>{s.class}</td>
                                        <td>{s.medium || '-'}</td>
                                        <td>{(s.class === 11 || s.class === '11' || s.class === 12 || s.class === '12') ? (s.stream || '-') : 'General'}</td>
                                        <td>{s.section}</td>
                                        <td>{s.rollNo}</td>
                                        <td>{s.gender || '-'}</td>
                                        <td>{s.category || '-'}</td>
                                        <td>{s.religion || '-'}</td>
                                        <td>
                                            {(() => {
                                                const t1Amt = assignedAmount(s, 'term1')
                                                const t2Amt = assignedAmount(s, 'term2')
                                                const t1Paid = isPaid(s._id, 'term1')
                                                const t2Paid = isPaid(s._id, 'term2')
                                                const line = (label, amt, paid) => (
                                                    <div className="small" key={label} style={{ fontSize: '0.85rem' }}><strong>{label}:</strong> {paid ? <span style={{ color: 'var(--success)' }}>Paid</span> : (amt === null ? <span style={{ color: 'var(--text-muted)' }}>—</span> : `₹${amt}`)}</div>
                                                )
                                                return (
                                                    <div>
                                                        {line('Term 1', t1Amt, t1Paid)}
                                                        {line('Term 2', t2Amt, t2Paid)}
                                                    </div>
                                                )
                                            })()}
                                        </td>
                                        <td>
                                            <div className="btn-group">
                                                <button className="btn-secondary" onClick={() => startEdit(s)}>Edit</button>
                                                {s.blocked ? (
                                                    <button className="btn-primary" onClick={() => onToggleBlock(s._id, false)}>Unblock</button>
                                                ) : (
                                                    <button className="btn-secondary" onClick={() => onToggleBlock(s._id, true)}>Block</button>
                                                )}
                                                <button className="btn-danger" onClick={async () => {
                                                    if (!confirm('Delete this student? This will remove the student and their login.')) return
                                                    try {
                                                        const { token } = getAuth()
                                                        await deleteStudent(s._id, token)
                                                        await load()
                                                    } catch (e) { console.error(e); alert('Delete failed') }
                                                }}>Delete</button>
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
