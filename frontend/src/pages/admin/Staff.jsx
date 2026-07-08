import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getStaff, createStaff, deleteStaff, blockStaff, updateStaff, getProfile } from '../../api'
import { getAuth } from '../../utils/session'
import { toast } from 'react-toastify'

function AddStaffForm({ onClose, onCreated }) {
    const { token } = getAuth()
    const [form, setForm] = useState({ name: '', fatherName: '', email: '', contact: '', designation: '', department: '' })
    const [saving, setSaving] = useState(false)
    function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

    async function submit(e) {
        e.preventDefault()
        if (!form.name || !form.email || !form.contact || !form.designation) { toast.error('All details are required'); return }
        setSaving(true)
        try {
            const payload = { ...form, address: form.department }
            const res = await createStaff(payload, token)
            toast.success('Staff added')
            if (res && res.username && res.password) {
                setTimeout(() => {
                    alert(`Staff credentials:\nUsername: ${res.username}\nPassword: ${res.password}`)
                }, 50)
            }
            onCreated && onCreated()
            onClose && onClose()
        } catch (e) { toast.error(e.message || 'Failed to add staff') }
        setSaving(false)
    }
    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 500 }}>
                <div className="modal-header">
                    <h3>Add Staff</h3>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>
                <form onSubmit={submit}>
                    <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="form-group">
                            <label>Name of Staff</label>
                            <input required className="admin-input" placeholder="Full name" value={form.name} onChange={e => setField('name', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Father Name</label>
                            <input required className="admin-input" placeholder="Father's name" value={form.fatherName} onChange={e => setField('fatherName', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input required type="email" className="admin-input" placeholder="Email" value={form.email} onChange={e => setField('email', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Contact</label>
                            <input required className="admin-input" placeholder="Contact number" value={form.contact} onChange={e => setField('contact', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Designation</label>
                            <input required className="admin-input" placeholder="Designation" value={form.designation} onChange={e => setField('designation', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Department</label>
                            <input required className="admin-input" placeholder="Department" value={form.department} onChange={e => setField('department', e.target.value)} />
                        </div>
                        <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                            <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
                            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

function formatStaffId(mongoId) {
    if (!mongoId) return ''
    const tail = String(mongoId).slice(-6).toUpperCase()
    return `STF-${tail}`
}

function StaffRow({ it, idx, onEdit, onDelete, onBlock }) {
    const [edit, setEdit] = useState({ name: it.name || '', fatherName: it.fatherName || '', designation: it.designation || '', contact: it.contact || '', department: it.address || '' })

    const handleSave = () => {
        onEdit(it._id, { name: edit.name, fatherName: edit.fatherName, contact: edit.contact, designation: edit.designation, address: edit.department })
    }

    return (
        <tr>
            <td>{idx + 1}</td>
            <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></td>
            <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={edit.fatherName} onChange={e => setEdit({ ...edit, fatherName: e.target.value })} /></td>
            <td>{it.username}</td>
            <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={edit.contact} onChange={e => setEdit({ ...edit, contact: e.target.value })} /></td>
            <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={edit.designation} onChange={e => setEdit({ ...edit, designation: e.target.value })} /></td>
            <td><span className="status-badge status-warning">{formatStaffId(it._id)}</span></td>
            <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={edit.department} onChange={e => setEdit({ ...edit, department: e.target.value })} /></td>
            <td>
                <div className="btn-group">
                    <button className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={handleSave}>Save</button>
                    <button className={`btn-${it.disabled ? 'success' : 'danger'}`} style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => onBlock(it._id, !it.disabled)}>{it.disabled ? 'Unblock' : 'Block'}</button>
                    <button className="btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => onDelete(it._id)}>Delete</button>
                </div>
            </td>
        </tr>
    )
}

export default function AdminStaff() {
    const { token } = getAuth()
    const [q, setQ] = useState('')
    const [rows, setRows] = useState([])
    const [showAdd, setShowAdd] = useState(false)
    const [loading, setLoading] = useState(false)

    async function load() {
        setLoading(true)
        try {
            const prof = await getProfile(token)
            const mainId = prof && prof.user && prof.user.sub ? String(prof.user.sub) : ''
            const list = await getStaff(q, token)
            const filtered = Array.isArray(list) ? list.filter(it => String(it._id) !== mainId) : []
            setRows(filtered)
        } catch (e) { toast.error(e.message || 'Failed to load staff') }
        setLoading(false)
    }
    useEffect(() => { load() }, [])

    async function doDelete(id) { if (!window.confirm('Delete this staff?')) return; try { await deleteStaff(id, token); toast.success('Deleted'); load() } catch (e) { toast.error(e.message || 'Delete failed') } }
    async function doBlock(id, block) { try { await blockStaff(id, block, token); toast.success(block ? 'Blocked' : 'Unblocked'); load() } catch (e) { toast.error(e.message || 'Update failed') } }
    async function doEdit(id, patch) { try { await updateStaff(id, patch, token); toast.success('Updated'); load() } catch (e) { toast.error(e.message || 'Update failed') } }

    return (
        <AdminLayout title="Staff Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Staff Management</h2>
                    <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Staff</button>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr auto' }}>
                        <input className="admin-input" placeholder="Search staff by name or email" value={q} onChange={e => setQ(e.target.value)} />
                        <button className="btn-primary" onClick={load}>Search</button>
                    </div>
                </div>

                {showAdd && (
                    <AddStaffForm onClose={() => setShowAdd(false)} onCreated={load} />
                )}

                <div className="admin-card">
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Sr No</th>
                                    <th>Name</th>
                                    <th>Father Name</th>
                                    <th>Email</th>
                                    <th>Contact</th>
                                    <th>Designation</th>
                                    <th>Staff ID</th>
                                    <th>Department</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center' }}>Loading...</td></tr>}
                                {!loading && rows.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No staff found</td></tr>}
                                {!loading && rows.map((it, idx) => (
                                    <StaffRow
                                        key={it._id}
                                        it={it}
                                        idx={idx}
                                        onEdit={doEdit}
                                        onDelete={doDelete}
                                        onBlock={doBlock}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
