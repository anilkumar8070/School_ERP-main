import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getHR, createHR, deleteHR, blockHR, updateHR } from '../../api'
import { getAuth } from '../../utils/session'
import { toast } from 'react-toastify'

export default function Hr() {
    const { token } = getAuth()
    const [q, setQ] = useState('')
    const [rows, setRows] = useState([])
    const [showAdd, setShowAdd] = useState(false)
    const [loading, setLoading] = useState(false)

    async function load() {
        setLoading(true)
        try {
            const list = await getHR(q, token)
            setRows(Array.isArray(list) ? list : [])
        } catch (e) { toast.error(e.message || 'Failed to load HRs') }
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    async function doDelete(id) { if (!window.confirm('Delete this HR?')) return; try { await deleteHR(id, token); toast.success('Deleted'); load() } catch (e) { toast.error(e.message || 'Delete failed') } }
    async function doBlock(id, block) { try { await blockHR(id, block, token); toast.success(block ? 'Blocked' : 'Unblocked'); load() } catch (e) { toast.error(e.message || 'Update failed') } }

    function Row({ it, idx }) {
        const [local, setLocal] = useState({
            name: it.name || '', email: it.username || '', contact: it.contact || '', qualification: it.designation || '', address: it.address || '', gender: it.gender || '', age: it.age || '', religion: it.religion || '', category: it.category || ''
        })

        const handleSave = async () => {
            try {
                await updateHR(it._id, { name: local.name, contact: local.contact, designation: local.qualification, address: local.address, gender: local.gender, age: local.age, religion: local.religion, category: local.category }, token);
                toast.success('Saved');
                load()
            } catch (e) { toast.error(e.message || 'Save failed') }
        }

        return (
            <tr>
                <td>{idx + 1}</td>
                <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={local.name} onChange={e => setLocal({ ...local, name: e.target.value })} /></td>
                <td>{it.username}</td>
                <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={local.contact} onChange={e => setLocal({ ...local, contact: e.target.value })} /></td>
                <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={local.qualification} onChange={e => setLocal({ ...local, qualification: e.target.value })} /></td>
                <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={local.address} onChange={e => setLocal({ ...local, address: e.target.value })} /></td>
                <td>
                    <select className="admin-select" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={local.gender} onChange={e => setLocal({ ...local, gender: e.target.value })}>
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>
                </td>
                <td><input type="number" className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem', width: 60 }} value={local.age} onChange={e => setLocal({ ...local, age: e.target.value })} /></td>
                <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={local.religion} onChange={e => setLocal({ ...local, religion: e.target.value })} /></td>
                <td><input className="admin-input" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={local.category} onChange={e => setLocal({ ...local, category: e.target.value })} /></td>
                <td>
                    <div className="btn-group">
                        <button className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={handleSave}>Save</button>
                        <button className={`btn-${it.disabled ? 'success' : 'danger'}`} style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => doBlock(it._id, !it.disabled)}>{it.disabled ? 'Unblock' : 'Block'}</button>
                        <button className="btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => doDelete(it._id)}>Delete</button>
                    </div>
                </td>
            </tr>
        )
    }

    function AddForm({ onClose, onCreated }) {
        const [form, setForm] = useState({ name: '', fatherName: '', email: '', contact: '', qualification: '', address: '', gender: '', age: '', religion: '', category: '' })
        const [saving, setSaving] = useState(false)
        function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })) }
        async function submit(e) {
            e.preventDefault()
            if (!form.name || !form.email || !form.contact) { toast.error('Name, email and contact required'); return }
            setSaving(true)
            try {
                const payload = { name: form.name, fatherName: form.fatherName, email: form.email, contact: form.contact, designation: form.qualification, address: form.address, gender: form.gender, age: form.age, religion: form.religion, category: form.category }
                const res = await createHR(payload, token)
                toast.success('HR added')
                if (res && res.username && res.password) {
                    setTimeout(() => { alert(`HR credentials:\nUsername: ${res.username}\nPassword: ${res.password}`) }, 50)
                }
                onCreated && onCreated()
                onClose && onClose()
            } catch (e) { toast.error(e.message || 'Failed to add HR') }
            setSaving(false)
        }
        return (
            <div className="modal-overlay">
                <div className="modal-content" style={{ maxWidth: 700 }}>
                    <div className="modal-header">
                        <h3>Add HR</h3>
                        <button onClick={onClose} className="close-btn">×</button>
                    </div>
                    <form onSubmit={submit}>
                        <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div className="form-group">
                                <label>Name</label>
                                <input required className="admin-input" placeholder="Full name" value={form.name} onChange={e => setField('name', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Father Name</label>
                                <input className="admin-input" placeholder="Father's name" value={form.fatherName} onChange={e => setField('fatherName', e.target.value)} />
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
                                <label>Qualification</label>
                                <input className="admin-input" placeholder="Qualification" value={form.qualification} onChange={e => setField('qualification', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Address</label>
                                <input className="admin-input" placeholder="Address" value={form.address} onChange={e => setField('address', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Gender</label>
                                <select className="admin-select" value={form.gender} onChange={e => setField('gender', e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Age</label>
                                <input type="number" className="admin-input" placeholder="Age" value={form.age} onChange={e => setField('age', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Religion</label>
                                <input className="admin-input" placeholder="Religion" value={form.religion} onChange={e => setField('religion', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <input className="admin-input" placeholder="Category" value={form.category} onChange={e => setField('category', e.target.value)} />
                            </div>
                        </div>
                        <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
                            <button className="btn-secondary" type="button" onClick={onClose}>Cancel</button>
                            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    return (
        <AdminLayout title="HR Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>HR Management</h2>
                    <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add HR</button>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ gridTemplateColumns: 'minmax(200px, 1fr) auto' }}>
                        <input className="admin-input" placeholder="Search HR by name or email" value={q} onChange={e => setQ(e.target.value)} />
                        <button className="btn-primary" onClick={load}>Search</button>
                    </div>
                </div>

                {showAdd && (
                    <AddForm onClose={() => setShowAdd(false)} onCreated={load} />
                )}

                <div className="admin-card">
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Sr No</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Contact</th>
                                    <th>Qualification</th>
                                    <th>Address</th>
                                    <th>Gender</th>
                                    <th>Age</th>
                                    <th>Religion</th>
                                    <th>Category</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && <tr><td colSpan={11} style={{ padding: 20, textAlign: 'center' }}>Loading...</td></tr>}
                                {!loading && rows.length === 0 && <tr><td colSpan={11} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No HR found</td></tr>}
                                {!loading && rows.map((it, idx) => (
                                    <Row key={it._id} it={it} idx={idx} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
