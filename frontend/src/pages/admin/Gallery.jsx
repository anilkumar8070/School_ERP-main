import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { API_BASE, createGallery, addGalleryImages, deleteGalleryImage, getGallery } from '../../api'
import '../../pages/AdminPanel.css'
import { toast } from 'react-toastify'

const GALLERY_LABEL = 'Gallery'

export default function GalleryAdmin() {
    const [gallery, setGallery] = useState(null)
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => { fetchGallery() }, [])

    async function fetchGallery() {
        setLoading(true)
        try {
            const all = await getGallery()
            const found = (all || []).find(g => String(g.label || '').toLowerCase() === GALLERY_LABEL.toLowerCase())
            setGallery(found || null)
        } catch (e) { console.warn(e) }
        setLoading(false)
    }

    function onFiles(e) { setFiles(Array.from(e.target.files || [])) }

    async function onUpload(e) {
        e.preventDefault()
        if (!files || files.length === 0) return toast.info('Choose images to upload')
        const fd = new FormData()
        for (const f of files) fd.append('images', f)
        try {
            const token = localStorage.getItem('erp_token') // TODO: use getAuth utils if consistent
            if (gallery && gallery._id) {
                await addGalleryImages(gallery._id, fd, token)
            } else {
                // create new gallery with label
                fd.append('label', GALLERY_LABEL)
                await createGallery(fd, token)
            }
            setFiles([])
            fetchGallery()
            toast.success('Images uploaded')
        } catch (err) { toast.error(err && err.message ? err.message : 'Upload failed') }
    }

    async function onDeleteImage(im) {
        if (!gallery || !gallery._id) return
        if (!confirm('Delete this image?')) return
        try {
            const token = localStorage.getItem('erp_token')
            const filename = im.filename || (im.url ? im.url.split('/').pop() : '')
            await deleteGalleryImage(gallery._id, filename, token)
            fetchGallery()
            toast.success('Image deleted')
        } catch (err) { toast.error(err && err.message ? err.message : 'Delete failed') }
    }

    return (
        <AdminLayout title="Gallery">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Gallery - {GALLERY_LABEL}</h2>
                </header>

                <div className="admin-card">
                    <h3 className="section-title">Upload Images</h3>
                    <form onSubmit={onUpload} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input className="admin-input" type="file" accept="image/*" multiple onChange={onFiles} style={{ maxWidth: 300 }} />
                        <button className="btn-primary" type="submit">Upload</button>
                    </form>
                    <div className="small-text" style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
                        Images uploaded here will appear on the public <code>/start</code> page.
                    </div>
                </div>

                <div className="admin-card">
                    <h3 className="section-title">Gallery Images</h3>
                    {loading ? <div>Loading...</div> : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                            {(gallery && gallery.images && gallery.images.length > 0) ? gallery.images.map((im, idx) => {
                                const raw = im && im.url ? String(im.url) : ''
                                const src = raw && (raw.startsWith('http://') || raw.startsWith('https://')) ? raw : (raw && raw.startsWith('/') ? `${API_BASE}${raw}` : (im && im.filename ? `${API_BASE}/uploads/${im.filename}` : raw))
                                return (
                                    <div key={idx} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                        <div style={{ aspectRatio: '4/3', overflow: 'hidden' }}>
                                            <img src={src} alt={im.originalname || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ padding: 8, display: 'flex', justifyContent: 'center' }}>
                                            <button className="btn-danger small" onClick={() => onDeleteImage(im)}>Remove</button>
                                        </div>
                                    </div>
                                )
                            }) : <div style={{ color: 'var(--text-secondary)' }}>No images uploaded yet.</div>}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
