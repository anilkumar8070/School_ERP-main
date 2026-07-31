import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import IDCard from '../../components/common/IDCard'
import { generateIdCards, generateFacultyIdCards, generateStaffIdCards, listIdCards, listIdCardBatches, getIdCardsByBatch, updateIdCard, uploadFile } from '../../api'
import { getAuth } from '../../utils/session'
import { toast } from 'react-toastify'
import '../../pages/AdminPanel.css'

const classOptions = Array.from({ length: 12 }, (_, i) => String(i + 1))
const sectionOptions = ['A', 'B', 'C', 'D']

function CardEditor({ card, onSave }) {
    const [form, setForm] = useState({
        name: card?.name || '',
        fatherName: card?.fatherName || '',
        rollNo: card?.rollNo || '',
        class: card?.class || '',
        gender: card?.gender || '',
        section: card?.section || '',
        contact: card?.contact || '',
        email: card?.email || '',
        designation: card?.designation || '',
        schoolName: card?.schoolName || 'SCHOOL NAME',
        photoUrl: card?.photoUrl || '',
    })
    const [selectedFile, setSelectedFile] = useState(null)
    useEffect(() => {
        setForm({
            name: card?.name || '',
            fatherName: card?.fatherName || '',
            rollNo: card?.rollNo || '',
            class: card?.class || '',
            medium: card?.medium || '',
            gender: card?.gender || '',
            section: card?.section || '',
            contact: card?.contact || '',
            email: card?.email || '',
            designation: card?.designation || '',
            schoolName: card?.schoolName || 'SCHOOL NAME',
            photoUrl: card?.photoUrl || '',
        })
        setSelectedFile(null)
    }, [card])

    function setField(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

    return (
        <div className="admin-card" style={{ marginTop: '1rem', border: '1px solid var(--border)', boxShadow: 'none' }}>
            <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Edit Details</h4>
            <div className="admin-form-grid" style={{ gap: '10px' }}>
                <div>
                    <label>School Name</label>
                    <input className="admin-input" placeholder="Enter school name" value={form.schoolName} onChange={e => setField('schoolName', e.target.value)} />
                </div>
                <div>
                    <label>Name</label>
                    <input className="admin-input" placeholder="Full name" value={form.name} onChange={e => setField('name', e.target.value)} />
                </div>

                {card?.type === 'student' && (
                    <>
                        <div>
                            <label>Father's Name</label>
                            <input className="admin-input" placeholder="Father's name" value={form.fatherName} onChange={e => setField('fatherName', e.target.value)} />
                        </div>
                        <div>
                            <label>Roll No</label>
                            <input className="admin-input" placeholder="e.g. 1023" value={form.rollNo} onChange={e => setField('rollNo', e.target.value)} />
                        </div>
                        <div>
                            <label>Class</label>
                            <input className="admin-input" placeholder="e.g. 10" value={form.class} onChange={e => setField('class', e.target.value)} />
                        </div>
                        <div>
                            <label>Medium</label>
                            <select className="admin-input" value={form.medium} onChange={e => setField('medium', e.target.value)}>
                                <option value="">Select</option>
                                <option value="Hindi">Hindi</option>
                                <option value="English">English</option>
                                <option value="Bengali">Bengali</option>
                                <option value="Tamil">Tamil</option>
                                <option value="Telugu">Telugu</option>
                                <option value="Marathi">Marathi</option>
                                <option value="Gujarati">Gujarati</option>
                                <option value="Urdu">Urdu</option>
                                <option value="Kannada">Kannada</option>
                                <option value="Malayalam">Malayalam</option>
                            </select>
                        </div>
                        <div>
                            <label>Gender</label>
                            <select className="admin-input" value={form.gender} onChange={e => setField('gender', e.target.value)}>
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label>Section</label>
                            <input className="admin-input" placeholder="e.g. A" value={form.section} onChange={e => setField('section', e.target.value)} />
                        </div>
                    </>
                )}

                {card?.type !== 'student' && (
                    <>
                        <div>
                            <label>{card?.type === 'faculty' ? 'Employee ID' : 'Staff ID'}</label>
                            <input className="admin-input" placeholder={card?.type === 'faculty' ? 'Employee ID' : 'Staff ID'} value={form.rollNo} onChange={e => setField('rollNo', e.target.value)} />
                        </div>
                        <div>
                            <label>Email</label>
                            <input className="admin-input" placeholder="Email (for faculty/staff)" value={form.email} onChange={e => setField('email', e.target.value)} />
                        </div>
                        <div>
                            <label>Gender</label>
                            <select className="admin-input" value={form.gender} onChange={e => setField('gender', e.target.value)}>
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        {(card?.type === 'faculty' || card?.type === 'staff') && (
                            <div>
                                <label>Designation</label>
                                <input className="admin-input" placeholder="Designation" value={form.designation} onChange={e => setField('designation', e.target.value)} />
                            </div>
                        )}
                    </>
                )}

                <div>
                    <label>Contact</label>
                    <input className="admin-input" placeholder="Phone number" value={form.contact} onChange={e => setField('contact', e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <label>Photo</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input className="admin-input" value={form.photoUrl} onChange={e => setField('photoUrl', e.target.value)} placeholder="Photo URL (optional)" style={{ flex: 1, minWidth: '200px' }} />
                        <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} style={{ maxWidth: '200px', color: 'var(--text-primary)' }} />
                        <UploadButton file={selectedFile} onUploaded={url => setField('photoUrl', url)} />
                    </div>
                </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={() => onSave(form)}>Save Changes</button>
            </div>
        </div>
    )
}

function UploadButton({ file, onUploaded }) {
    const { token } = getAuth()
    async function uploadSelected() {
        if (!file) { toast.info('Please choose a photo first'); return }
        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await uploadFile(fd, token)
            onUploaded && onUploaded(res.url)
            toast.success('Photo uploaded')
        } catch (e) { toast.error(e.message || 'Upload failed') }
    }
    return <button className="btn-secondary" onClick={uploadSelected}>Upload</button>
}

export default function AdminCardManagement() {
    const { token } = getAuth()
    const [klass, setClass] = useState('10')
    const [section, setSection] = useState('A')
    const [schoolName, setSchoolName] = useState('SCHOOL NAME')
    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [validUpto, setValidUpto] = useState(() => {
        const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10)
    })
    const [cards, setCards] = useState([])
    const [loading, setLoading] = useState(false)
    const [mode, setMode] = useState('latest') // latest | history | batch
    const [batches, setBatches] = useState([])
    const [activeBatch, setActiveBatch] = useState(null)

    async function loadLatest() {
        setLoading(true)
        try {
            const list = await listIdCards({ class: klass, section, latest: 'true' }, token)
            setCards(list)
        } catch (e) { toast.error(e.message || 'Failed to load cards') }
        setLoading(false)
    }

    async function loadHistory() {
        setLoading(true)
        try {
            const rows = await listIdCardBatches({ class: klass, section }, token)
            setBatches(rows)
        } catch (e) { toast.error(e.message || 'Failed to load history') }
        setLoading(false)
    }

    useEffect(() => { if (mode === 'latest') loadLatest(); if (mode === 'history') loadHistory() }, [klass, section, mode])

    async function doGenerate() {
        setLoading(true)
        try {
            const res = await generateIdCards({ class: klass, section, schoolName, issueDate, validUpto }, token)
            toast.success(`Generated ${res.count} cards`)
            setMode('latest')
            await loadLatest()
        } catch (e) { toast.error(e.message || 'Generate failed') }
        setLoading(false)
    }

    async function doGenerateFaculty() {
        setLoading(true)
        try {
            const res = await generateFacultyIdCards({ schoolName, issueDate, validUpto }, token)
            toast.success(`Generated ${res.count} faculty cards`)
            setCards(res.cards || [])
            setActiveBatch({ batchId: res.batchId, count: res.count, class: '', section: '', date: new Date() })
            setMode('batch')
        } catch (e) { toast.error(e.message || 'Generate faculty failed') }
        setLoading(false)
    }

    async function doGenerateStaff() {
        setLoading(true)
        try {
            const res = await generateStaffIdCards({ schoolName, issueDate, validUpto }, token)
            toast.success(`Generated ${res.count} staff cards`)
            setCards(res.cards || [])
            setActiveBatch({ batchId: res.batchId, count: res.count, class: '', section: '', date: new Date() })
            setMode('batch')
        } catch (e) { toast.error(e.message || 'Generate staff failed') }
        setLoading(false)
    }

    async function saveCard(id, patch) {
        try {
            // include medium if present in form
            const updated = await updateIdCard(id, patch, token)
            setCards(prev => prev.map(c => c._id === updated._id ? updated : c))
            toast.success('Card updated')
        } catch (e) { toast.error(e.message || 'Update failed') }
    }

    async function openBatch(b) {
        setLoading(true)
        try {
            const list = await getIdCardsByBatch(b.batchId, token)
            setActiveBatch(b)
            setCards(list)
            setMode('batch')
        } catch (e) { toast.error(e.message || 'Failed to open batch') }
        setLoading(false)
    }

    const headerInfo = useMemo(() => ({ klass, section, schoolName }), [klass, section, schoolName])

    return (
        <AdminLayout title="Card Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Card Management</h2>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <VerifyWidget />
                    </div>
                </header>

                <div className="admin-card">
                    <h3 className="section-title">Generation Settings</h3>
                    <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                        <div>
                            <label>Class</label>
                            <select className="admin-input" value={klass} onChange={e => setClass(e.target.value)}>{classOptions.map(c => <option key={c} value={c}>{c}</option>)}</select>
                        </div>
                        <div>
                            <label>Section</label>
                            <select className="admin-input" value={section} onChange={e => setSection(e.target.value)}>{sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}</select>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                            <label>School Name</label>
                            <input className="admin-input" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
                        </div>
                        <div>
                            <label>Issue Date</label>
                            <input className="admin-input" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                        </div>
                        <div>
                            <label>Valid Upto</label>
                            <input className="admin-input" type="date" value={validUpto} onChange={e => setValidUpto(e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                        <button className="btn-primary" onClick={doGenerate}>Generate Student IDs</button>
                        <button className="btn-primary" onClick={doGenerateFaculty}>Generate Faculty IDs</button>
                        <button className="btn-primary" onClick={doGenerateStaff}>Generate Staff IDs</button>
                    </div>
                </div>

                <div className="admin-card">
                    <div className="filters" style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        <button className={`btn-secondary ${mode === 'latest' ? 'active' : ''}`} onClick={() => setMode('latest')}>Latest</button>
                        <button className={`btn-secondary ${mode === 'history' ? 'active' : ''}`} onClick={() => setMode('history')}>History</button>
                        {mode === 'batch' && <button className="btn-secondary" onClick={() => { setMode('latest'); setActiveBatch(null) }}>Back to Latest</button>}
                    </div>

                    {loading && <div style={{ marginTop: 12 }}>Loading...</div>}

                    {mode === 'history' && !loading && (
                        <div>
                            <h3>Batch History</h3>
                            {batches.length === 0 && <div>No batches yet for Class {klass}-{section}</div>}
                            <div className="admin-table-wrapper">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Batch ID</th>
                                            <th>Date</th>
                                            <th>Count</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batches.map(b => (
                                            <tr key={b.batchId}>
                                                <td>{b.batchId}</td>
                                                <td>{new Date(b.date).toLocaleString()}</td>
                                                <td>{b.count}</td>
                                                <td>
                                                    <button className="action-btn view-btn" onClick={() => openBatch(b)}>Open</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {(mode === 'latest' || mode === 'batch') && !loading && (
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
                                {cards.map(card => (
                                    <div key={card._id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div className="admin-card" style={{ padding: '10px', height: 'auto', display: 'flex', justifyContent: 'center' }}>
                                            <IDCard card={{ ...card, schoolName: (card.schoolName || (mode === 'latest' ? schoolName : headerInfo.schoolName)) }} />
                                        </div>
                                        <CardEditor card={{ ...card }} onSave={(patch) => saveCard(card._id, patch)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}

function VerifyWidget() {
    const [code, setCode] = useState('')
    const [result, setResult] = useState(null)
    const { token } = getAuth()
    async function verify() {
        setResult(null)
        if (!code.trim()) return
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/idcards/verify/${encodeURIComponent(code.trim())}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Invalid code' }))
                toast.error(err.message || 'Invalid code')
                return
            }
            const card = await res.json()
            setResult(card)
            toast.success('Card verified')
        } catch (e) { toast.error(e.message || 'Verification failed') }
    }
    return (
        <div className="verify-widget" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="admin-input" placeholder="Enter ID code" value={code} onChange={e => setCode(e.target.value)} style={{ width: 140 }} />
            <button className="btn-primary" onClick={verify}>Verify</button>
            {result && <span style={{ fontSize: 12, color: 'var(--success-color)' }}>Valid • {result.name} • Class {result.class}-{result.section}</span>}
        </div>
    )
}
