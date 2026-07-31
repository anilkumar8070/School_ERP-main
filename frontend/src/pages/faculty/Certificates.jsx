import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getMyCertificates, API_BASE } from '../../api'
import { openOrDownload, downloadFile } from '../../utils/download'
import { getAuth } from '../../utils/session'

export default function FacultyCertificates() {
    const { token } = getAuth()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    // preview removed; Open/Download will open in new tab or download

    async function load() {
        setLoading(true)
        try {
            const list = await getMyCertificates(token)
            setItems(Array.isArray(list) ? list : [])
        } catch (e) {
            setItems([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    return (
        <FacultyLayout title="Certificates">
            <div style={{ padding: 24 }}>
                <h2>My Certificates</h2>
                {loading && <div className="info">Loading...</div>}
                {!loading && items.length === 0 && <div className="info">No certificates found.</div>}
                <div style={{ marginTop: 12 }}>
                    {items.map(c => (
                        <div key={c._id} className="timetable-card">
                            <div className="info-side">
                                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'var(--text-main)' }}>{c.title || 'Certificate'}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Issued: {new Date(c.uploadedAt || c.createdAt).toLocaleString()}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>For: {c.certificationFor}</div>
                            </div>
                            <div className="action-side">
                                {c.filePath && <button className="action-btn" style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)' }} onClick={() => openOrDownload((API_BASE || '') + c.filePath)}>Open</button>}
                                {c.filePath && <button className="action-btn" onClick={() => downloadFile((API_BASE || '') + c.filePath)}>Download</button>}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Preview removed - clicking Open / Download will open the PDF in a new tab or download it */}
            </div>
        </FacultyLayout>
    )
}
