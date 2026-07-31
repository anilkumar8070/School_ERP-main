import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getStudents, getFaculty, getStaff, createCertificate, getCertificates, API_BASE } from '../../api'
import { openOrDownload, downloadFile } from '../../utils/download'
import { getAuth } from '../../utils/session'

export default function AdminCertificates() {
    const { token } = getAuth()
    const [schoolName, setSchoolName] = useState('')
    const [title, setTitle] = useState('Certificate of Appreciation')
    const [certFor, setCertFor] = useState('')
    const [dateOfIssue, setDateOfIssue] = useState(new Date().toISOString().slice(0, 10))
    const [recipientType, setRecipientType] = useState('Student')
    const [students, setStudents] = useState([])
    const [faculty, setFaculty] = useState([])
    const [staff, setStaff] = useState([])
    const [recipientId, setRecipientId] = useState('')
    const [recipientName, setRecipientName] = useState('')
    const [signatureFile, setSignatureFile] = useState(null)
    const [attachFile, setAttachFile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [history, setHistory] = useState([])

    useEffect(() => {
        async function loadPeople() {
            try {
                const s = await getStudents({}, token)
                setStudents(Array.isArray(s) ? s : [])
            } catch (e) { setStudents([]) }
            try {
                const f = await getFaculty({}, token)
                setFaculty(Array.isArray(f) ? f : [])
            } catch (e) { setFaculty([]) }
            try {
                const st = await getStaff('', token)
                setStaff(Array.isArray(st) ? st : [])
            } catch (e) { setStaff([]) }
        }
        loadPeople()
    }, [])

    async function loadHistory() {
        try {
            const list = await getCertificates({}, token)
            setHistory(Array.isArray(list) ? list : [])
        } catch (e) { setHistory([]) }
    }

    useEffect(() => { loadHistory() }, [])

    function onRecipientChange(id) {
        setRecipientId(id)
        if (recipientType === 'Student') {
            const s = students.find(x => String(x._id) === String(id))
            setRecipientName(s ? s.name : '')
        } else if (recipientType === 'Faculty') {
            const f = faculty.find(x => String(x._id) === String(id))
            setRecipientName(f ? f.name : '')
        } else if (recipientType === 'Staff') {
            const st = staff.find(x => String(x._id) === String(id))
            setRecipientName(st ? st.name : '')
        }
    }

    async function submit(e) {
        e.preventDefault()
        if (!recipientName) return alert('Recipient required')
        try {
            setLoading(true)
            const fd = new FormData()
            fd.append('schoolName', schoolName)
            fd.append('title', title)
            fd.append('recipientName', recipientName)
            if (recipientId) fd.append('recipientId', recipientId)
            // Map recipientType: Student -> Student, Faculty -> Faculty, Staff -> User
            if (recipientType === 'Student') fd.append('recipientType', 'Student')
            else if (recipientType === 'Faculty') fd.append('recipientType', 'Faculty')
            else fd.append('recipientType', 'User')
            fd.append('certificationFor', certFor)
            fd.append('dateOfIssue', dateOfIssue)
            if (signatureFile) fd.append('signature', signatureFile)
            if (attachFile) fd.append('file', attachFile)
            const res = await createCertificate(fd, token)
            alert('Certificate generated')
            setSchoolName('')
            setTitle('Certificate of Appreciation')
            setCertFor('')
            setSignatureFile(null)
            setAttachFile(null)
            setRecipientId('')
            setRecipientName('')
            loadHistory()
        } catch (e) {
            alert('Failed: ' + (e && e.message ? e.message : String(e)))
        } finally { setLoading(false) }
    }

    return (
        <AdminLayout title="Certificates">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Certificate Generation</h2>
                </header>

                <div className="admin-card">
                    <form onSubmit={submit} className="admin-form-grid">
                        <div className="form-group">
                            <label>School Name</label>
                            <input className="admin-input" value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="School Name" />
                        </div>
                        <div className="form-group">
                            <label>Title</label>
                            <input className="admin-input" value={title} onChange={e => setTitle(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Certification For (body text)</label>
                            <textarea className="admin-textarea" value={certFor} onChange={e => setCertFor(e.target.value)} rows={4} />
                        </div>
                        <div className="form-group">
                            <label>Date of Issue</label>
                            <input className="admin-input" type="date" value={dateOfIssue} onChange={e => setDateOfIssue(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label>Recipient Type</label>
                            <select className="admin-select" value={recipientType} onChange={e => setRecipientType(e.target.value)}>
                                <option>Student</option>
                                <option>Faculty</option>
                                <option>Staff</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Select Recipient</label>
                            {recipientType === 'Student' ? (
                                <select className="admin-select" value={recipientId} onChange={e => onRecipientChange(e.target.value)}>
                                    <option value="">Select student</option>
                                    {students.map(s => <option key={s._id} value={s._id}>{s.name} ({s.rollNo || s._id})</option>)}
                                </select>
                            ) : recipientType === 'Faculty' ? (
                                <select className="admin-select" value={recipientId} onChange={e => onRecipientChange(e.target.value)}>
                                    <option value="">Select faculty</option>
                                    {faculty.map(f => <option key={f._id} value={f._id}>{f.name} ({f.employeeId || f._id})</option>)}
                                </select>
                            ) : (
                                <select className="admin-select" value={recipientId} onChange={e => onRecipientChange(e.target.value)}>
                                    <option value="">Select staff</option>
                                    {staff.map(s => <option key={s._id} value={s._id}>{s.name} ({s.username || s._id})</option>)}
                                </select>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Or Manual Recipient Name</label>
                            <input className="admin-input" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Full name" />
                        </div>

                        <div className="form-group">
                            <label>Signature (Optional)</label>
                            <input className="admin-file-input" type="file" accept="image/*" onChange={e => setSignatureFile(e.target.files && e.target.files[0])} />
                        </div>

                        <div className="form-group">
                            <label>Attachment (Optional PDF/DOC)</label>
                            <input className="admin-file-input" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setAttachFile(e.target.files && e.target.files[0])} />
                        </div>

                        <div className="btn-group" style={{ gridColumn: '1 / -1' }}>
                            <button className="btn-primary" type="submit" disabled={loading}>
                                {loading ? 'Generating...' : 'Generate & Send Certificate'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <h3 style={{ marginBottom: 16 }}>Sent Certificates</h3>
                    {history.length === 0 ? (
                        <div className="empty-state">No certificates generated yet.</div>
                    ) : (
                        <div className="table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Recipient</th>
                                        <th>Type</th>
                                        <th>Date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(c => (
                                        <tr key={c._id}>
                                            <td>{c.title || 'Certificate'}</td>
                                            <td>{c.recipientName}</td>
                                            <td>{c.recipientType}</td>
                                            <td>{new Date(c.uploadedAt || c.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    {c.filePath && <button type="button" className="btn outline" onClick={() => openOrDownload(c.filePath)}>Open</button>}
                                                    {c.filePath && <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => downloadFile(c.filePath)}>Download</button>}
                                                </div>
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
