import React, { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import { getAuth } from '../../utils/session'
import { createNotice, getNotices, API_BASE } from '../../api'
import '../../pages/AdminPanel.css'
import { toast } from 'react-toastify'

export default function AdminNotices() {
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [targets, setTargets] = useState(['student'])
    const [file, setFile] = useState(null)
    const [studentAll, setStudentAll] = useState(true)
    const [studentClass, setStudentClass] = useState('')
    const [studentSection, setStudentSection] = useState('')
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(false)

    async function loadHistory() {
        try {
            const { token } = getAuth()
            const items = await getNotices({}, token)
            setHistory(items || [])
        } catch (e) { setHistory([]) }
    }

    useEffect(() => { loadHistory() }, [])

    function toggleTarget(role) {
        setTargets(t => t.includes(role) ? t.filter(x => x !== role) : [...t, role])
    }

    async function submit(e) {
        e.preventDefault()
        if (!title) return toast.error('Please add a title')
        try {
            const { token } = getAuth()
            setLoading(true)
            const payload = { title, body, targets }
            if (file) {
                payload.file = file
                payload.studentAll = studentAll
                payload.studentClass = studentClass
                payload.studentSection = studentSection
            } else {
                // include student filters even if no file so backend stores them
                payload.studentAll = studentAll
                payload.studentClass = studentClass
                payload.studentSection = studentSection
            }
            await createNotice(payload, token)
            setTitle('')
            setBody('')
            setTargets(['student'])
            setFile(null)
            setStudentAll(true)
            setStudentClass('')
            setStudentSection('')
            await loadHistory()
            toast.success('Notice created')
        } catch (err) { console.error(err); toast.error('Failed to create notice') }
        finally { setLoading(false) }
    }

    return (
        <AdminLayout title="Notices">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Notices & Announcements</h2>
                </header>

                <div className="admin-card">
                    <h3 className="section-title">Create New Notice</h3>
                    <form onSubmit={submit} className="admin-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                        <div>
                            <label>Title</label>
                            <input
                                className="admin-input"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Enter notice title"
                            />
                        </div>

                        <div>
                            <label>Body</label>
                            <textarea
                                className="admin-input"
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                placeholder="Write notice body..."
                                style={{ minHeight: 120, resize: 'vertical' }}
                            />
                        </div>

                        <div>
                            <label>Attach PDF (optional)</label>
                            <input
                                className="admin-file-input"
                                type="file"
                                accept="application/pdf"
                                onChange={e => setFile(e.target.files && e.target.files[0])}
                            />
                        </div>

                        <div>
                            <label>Recipients</label>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={targets.includes('student')} onChange={() => toggleTarget('student')} style={{ accentColor: 'var(--primary-color)' }} />
                                    <span>Students</span>
                                </label>
                                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={targets.includes('faculty')} onChange={() => toggleTarget('faculty')} style={{ accentColor: 'var(--primary-color)' }} />
                                    <span>Faculty</span>
                                </label>
                                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={targets.includes('parent')} onChange={() => toggleTarget('parent')} style={{ accentColor: 'var(--primary-color)' }} />
                                    <span>Parents</span>
                                </label>
                                <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={targets.includes('staff')} onChange={() => toggleTarget('staff')} style={{ accentColor: 'var(--primary-color)' }} />
                                    <span>Staff</span>
                                </label>
                            </div>
                        </div>

                        {targets.includes('student') && (
                            <div className="admin-card" style={{ marginTop: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: 16 }}>
                                <h4 style={{ marginBottom: 12, color: 'var(--text-primary)', marginTop: 0 }}>Student Filters</h4>
                                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                                        <input type="radio" name="studentMode" checked={studentAll} onChange={() => setStudentAll(true)} style={{ accentColor: 'var(--primary-color)' }} />
                                        <span>All Students</span>
                                    </label>
                                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                                        <input type="radio" name="studentMode" checked={!studentAll} onChange={() => setStudentAll(false)} style={{ accentColor: 'var(--primary-color)' }} />
                                        <span>Specific Class/Section</span>
                                    </label>
                                </div>

                                {!studentAll && (
                                    <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: 150 }}>
                                            <label style={{ fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>Class</label>
                                            <select className="admin-input" value={studentClass} onChange={e => setStudentClass(e.target.value)}>
                                                <option value="">Select Class</option>
                                                {Array.from({ length: 12 }).map((_, i) => <option key={i} value={String(i + 1)}>{String(i + 1)}</option>)}
                                            </select>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 150 }}>
                                            <label style={{ fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>Section</label>
                                            <select className="admin-input" value={studentSection} onChange={e => setStudentSection(e.target.value)}>
                                                <option value="">Select Section</option>
                                                <option value="A">A</option>
                                                <option value="B">B</option>
                                                <option value="C">C</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                            <button className="btn-primary" type="submit" disabled={loading}>
                                {loading ? 'Sending...' : 'Publish Notice'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <h3 className="section-title">Notice History</h3>
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Recipients</th>
                                    <th>Body</th>
                                    <th>Attachment</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 18 }}>No notices yet.</td></tr>}
                                {history.map(n => (
                                    <tr key={n._id}>
                                        <td>{n.title}</td>
                                        <td>
                                            {(n.targets || []).map(t => (
                                                <span key={t} className="status-badge" style={{ marginRight: 4, textTransform: 'capitalize' }}>{t}</span>
                                            ))}
                                        </td>
                                        <td>{n.body && n.body.length > 50 ? n.body.slice(0, 50) + '...' : n.body}</td>
                                        <td>
                                            {n.filePath ? (
                                                <a
                                                    href={n.filePath.startsWith('http') ? n.filePath : (API_BASE + n.filePath)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="action-link"
                                                    style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}
                                                >
                                                    View PDF
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
