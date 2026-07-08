import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getAdmins, createAdmin, deleteAdmin, blockAdmin, updateAdmin, getProfile } from '../../api'
import { getAuth } from '../../utils/session'
import { toast } from 'react-toastify'

export default function Admins() {
    const [loading, setLoading] = useState(false)
    const [admins, setAdmins] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showAdd, setShowAdd] = useState(false)
    const [adding, setAdding] = useState(false)
    const [newAdmin, setNewAdmin] = useState({ name: '', email: '', contact: '', address: '', designation: '' })
    const [currentAdminId, setCurrentAdminId] = useState(null)
    const [editingAdmin, setEditingAdmin] = useState(null)
    const [savingEdit, setSavingEdit] = useState(false)

    async function load(q = '') {
        setLoading(true)
        try {
            const { token } = getAuth()
            const profile = await getProfile(token).catch(() => null)
            if (profile && profile.user && profile.user.sub) setCurrentAdminId(profile.user.sub)
            const data = await getAdmins(q, token)
            setAdmins(data)
        } catch (e) { console.error(e); setAdmins([]) } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    function openAdd() { setNewAdmin({ name: '', email: '', contact: '', address: '', designation: '' }); setShowAdd(true) }
    function closeAdd() { setShowAdd(false) }

    async function saveNewAdmin(e) {
        e && e.preventDefault()
        try {
            setAdding(true)
            const { token } = getAuth()
            await createAdmin(newAdmin, token)
            await load()
            closeAdd()
            alert('Admin created and notified (if SMTP configured).')
        } catch (err) { console.error(err); alert('Failed to create admin: ' + (err && err.message || String(err))) }
        setAdding(false)
    }

    async function onDelete(id) {
        if (!confirm('Delete this admin? This action cannot be undone.')) return
        try {
            const { token } = getAuth()
            await deleteAdmin(id, token)
            await load()
        } catch (e) { console.error(e); alert('Delete failed') }
    }

    async function onToggleBlock(id, block) {
        const action = block ? 'Block' : 'Unblock'
        if (!confirm(`${action} this admin account?`)) return
        try {
            const { token } = getAuth()
            await blockAdmin(id, block, token)
            await load()
        } catch (e) { console.error(e); alert('Failed to update block status') }
    }

    function startEdit(admin) {
        const isMain = String(admin._id) === String(currentAdminId)
        setEditingAdmin({ id: admin._id, name: admin.name || '', contact: admin.contact || '', designation: admin.designation || '', isMain })
    }

    function cancelEdit() { setEditingAdmin(null) }

    async function saveEdit(e) {
        e && e.preventDefault()
        if (!editingAdmin) return
        try {
            setSavingEdit(true)
            const { token } = getAuth()
            const payload = editingAdmin.isMain ? { contact: editingAdmin.contact, designation: editingAdmin.designation } : { contact: editingAdmin.contact, designation: editingAdmin.designation, name: editingAdmin.name }
            await updateAdmin(editingAdmin.id, payload, token)
            await load()
            setEditingAdmin(null)
        } catch (err) { console.error(err); alert('Failed to save changes') }
        setSavingEdit(false)
    }

    return (
        <AdminLayout title="Admin Settings">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Admin Settings</h2>
                    <button className="btn-primary" onClick={openAdd}>+ Add Admin</button>
                </header>

                <div className="admin-card">
                    <form onSubmit={(e) => { e && e.preventDefault(); load(searchTerm) }} className="admin-form-grid" style={{ gridTemplateColumns: '1fr auto' }}>
                        <input
                            className="admin-input"
                            placeholder="Search by name, email or designation"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <div className="btn-group">
                            <button className="btn-primary" type="submit">Search</button>
                            <button type="button" className="btn-secondary" onClick={() => { setSearchTerm(''); load('') }}>Reset</button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Contact</th>
                                    <th>Designation</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center' }}>Loading...</td></tr> : admins.length === 0 ? <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No admins found</td></tr> : admins.map(a => (
                                    <tr key={a._id || a.username}>
                                        <td>
                                            {String(a._id) === String(currentAdminId) && <span className="status-badge status-info" style={{ marginRight: 6 }}>You</span>}
                                            {a.name}
                                        </td>
                                        <td>{a.username}</td>
                                        <td>{a.contact || '-'}</td>
                                        <td>{a.designation || '-'}</td>
                                        <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-'}</td>
                                        <td>
                                            <div className="btn-group">
                                                {String(a._id) === String(currentAdminId) ? (
                                                    <button className="btn-secondary" onClick={() => startEdit(a)}>Edit</button>
                                                ) : (
                                                    <>
                                                        <button className="btn-secondary" onClick={() => startEdit(a)}>Edit</button>
                                                        {a.disabled ? <button className="btn-primary" onClick={() => onToggleBlock(a._id, false)}>Unblock</button> : <button className="btn-danger" onClick={() => onToggleBlock(a._id, true)}>Block</button>}
                                                        <button className="btn-danger" onClick={() => onDelete(a._id)}>Delete</button>
                                                    </>
                                                )}
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
                                <h3>Add Admin</h3>
                                <button onClick={closeAdd} className="close-btn">×</button>
                            </div>
                            <form onSubmit={saveNewAdmin}>
                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Name</label>
                                        <input className="admin-input" placeholder="Full name" required value={newAdmin.name} onChange={e => setNewAdmin(s => ({ ...s, name: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input className="admin-input" placeholder="email@example.com" required type="email" value={newAdmin.email} onChange={e => setNewAdmin(s => ({ ...s, email: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Contact</label>
                                        <input className="admin-input" placeholder="Phone" required value={newAdmin.contact} onChange={e => setNewAdmin(s => ({ ...s, contact: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Address</label>
                                        <input className="admin-input" placeholder="Address" required value={newAdmin.address} onChange={e => setNewAdmin(s => ({ ...s, address: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Designation</label>
                                        <input className="admin-input" placeholder="e.g. Principal" required value={newAdmin.designation} onChange={e => setNewAdmin(s => ({ ...s, designation: e.target.value }))} />
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

                {editingAdmin && (
                    <div className="modal-overlay">
                        <div className="modal-content" style={{ maxWidth: 500 }}>
                            <div className="modal-header">
                                <h3>Edit Admin</h3>
                                <button onClick={cancelEdit} className="close-btn">×</button>
                            </div>
                            <form onSubmit={saveEdit}>
                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
                                    {!editingAdmin.isMain && (
                                        <div className="form-group">
                                            <label>Name</label>
                                            <input className="admin-input" placeholder="Full name" required value={editingAdmin.name} onChange={e => setEditingAdmin(s => ({ ...s, name: e.target.value }))} />
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label>Contact</label>
                                        <input className="admin-input" placeholder="Phone" required value={editingAdmin.contact} onChange={e => setEditingAdmin(s => ({ ...s, contact: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Designation</label>
                                        <input className="admin-input" placeholder="e.g. Principal" required value={editingAdmin.designation} onChange={e => setEditingAdmin(s => ({ ...s, designation: e.target.value }))} />
                                    </div>
                                    <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                                        <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                                        <button className="btn-primary" type="submit" disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save'}</button>
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
