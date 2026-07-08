import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getFaculty, updateFaculty, deleteFaculty, submitFacultyRegistration, approveFacultyRegistration, blockFaculty } from '../../api'
import { getAuth } from '../../utils/session'

export default function Faculty() {
    const [loading, setLoading] = useState(false)
    const [faculty, setFaculty] = useState([])
    const [filters, setFilters] = useState({ name: '', email: '', employeeId: '', subject: '' })
    const [searchTerm, setSearchTerm] = useState('')
    const [editing, setEditing] = useState(null)
    const [saving, setSaving] = useState(false)
    const [showAdd, setShowAdd] = useState(false)
    const [adding, setAdding] = useState(false)
    const [newFaculty, setNewFaculty] = useState({ name: '', email: '', subject: '', subjectOther: '', contact: '', experience: '', education: '', classGrade: '' })
    const [isManualSubject, setIsManualSubject] = useState(false)

    async function load() {
        setLoading(true)
        try {
            const { token } = getAuth()
            const data = await getFaculty(filters, token)
            setFaculty(data)
        } catch (e) {
            console.error(e)
            setFaculty([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    // override onSearch to use single searchTerm across name/email/employeeId
    function onSearch(e) {
        e && e.preventDefault()
        // populate filters so backend will search across these fields
        const q = (searchTerm || '').trim()
        setFilters({ name: q, email: q, employeeId: q, subject: '' })
            // call load after state update; load reads current filters, but to be safe call getFaculty directly
            ; (async () => {
                setLoading(true)
                try {
                    const { token } = getAuth()
                    const data = await getFaculty({ name: q, email: q, employeeId: q }, token)
                    setFaculty(data)
                } catch (err) {
                    console.error(err)
                    setFaculty([])
                } finally {
                    setLoading(false)
                }
            })()
    }

    async function onDelete(id) {
        if (!confirm('Delete this faculty? This action cannot be undone.')) return
        try {
            const { token } = getAuth()
            await deleteFaculty(id, token)
            await load()
        } catch (e) { console.error(e); alert('Delete failed') }
    }

    function startEdit(f) { setEditing({ ...f }) }
    function cancelEdit() { setEditing(null) }

    function openAdd() { setNewFaculty({ name: '', email: '', subject: '', subjectOther: '', contact: '', experience: '', education: '', classGrade: '' }); setIsManualSubject(false); setShowAdd(true) }
    function closeAdd() { setShowAdd(false) }

    async function saveNewFaculty(e) {
        e && e.preventDefault()
        try {
            setAdding(true)
            // build payload: if subject is Other, send subjectOther instead
            const subjectValue = isManualSubject ? (newFaculty.subjectOther || '') : newFaculty.subject
            const payload = {
                name: newFaculty.name,
                email: newFaculty.email,
                subject: subjectValue,
                education: newFaculty.education,
                contact: newFaculty.contact,
                avatar: newFaculty.avatar,
                experience: newFaculty.experience,
                classGrade: newFaculty.classGrade
            }

            // submit a registration then approve it immediately (admin user) so an account is created and email sent
            const reg = await submitFacultyRegistration(payload)
            const { token } = getAuth()
            if (token && reg && reg._id) {
                await approveFacultyRegistration(reg._id, token)
            }
            await load()
            closeAdd()
            alert('Faculty added and notified (if SMTP configured).')
        } catch (err) {
            console.error(err)
            alert('Failed to add faculty: ' + (err && err.message ? err.message : String(err)))
        }
        setAdding(false)
    }

    async function saveEdit(e) {
        e && e.preventDefault()
        if (!editing) return
        setSaving(true)
        try {
            const { token } = getAuth()
            await updateFaculty(editing._id, editing, token)
            setEditing(null)
            await load()
        } catch (err) { console.error(err); alert('Save failed') }
        setSaving(false)
    }

    async function onToggleBlock(id, block) {
        const action = block ? 'Block' : 'Unblock'
        if (!confirm(`${action} this faculty account?`)) return
        try {
            const { token } = getAuth()
            await blockFaculty(id, block, token)
            await load()
        } catch (e) { console.error(e); alert('Failed to update block status') }
    }

    return (
        <AdminLayout title="Faculty Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Faculty Management</h2>
                    <button className="btn-primary" onClick={openAdd}>+ Add Faculty</button>
                </header>

                <div className="admin-card">
                    <form onSubmit={onSearch} className="admin-form-grid" style={{ gridTemplateColumns: 'minmax(200px, 1fr) auto', alignItems: 'center', marginBottom: 20 }}>
                        <input
                            className="admin-input"
                            placeholder="Search by name, email or employee ID"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <div className="btn-group">
                            <button className="btn-primary" type="submit">Search</button>
                            <button type="button" className="btn-secondary" onClick={() => { setSearchTerm(''); setFilters({ name: '', email: '', employeeId: '', subject: '' }); setFaculty([]) }}>Reset</button>
                        </div>
                    </form>
                </div>

                {editing && (
                    <div className="admin-card" style={{ marginBottom: 20 }}>
                        <h3>Edit Faculty</h3>
                        <form onSubmit={saveEdit}>
                            <div className="admin-form-grid">
                                <div className="form-group">
                                    <label>Name</label>
                                    <input className="admin-input" value={editing.name || ''} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input className="admin-input" value={editing.email || ''} onChange={e => setEditing(s => ({ ...s, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Contact</label>
                                    <input className="admin-input" value={editing.contact || ''} onChange={e => setEditing(s => ({ ...s, contact: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Subject</label>
                                    <input className="admin-input" value={editing.subject || ''} onChange={e => setEditing(s => ({ ...s, subject: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Role</label>
                                    <select className="admin-select" value={editing.role || 'Asst. Teacher'} onChange={e => setEditing(s => ({ ...s, role: e.target.value }))}>
                                        <option>Asst. Teacher</option>
                                        <option>Associate Teacher</option>
                                        <option>Professor</option>
                                        <option>Teacher</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Experience</label>
                                    <input className="admin-input" value={editing.experience || ''} onChange={e => setEditing(s => ({ ...s, experience: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Employee ID</label>
                                    <input className="admin-input" value={editing.employeeId || ''} onChange={e => setEditing(s => ({ ...s, employeeId: e.target.value }))} />
                                </div>
                            </div>

                            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <h4 style={{ marginTop: 0 }}>Assignments</h4>
                                {(editing.assignments || []).map((a, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                                        <input className="admin-input" placeholder="Class" value={a.class || ''} onChange={e => setEditing(s => { const next = { ...s }; next.assignments[idx].class = e.target.value; return next })} />
                                        <input className="admin-input" placeholder="Section" value={a.section || ''} onChange={e => setEditing(s => { const next = { ...s }; next.assignments[idx].section = e.target.value; return next })} />
                                        <input className="admin-input" placeholder="Subjects" value={(a.subjects || []).join(', ')} onChange={e => setEditing(s => { const next = { ...s }; next.assignments[idx].subjects = e.target.value.split(',').map(x => x.trim()).filter(Boolean); return next })} />
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9em' }}>
                                            <input type="checkbox" checked={!!a.isClassTeacher} onChange={e => setEditing(s => { const next = { ...s }; next.assignments[idx].isClassTeacher = e.target.checked; return next })} />
                                            Class Teacher
                                        </label>
                                        <button type="button" className="btn-danger" onClick={() => setEditing(s => { const next = { ...s }; next.assignments = (next.assignments || []).filter((_, i) => i !== idx); return next })}>Remove</button>
                                    </div>
                                ))}
                                <button type="button" className="btn-secondary" onClick={() => setEditing(s => ({ ...s, assignments: [...(s.assignments || []), { class: '', section: '', subjects: [], isClassTeacher: false }] }))}>+ Add assignment</button>
                            </div>

                            <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <h4 style={{ marginTop: 0 }}>House Assignments</h4>
                                {(editing.houses || []).map((h, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input className="admin-input" placeholder="House name" value={h.house || ''} onChange={e => setEditing(s => { const next = { ...s }; next.houses[idx].house = e.target.value; return next })} style={{ minWidth: 200 }} />
                                        <select className="admin-select" value={h.role || 'member'} onChange={e => setEditing(s => { const next = { ...s }; next.houses[idx].role = e.target.value; return next })} style={{ minWidth: 150 }}>
                                            <option value="member">member</option>
                                            <option value="mentor">mentor</option>
                                            <option value="head mentor">head mentor</option>
                                        </select>
                                        <button type="button" className="btn-danger" onClick={() => setEditing(s => { const next = { ...s }; next.houses = (next.houses || []).filter((_, i) => i !== idx); return next })}>Remove</button>
                                    </div>
                                ))}
                                <button type="button" className="btn-secondary" onClick={() => setEditing(s => ({ ...s, houses: [...(s.houses || []), { house: '', role: 'member' }] }))}>+ Add house assignment</button>
                            </div>

                            <div className="btn-group" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                                <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
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
                                    <th>Contact</th>
                                    <th>Specialization</th>
                                    <th>Assignments</th>
                                    <th>Promotion</th>
                                    <th>Experience</th>
                                    <th>Role</th>
                                    <th>Houses</th>
                                    <th>Emp ID</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={12} style={{ padding: 20, textAlign: 'center' }}>Loading...</td></tr>
                                ) : faculty.length === 0 ? (
                                    <tr><td colSpan={12} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No faculty found</td></tr>
                                ) : faculty.map((f) => (
                                    <tr key={f._id || f.employeeId}>
                                        <td>
                                            {f.avatar ? <img src={f.avatar} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--text-main)', border: '1px solid var(--border)' }}>{(f.name || 'F')[0]}</div>}
                                        </td>
                                        <td>{f.name}</td>
                                        <td>{f.email}</td>
                                        <td>{f.contact}</td>
                                        <td>{f.subject}</td>
                                        <td>
                                            {(f.assignments || []).map((a, idx) => (
                                                <div key={idx} style={{ fontSize: '0.85em', whiteSpace: 'nowrap' }}>{a.class || ''}{a.section ? (' / ' + a.section) : ''} {a.subjects && a.subjects.length ? ` — ${a.subjects.join(', ')}` : ''}{a.isClassTeacher ? ' (Class Teacher)' : ''}</div>
                                            ))}
                                        </td>
                                        <td>{(f.assignments || []).filter(a => a.isClassTeacher).map(a => `${a.class || ''}${a.section ? ' / ' + a.section : ''}`).join(', ') || '-'}</td>
                                        <td>{f.experience}</td>
                                        <td>{f.role || '-'}</td>
                                        <td>{(f.houses || []).map(h => `${h.house || ''}${h.role ? ' (' + h.role + ')' : ''}`).join(', ') || '-'}</td>
                                        <td>{f.employeeId}</td>
                                        <td>
                                            <div className="btn-group">
                                                <button className="btn-secondary" onClick={() => startEdit(f)}>Edit</button>
                                                {f.blocked ? (
                                                    <button className="btn-primary" onClick={() => onToggleBlock(f._id, false)}>Unblock</button>
                                                ) : (
                                                    <button className="btn-danger" onClick={() => onToggleBlock(f._id, true)}>Block</button>
                                                )}
                                                <button className="btn-danger" onClick={() => onDelete(f._id)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {showAdd && (
                    <div className="modal-overlay">
                        <div className="modal-content" style={{ maxWidth: 500 }}>
                            <div className="modal-header">
                                <h3>Add Faculty</h3>
                                <button onClick={closeAdd} className="close-btn">×</button>
                            </div>
                            <form onSubmit={saveNewFaculty}>
                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                                    <div className="form-group">
                                        <label>Name</label>
                                        <input className="admin-input" placeholder="Full name" required value={newFaculty.name} onChange={e => setNewFaculty(s => ({ ...s, name: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input className="admin-input" placeholder="email@example.com" required type="email" value={newFaculty.email} onChange={e => setNewFaculty(s => ({ ...s, email: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Subject</label>
                                        {isManualSubject ? (
                                            <div>
                                                <input className="admin-input" placeholder="Write subject manually" required value={newFaculty.subjectOther} onChange={e => setNewFaculty(s => ({ ...s, subjectOther: e.target.value }))} />
                                                <div style={{ marginTop: 6 }}><button type="button" className="btn-secondary" onClick={() => { setIsManualSubject(false); setNewFaculty(s => ({ ...s, subjectOther: '' })) }}>Use dropdown</button></div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <select className="admin-select" required value={newFaculty.subject} onChange={e => setNewFaculty(s => ({ ...s, subject: e.target.value }))}>
                                                    <option value="">Select subject</option>
                                                    <option value="General (1-12)">General (1-12)</option>
                                                    <option value="Mathematics">Mathematics</option>
                                                    <option value="Science">Science</option>
                                                    <option value="English">English</option>
                                                    <option value="Computer">Computer</option>
                                                    <option value="History">History</option>
                                                </select>
                                                <button type="button" className="btn-secondary" onClick={() => { setIsManualSubject(true); setNewFaculty(s => ({ ...s, subjectOther: '' })) }}>Manual</button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Contact</label>
                                        <input className="admin-input" placeholder="Phone or WhatsApp" required value={newFaculty.contact} onChange={e => setNewFaculty(s => ({ ...s, contact: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Experience</label>
                                        <input className="admin-input" placeholder="e.g. 5 years" required value={newFaculty.experience} onChange={e => setNewFaculty(s => ({ ...s, experience: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Education</label>
                                        <input className="admin-input" placeholder="Highest qualification" required value={newFaculty.education} onChange={e => setNewFaculty(s => ({ ...s, education: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Class (1 to 12)</label>
                                        <input className="admin-input" placeholder="e.g. 6" required type="number" min="1" max="12" value={newFaculty.classGrade} onChange={e => setNewFaculty(s => ({ ...s, classGrade: e.target.value }))} />
                                    </div>

                                    <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                                        <button type="button" className="btn-secondary" onClick={closeAdd}>Cancel</button>
                                        <button className="btn-primary" type="submit" disabled={adding}>{adding ? 'Adding...' : 'Save & Notify'}</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
