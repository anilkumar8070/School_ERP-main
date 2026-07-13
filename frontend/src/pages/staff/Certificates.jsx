import React, { useEffect, useState } from 'react'
import StaffLayout from '../../components/staff/StaffLayout'
import { API_BASE } from '../../api'
import { getAuth } from '../../utils/session'

export default function StaffCertificates() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function load() {
        setLoading(true)
        setError('')
        try {
            const { token } = getAuth() || {}
            const headers = {}
            if (token) headers.Authorization = `Bearer ${token}`
            const res = await fetch(`${API_BASE}/api/certificates/my`, { headers })
            if (!res.ok) {
                const txt = await res.json().catch(() => ({ message: 'Failed to load certificates' }))
                throw new Error(txt.message || 'Failed to load certificates')
            }
            const data = await res.json()
            setRows(data || [])
        } catch (e) {
            console.error(e)
            setError(e && e.message ? e.message : 'Failed to load certificates')
            setRows([])
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    async function downloadCert(c) {
        if (!c || !c.filePath) return
        try {
            const { token } = getAuth() || {}
            const url = `${API_BASE}${c.filePath}`
            // fetch as blob to ensure download works with auth
            const res = await fetch(url, { headers: { Authorization: token ? `Bearer ${token}` : '' } })
            if (!res.ok) throw new Error('Failed to download file')
            const blob = await res.blob()
            const a = document.createElement('a')
            const objUrl = URL.createObjectURL(blob)
            a.href = objUrl
            // prefer a reasonable filename
            const name = (c.title || 'certificate').replace(/[^a-z0-9._-]/gi, '_') + (c.filePath.endsWith('.pdf') ? '.pdf' : '')
            a.download = name
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(objUrl)
        } catch (e) {
            console.error('Download failed', e)
            alert('Download failed')
        }
    }

    return (
        <StaffLayout title="Certificates">
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                <h2>Certificates</h2>
                <div style={{ color: '#6b7280', marginBottom: 12 }}>Certificates issued to you by admin. Use the download button to save the certificate.</div>
                {loading && <div>Loading…</div>}
                {error && <div style={{ color: 'red' }}>{error}</div>}
                {!loading && rows && rows.length === 0 && <div>No certificates available.</div>}
                {!loading && rows && rows.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Title</th>
                                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>For</th>
                                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Issued</th>
                                    <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>File</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(c => (
                                    <tr key={c._id}>
                                        <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{c.title || c.schoolName || 'Certificate'}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{c.certificationFor || c.recipientName || ''}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>{c.dateOfIssue || (c.uploadedAt ? new Date(c.uploadedAt).toLocaleDateString() : '')}</td>
                                        <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                                            {c.filePath ? (
                                                <button onClick={() => downloadCert(c)} style={{ padding: '6px 10px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none' }}>Download</button>
                                            ) : (
                                                <span style={{ color: '#6b7280' }}>No file</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </StaffLayout>
    )
}
