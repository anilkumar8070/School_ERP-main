import React, { useRef, useState } from 'react'
import './Start.css'
import { API_BASE, getForms, submitFormQuery } from '../api'
import { toast } from 'react-toastify'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function Forms() {
    const [error, setError] = useState('')
    const [showDialog, setShowDialog] = useState(false)
    const [selectedForm, setSelectedForm] = useState(null)
    const [formData, setFormData] = useState({ name: '', email: '', contact: '', description: '', file: null })
    const [submitting, setSubmitting] = useState(false)
    const fileRef = useRef()
    const qc = useQueryClient()

    const { data: items = [], isLoading: loading } = useQuery({ queryKey: ['forms'], queryFn: getForms })

    const mutation = useMutation({
        mutationFn: (fd) => submitFormQuery(fd),
        onSuccess: () => {
            toast.success('Form submitted — admin will review it')
            closeDialog()
            qc.invalidateQueries(['forms'])
        },
        onError: (err) => toast.error(err?.message || 'Submission failed')
    })

    function openSubmission(form) {
        setSelectedForm(form)
        setFormData({ name: '', email: '', contact: '', description: '', file: null })
        if (fileRef && fileRef.current) fileRef.current.value = null
        setShowDialog(true)
    }

    function closeDialog() {
        setShowDialog(false)
        setSelectedForm(null)
    }

    function submitForm(e) {
        try {
            e.preventDefault()
            if (!selectedForm) return
            setSubmitting(true)
            const fd = new FormData()
            fd.append('formId', selectedForm._id)
            fd.append('formTitle', selectedForm.title || '')
            fd.append('name', formData.name || '')
            fd.append('email', formData.email || '')
            fd.append('contact', formData.contact || '')
            fd.append('description', formData.description || '')
            if (formData.file) fd.append('attachment', formData.file)

            mutation.mutate(fd)
        } catch (err) {
            console.error(err)
            toast.error(err?.message || 'Submission failed')
        } finally { setSubmitting(false) }
    }

    // data loaded by useQuery above

    return (
        <div className="start-root" style={{ paddingTop: 36, paddingBottom: 36 }}>
            <main className="start-main" style={{ paddingTop: 24, paddingBottom: 24 }}>
                <div style={{ maxWidth: 980, width: '100%', margin: '0 auto' }}>
                    <h2 style={{ marginTop: 0 }}>Forms</h2>
                    <div style={{ color: '#6b7280', marginBottom: 12 }}>Downloadable forms uploaded by the administration.</div>

                    {error && <div className="error">{error}</div>}
                    {loading && <div>Loading…</div>}

                    {!loading && (!items || items.length === 0) && <div>No forms available.</div>}

                    {!loading && items && items.length > 0 && (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {items.map(it => (
                                <div key={it._id} style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(135deg, #fff7f5, #f0f9ff)', boxShadow: '0 8px 20px rgba(16,24,40,0.06)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 800, color: '#0b1220' }}>{it.title}</div>
                                            <div style={{ color: '#374151', fontSize: 13 }}>{it.createdAt ? new Date(it.createdAt).toLocaleString() : ''}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                                            <a
                                                href={`${API_BASE}/uploads/${it.filename}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="panel-btn"
                                                style={{
                                                    padding: '8px 14px',
                                                    background: '#eef2ff',
                                                    color: '#0b1220',
                                                    borderRadius: 10,
                                                    textDecoration: 'none',
                                                    fontWeight: 700,
                                                    border: '1px solid #3b82f6',
                                                    display: 'inline-block'
                                                }}
                                            >
                                                Download
                                            </a>

                                            <button
                                                type="button"
                                                className="panel-btn"
                                                style={{
                                                    padding: '8px 14px',
                                                    background: '#3b82f6',
                                                    color: '#000',
                                                    borderRadius: 10,
                                                    textDecoration: 'none',
                                                    fontWeight: 800,
                                                    boxShadow: '0 8px 20px rgba(59,130,246,0.14)',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => openSubmission(it)}
                                            >
                                                Submit Form
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Submission modal / inline panel */}
                    {showDialog && selectedForm && (
                        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(2,6,23,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
                            <div style={{ width: 520, maxWidth: '96%', background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 20px 60px rgba(2,6,23,0.3)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 800 }}>{selectedForm.title}</div>
                                        <div style={{ color: '#6b7280', fontSize: 13 }}>{selectedForm.createdAt ? new Date(selectedForm.createdAt).toLocaleString() : ''}</div>
                                    </div>
                                    <button type="button" onClick={closeDialog} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
                                </div>

                                <form onSubmit={submitForm} style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                                    <input name="formId" type="hidden" value={selectedForm._id} />
                                    <label style={{ fontSize: 13 }}>Name</label>
                                    <input name="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                                    <label style={{ fontSize: 13 }}>Email</label>
                                    <input name="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} type="email" required style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                                    <label style={{ fontSize: 13 }}>Contact</label>
                                    <input name="contact" value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} required style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                                    <label style={{ fontSize: 13 }}>Attachment (pdf/doc)</label>
                                    <input name="attachment" ref={fileRef} onChange={e => setFormData({ ...formData, file: e.target.files && e.target.files[0] })} type="file" accept=".pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx" />
                                    <label style={{ fontSize: 13 }}>Description</label>
                                    <textarea name="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={4} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }} />

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                                        <button type="button" onClick={closeDialog} style={{ padding: '8px 12px', borderRadius: 8, background: '#eef2ff', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                        <button type="submit" disabled={submitting} style={{ padding: '8px 14px', borderRadius: 8, background: '#3b82f6', color: '#000', fontWeight: 800, border: 'none', cursor: 'pointer' }}>{submitting ? 'Submitting…' : 'Submit'}</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
