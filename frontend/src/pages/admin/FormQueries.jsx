import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { API_BASE } from '../../api'
import { toast } from 'react-toastify'
import { getAuth } from '../../utils/session'
import '../../pages/AdminPanel.css'

export default function FormQueries() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)

    async function load() {
        setLoading(true)
        try {
            const { token } = getAuth() || {}
            const headers = { 'Content-Type': 'application/json' }
            if (token) headers.Authorization = `Bearer ${token}`

            const res = await fetch(`${API_BASE}/api/admin/form-queries`, { headers })
            if (res.status === 401) {
                // unauthorized — redirect to admin login
                toast.error('Unauthorized. Please sign in as admin.')
                window.location.href = '/admin-login'
                return
            }
            if (!res.ok) throw new Error('Failed to load form queries')
            const data = await res.json()
            setItems(data || [])
        } catch (e) {
            console.error(e)
            toast.error(e?.message || 'Failed to load')
            setItems([])
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    return (
        <AdminLayout title="Forms Query">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Forms Query</h2>
                </header>
                <div style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>Submissions from public users for uploaded forms.</div>

                <div className="admin-card">
                    {loading && <div>Loading…</div>}
                    {!loading && items.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>No submissions yet.</div>}

                    {!loading && items.length > 0 && (
                        <div style={{ display: 'grid', gap: 16 }}>
                            {items.map(it => (
                                <div key={it._id} style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: '250px' }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 4 }}>{it.formTitle || it.formId || 'Form'}</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{it.name} · {it.email} · {it.contact}</div>
                                            <div style={{ marginTop: 8, color: 'var(--text-primary)' }}>{it.description}</div>
                                            <div style={{ marginTop: 8, color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{it.createdAt ? new Date(it.createdAt).toLocaleString() : ''}</div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {it.filename && (
                                                <a
                                                    href={`${API_BASE}${it.url ? it.url : `/uploads/${it.filename}`}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="btn-primary"
                                                    style={{ textDecoration: 'none', display: 'inline-block', fontSize: '0.85rem' }}
                                                >
                                                    Download Attachment
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
