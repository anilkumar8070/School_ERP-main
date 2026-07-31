import React, { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { uploadResource, getResources, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'
import { toast } from 'react-toastify'
import '../../pages/AdminPanel.css'

export default function AdminForm() {
    const [title, setTitle] = useState('')
    const [file, setFile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState([])
    const [error, setError] = useState('')

    async function load() {
        setError('')
        try {
            const { token } = getAuth()
            const list = await getResources({}, token)
            setItems(list || [])
        } catch (e) { setError(e?.message || 'Failed to load') }
    }

    useEffect(() => { load() }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        if (!title) return toast.info('Please provide a title')
        if (!file) return toast.info('Please attach a PDF')
        setLoading(true)
        try {
            const { token } = getAuth()
            const fd = new FormData()
            fd.append('file', file)
            fd.append('title', title)
            // uploadResource expects Authorization header
            await uploadResource(fd, token)
            setTitle('')
            setFile(null)
            await load()
            toast.success('Form uploaded')
        } catch (err) { console.error(err); toast.error(err?.message || 'Upload failed') }
        finally { setLoading(false) }
    }

    return (
        <AdminLayout title="Forms">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Forms & Resources</h2>
                </header>

                <div className="admin-card">
                    <h3 className="section-title">Upload Form (PDF)</h3>
                    <form onSubmit={handleSubmit} className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div>
                            <label>Title</label>
                            <input
                                className="admin-input"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Enter form title"
                            />
                        </div>
                        <div>
                            <label>PDF File</label>
                            <input
                                className="admin-input"
                                type="file"
                                accept="application/pdf"
                                onChange={e => setFile(e.target.files && e.target.files[0])}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                            <button className="btn-primary" disabled={loading}>{loading ? 'Uploading…' : 'Upload Form'}</button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <h3 className="section-title">Available Forms</h3>
                    {error && <div className="error-msg">{error}</div>}
                    {items.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>No forms uploaded yet.</div>}
                    {items.length > 0 && (
                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Uploaded</th>
                                        <th>Download</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(it => (
                                        <tr key={it._id}>
                                            <td>{it.title}</td>
                                            <td>{it.createdAt ? new Date(it.createdAt).toLocaleString() : ''}</td>
                                            <td>
                                                {it.filename ? (
                                                    <a
                                                        href={`${API_BASE}/uploads/${it.filename}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="action-link"
                                                        style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}
                                                    >
                                                        Download
                                                    </a>
                                                ) : '-'}
                                            </td>
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
