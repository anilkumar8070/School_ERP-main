import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getParents, deleteParent, blockParent, createParent, uploadFile } from '../../api'
import { getAuth } from '../../utils/session'

export default function Parents() {
    const [loading, setLoading] = useState(false)
    const [parents, setParents] = useState([])
    const [searchTerm, setSearchTerm] = useState('')

    async function load(q = '') {
        setLoading(true)
        try {
            const { token } = getAuth()
            const data = await getParents(q, token)
            setParents(data)
        } catch (e) {
            console.error(e)
            setParents([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    function onSearch(e) { e && e.preventDefault(); load(searchTerm && searchTerm.trim()) }

    async function onDelete(id) {
        if (!confirm('Delete this parent? This action cannot be undone.')) return
        try {
            const { token } = getAuth()
            await deleteParent(id, token)
            await load()
        } catch (e) { console.error(e); alert('Delete failed') }
    }

    async function onToggleBlock(id, block) {
        const action = block ? 'Block' : 'Unblock'
        if (!confirm(`${action} this parent account?`)) return
        try {
            const { token } = getAuth()
            await blockParent(id, block, token)
            await load()
        } catch (e) { console.error(e); alert('Failed to update block status') }
    }

    // Add parent modal state
    const [showAdd, setShowAdd] = useState(false)
    const [adding, setAdding] = useState(false)
    const [newParent, setNewParent] = useState({ name: '', email: '', contact: '', address: '', parentOf: '', avatar: '', password: '' })
    const [selectedParent, setSelectedParent] = useState(null)

    function openAdd() {
        setNewParent({ name: '', email: '', contact: '', address: '', parentOf: '', avatar: '', password: '' })
        setShowAdd(true)
    }
    function closeAdd() { setShowAdd(false) }

    function openDetails(p) { setSelectedParent(p) }
    function closeDetails() { setSelectedParent(null) }

    async function uploadAvatar(file) {
        if (!file) return ''
        try {
            const { token } = getAuth()
            const fd = new FormData()
            fd.append('file', file)
            const res = await uploadFile(fd, token)
            return res.url
        } catch (e) {
            console.error(e)
            alert('Upload failed')
            return ''
        }
    }

    async function saveNewParent(e) {
        e && e.preventDefault()
        try {
            if (!newParent.name || !newParent.email || !newParent.password || !newParent.parentOf) {
                alert('Please fill required fields (name, email, password, Parent of)')
                return
            }
            setAdding(true)
            let avatarUrl = newParent.avatar || ''
            if (avatarUrl instanceof File) {
                avatarUrl = await uploadAvatar(avatarUrl)
            }
            const payload = {
                name: newParent.name,
                email: newParent.email,
                contact: newParent.contact,
                address: newParent.address,
                parentOf: newParent.parentOf ? [newParent.parentOf] : [],
                avatar: avatarUrl,
                password: newParent.password
            }
            const { token } = getAuth()
            await createParent(payload, token)
            await load()
            closeAdd()
            alert('Parent created')
        } catch (err) {
            console.error(err)
            alert('Failed to create parent: ' + (err && err.message ? err.message : String(err)))
        } finally { setAdding(false) }
    }

    return (
        <AdminLayout title="Parents Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Parents Management</h2>
                    <button className="btn-primary" onClick={openAdd}>+ Add Parent</button>
                </header>

                <div className="admin-card">
                    <form onSubmit={onSearch} className="admin-form-grid" style={{ gridTemplateColumns: 'minmax(200px, 1fr) auto' }}>
                        <input
                            className="admin-input"
                            placeholder="Search by name, email or contact"
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
                                    <th>Profile</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Contact</th>
                                    <th>Parent Of</th>
                                    <th>Address</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center' }}>Loading...</td></tr>
                                ) : parents.length === 0 ? (
                                    <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No parents found</td></tr>
                                ) : parents.map((p) => (
                                    <tr key={p._id || p.username}>
                                        <td>
                                            {p.avatar ? (
                                                <img src={p.avatar} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, border: '1px solid var(--border)' }}>{(p.name || 'P')[0]}</div>
                                            )}
                                        </td>
                                        <td>{p.name}</td>
                                        <td>{p.username}</td>
                                        <td>{p.contact || '-'}</td>
                                        <td>{Array.isArray(p.parentOf) ? (p.parentOf.join(', ') || '-') : (p.parentOf || '-')}</td>
                                        <td>{p.address || '-'}</td>
                                        <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}</td>
                                        <td>
                                            <div className="btn-group">
                                                <button type="button" className="btn-secondary" onClick={() => openDetails(p)}>Details</button>
                                                {p.disabled ? (
                                                    <button className="btn-primary" onClick={() => onToggleBlock(p._id, false)}>Unblock</button>
                                                ) : (
                                                    <button className="btn-danger" onClick={() => onToggleBlock(p._id, true)}>Block</button>
                                                )}
                                                <button className="btn-danger" onClick={() => onDelete(p._id)}>Delete</button>
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
                                <h3>Add Parent</h3>
                                <button onClick={closeAdd} className="close-btn">×</button>
                            </div>
                            <form onSubmit={saveNewParent}>
                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                                    <div className="form-group">
                                        <label>Name</label>
                                        <input className="admin-input" placeholder="Full name" required value={newParent.name} onChange={e => setNewParent(s => ({ ...s, name: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input className="admin-input" placeholder="email@example.com" required type="email" value={newParent.email} onChange={e => setNewParent(s => ({ ...s, email: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Password</label>
                                        <input className="admin-input" placeholder="Password" required type="password" value={newParent.password} onChange={e => setNewParent(s => ({ ...s, password: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Contact</label>
                                        <input className="admin-input" placeholder="Phone" value={newParent.contact} onChange={e => setNewParent(s => ({ ...s, contact: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Address</label>
                                        <input className="admin-input" placeholder="Address" value={newParent.address} onChange={e => setNewParent(s => ({ ...s, address: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Parent of (student name or id)</label>
                                        <input className="admin-input" placeholder="e.g. Student 5-A1 or student id" required value={newParent.parentOf} onChange={e => setNewParent(s => ({ ...s, parentOf: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Profile Image</label>
                                        <input type="file" accept="image/*" className="admin-input" style={{ padding: 8 }} onChange={e => setNewParent(s => ({ ...s, avatar: e.target.files && e.target.files[0] }))} />
                                    </div>

                                    <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                                        <button type="button" className="btn-secondary" onClick={closeAdd}>Cancel</button>
                                        <button className="btn-primary" type="submit" disabled={adding}>{adding ? 'Adding...' : 'Save'}</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {selectedParent && (
                    <div className="modal-overlay">
                        <div className="modal-content" style={{ maxWidth: 500 }}>
                            <div className="modal-header">
                                <h3>Parent Details</h3>
                                <button onClick={closeDetails} className="close-btn">×</button>
                            </div>
                            <div style={{ marginTop: 16 }}>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                                    {selectedParent.avatar ? (
                                        <img src={selectedParent.avatar} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 24, border: '1px solid var(--border)' }}>{(selectedParent.name || 'P')[0]}</div>
                                    )}
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedParent.name}</div>
                                        <div style={{ color: 'var(--text-muted)' }}>{selectedParent.username}</div>
                                    </div>
                                </div>

                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                                        <span style={{ fontWeight: 600 }}>Contact:</span>
                                        <span>{selectedParent.contact || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                                        <span style={{ fontWeight: 600 }}>Parent Of:</span>
                                        <span>{Array.isArray(selectedParent.parentOf) ? (selectedParent.parentOf.join(', ') || '-') : (selectedParent.parentOf || '-')}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                                        <span style={{ fontWeight: 600 }}>Address:</span>
                                        <span>{selectedParent.address || '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                                        <span style={{ fontWeight: 600 }}>Created:</span>
                                        <span>{selectedParent.createdAt ? new Date(selectedParent.createdAt).toLocaleString() : '-'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                                        <span style={{ fontWeight: 600 }}>Status:</span>
                                        <span className={`status-badge ${selectedParent.disabled ? 'status-danger' : 'status-success'}`}>{selectedParent.disabled ? 'Blocked' : 'Active'}</span>
                                    </div>
                                </div>

                                <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
                                    <button className="btn-secondary" onClick={closeDetails}>Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
