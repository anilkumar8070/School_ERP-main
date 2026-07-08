import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getFeeStructure, saveFeeStructure, getReceipts, deleteFeeHistory, getStudents, assignFeeToStudents, exportFeesExcel } from '../../api'
import { getAuth } from '../../utils/session'

export default function Finance() {
    const [tab, setTab] = useState('fee-structure')
    const [classForFee, setClassForFee] = useState('I')
    const [sectionForFee, setSectionForFee] = useState('ALL')
    const [feeItems, setFeeItems] = useState([])
    const [receipts, setReceipts] = useState([])
    const [students, setStudents] = useState([])
    const [selectedStudentIds, setSelectedStudentIds] = useState(new Set())

    // Fee Form State
    const [term1, setTerm1] = useState(0)
    const [term2, setTerm2] = useState(0)
    const [note, setNote] = useState('')
    const [term1DueDate, setTerm1DueDate] = useState('')
    const [term2DueDate, setTerm2DueDate] = useState('')
    const [term1FineMode, setTerm1FineMode] = useState('none')
    const [term1FineAmount, setTerm1FineAmount] = useState(0)
    const [term2FineMode, setTerm2FineMode] = useState('none')
    const [term2FineAmount, setTerm2FineAmount] = useState(0)

    useEffect(() => {
        async function load() {
            try {
                const { token } = getAuth()
                const fs = await getFeeStructure(token)
                setFeeItems(fs || [])
                const rc = await getReceipts(token)
                setReceipts(rc || [])
            } catch (e) { console.error(e) }
        }
        load()
    }, [])

    async function loadStudents() {
        try {
            const { token } = getAuth()
            const list = await getStudents({ class: classForFee, section: sectionForFee === 'ALL' ? '' : sectionForFee }, token)
            setStudents(list || [])
            setSelectedStudentIds(new Set())
        } catch (e) { console.error(e); alert('Failed to load students') }
    }

    useEffect(() => {
        const current = feeItems.find(fi => fi.class === classForFee && fi.section === sectionForFee)
        setTerm1(current ? (current.term1 || 0) : 0)
        setTerm2(current ? (current.term2 || 0) : 0)
        setTerm1DueDate(current ? (current.term1DueDate || '') : '')
        setTerm2DueDate(current ? (current.term2DueDate || '') : '')
        setTerm1FineMode(current ? (current.term1FineMode || 'none') : 'none')
        setTerm1FineAmount(current ? (current.term1FineAmount || 0) : 0)
        setTerm2FineMode(current ? (current.term2FineMode || 'none') : 'none')
        setTerm2FineAmount(current ? (current.term2FineAmount || 0) : 0)
        setNote('')
    }, [classForFee, sectionForFee, feeItems])

    async function saveFee() {
        try {
            const { token } = getAuth()
            const payload = {
                class: classForFee,
                section: sectionForFee,
                term1: Number(term1 || 0),
                term2: Number(term2 || 0),
                note: String(note || ''),
                term1DueDate,
                term2DueDate,
                term1FineMode,
                term1FineAmount: Number(term1FineAmount || 0),
                term2FineMode,
                term2FineAmount: Number(term2FineAmount || 0)
            }
            await saveFeeStructure(payload, token)
            const fs = await getFeeStructure(token)
            setFeeItems(fs || [])
            alert('Fee structure saved successfully')
        } catch (e) { console.error(e); alert('Save failed') }
    }

    async function handleDeleteHistory(feeId, hist) {
        try {
            const { token } = getAuth()
            const hid = hist && hist._id ? String(hist._id) : (hist && hist.at ? new Date(hist.at).toISOString() : '')
            if (!hid) { alert('Cannot determine history id'); return }
            if (!confirm('Delete this history entry?')) return
            await deleteFeeHistory(feeId, hid, token)
            const fs = await getFeeStructure(token)
            setFeeItems(fs || [])
        } catch (e) { console.error(e); alert('Failed to delete history') }
    }

    async function handleAssignFee() {
        if (!confirm('Assign this fee to selected students?')) return
        try {
            const { token } = getAuth()
            const assignTerm = prompt('Enter term to assign (Term1 or Term2)', 'Term1')
            if (!assignTerm) return
            const payload = {
                class: classForFee,
                section: sectionForFee,
                term: assignTerm,
                amount: Number(assignTerm === 'Term1' ? (term1 || 0) : (term2 || 0)),
                note
            }
            const selected = Array.from(selectedStudentIds)
            if (selected.length > 0) payload.studentIds = selected
            else {
                if (!confirm('No students selected — assign to ALL students in selected class/section?')) return
            }
            const res = await assignFeeToStudents(payload, token)
            alert(`Assigned to ${res.modified || res.modifiedCount || res.matched || 0} students`)
        } catch (e) { console.error(e); alert('Failed to assign fee') }
    }

    async function handleExportFees() {
        try {
            const { token } = getAuth()
            await exportFeesExcel({}, token)
        } catch (e) {
            alert(e.message || 'Failed to export fees')
        }
    }

    return (
        <AdminLayout title="Finance Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Finance Management</h2>
                </header>

                <div className="admin-tabs" style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                    <button
                        className={`btn ${tab === 'fee-structure' ? 'primary' : 'tertiary'}`}
                        onClick={() => setTab('fee-structure')}
                        style={{ borderRadius: 20 }}
                    >
                        Fee Structure
                    </button>
                    <button
                        className={`btn ${tab === 'receipts' ? 'primary' : 'tertiary'}`}
                        onClick={() => setTab('receipts')}
                        style={{ borderRadius: 20 }}
                    >
                        Receipts
                    </button>
                </div>

                {tab === 'fee-structure' && (
                    <>
                        <div className="admin-card">
                            <h3 className="section-title">Set Fee Structure</h3>
                            <div className="admin-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'end', marginTop: 16 }}>
                                <div className="form-group">
                                    <label>Class</label>
                                    <select className="admin-select" value={classForFee} onChange={e => setClassForFee(e.target.value)}>
                                        {["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"].map(cls => (
                                            <option key={cls} value={cls}>Class {cls}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Section</label>
                                    <select className="admin-select" value={sectionForFee} onChange={e => setSectionForFee(e.target.value)}>
                                        <option value="ALL">All Sections</option>
                                        <option value="A">Section A</option>
                                        <option value="B">Section B</option>
                                        <option value="C">Section C</option>
                                        <option value="D">Section D</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Term 1 Fee (₹)</label>
                                    <input className="admin-input" type="number" value={term1} onChange={e => setTerm1(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Term 2 Fee (₹)</label>
                                    <input className="admin-input" type="number" value={term2} onChange={e => setTerm2(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Term 1 Due Date</label>
                                    <input className="admin-input" type="date" value={term1DueDate} onChange={e => setTerm1DueDate(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Term 2 Due Date</label>
                                    <input className="admin-input" type="date" value={term2DueDate} onChange={e => setTerm2DueDate(e.target.value)} />
                                </div>
                                {/* Fine Configs T1 */}
                                <div className="form-group">
                                    <label>T1 Fine Type</label>
                                    <select className="admin-select" value={term1FineMode} onChange={e => setTerm1FineMode(e.target.value)}>
                                        <option value="none">None</option>
                                        <option value="per_day">Per Day</option>
                                        <option value="per_month">Per Month</option>
                                        <option value="flat">Flat</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>T1 Fine Amount</label>
                                    <input className="admin-input" type="number" value={term1FineAmount} onChange={e => setTerm1FineAmount(e.target.value)} disabled={term1FineMode === 'none'} />
                                </div>
                                {/* Fine Configs T2 */}
                                <div className="form-group">
                                    <label>T2 Fine Type</label>
                                    <select className="admin-select" value={term2FineMode} onChange={e => setTerm2FineMode(e.target.value)}>
                                        <option value="none">None</option>
                                        <option value="per_day">Per Day</option>
                                        <option value="per_month">Per Month</option>
                                        <option value="flat">Flat</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>T2 Fine Amount</label>
                                    <input className="admin-input" type="number" value={term2FineAmount} onChange={e => setTerm2FineAmount(e.target.value)} disabled={term2FineMode === 'none'} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Note</label>
                                    <input className="admin-input" placeholder="Optional note for history" value={note} onChange={e => setNote(e.target.value)} />
                                </div>
                            </div>
                            <div className="btn-group" style={{ marginTop: 16 }}>
                                <button className="btn-primary" onClick={saveFee}>Save Configuration</button>
                                <button className="btn-secondary" onClick={loadStudents}>Load Students for Class {classForFee}</button>
                            </div>
                        </div>

                        {/* Current & History */}
                        <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                            <div className="admin-card">
                                <h3>Current Configurations</h3>
                                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                    {feeItems.length === 0 && <p className="text-muted">No fee structures set.</p>}
                                    {feeItems.map(fi => (
                                        <div key={`${fi.class}-${fi.section}`} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                            <div style={{ fontWeight: 600 }}>Class {fi.class} (Section {fi.section})</div>
                                            <div className="small text-muted">
                                                T1: ₹{fi.term1 || 0} {fi.term1DueDate && `due ${fi.term1DueDate}`} •
                                                T2: ₹{fi.term2 || 0} {fi.term2DueDate && `due ${fi.term2DueDate}`}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="admin-card">
                                <h3>History for Selected Class</h3>
                                {(() => {
                                    const current = feeItems.find(fi => fi.class === classForFee && fi.section === sectionForFee)
                                    if (!current || !current.history || current.history.length === 0) return <p className="text-muted">No history found.</p>
                                    return (
                                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                            {current.history.slice().reverse().map(h => (
                                                <div key={(h && h._id) || h.at} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <div style={{ fontSize: 13 }}>
                                                            <strong>{h.by || 'admin'}</strong> • {new Date(h.at).toLocaleDateString()}
                                                        </div>
                                                        <button className="btn-danger small" onClick={() => handleDeleteHistory(current._id, h)}>Delete</button>
                                                    </div>
                                                    <div className="small text-muted">
                                                        T1: ₹{h.term1 || 0} • T2: ₹{h.term2 || 0}
                                                        {h.note && <div>Note: {h.note}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>

                        {/* Students List for Mass Assign */}
                        {students.length > 0 && (
                            <div className="admin-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3>Students in Class {classForFee} {sectionForFee !== 'ALL' && `(Sec ${sectionForFee})`}</h3>
                                    <button className="btn-primary" onClick={handleAssignFee}>Assign Fee to Selected</button>
                                </div>
                                <div className="table-container" style={{ maxHeight: 400 }}>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40 }}>
                                                    <input type="checkbox" onChange={e => {
                                                        if (e.target.checked) setSelectedStudentIds(new Set(students.map(s => s._id)))
                                                        else setSelectedStudentIds(new Set())
                                                    }} checked={students.length > 0 && selectedStudentIds.size === students.length} />
                                                </th>
                                                <th>Name</th>
                                                <th>Roll No</th>
                                                <th>Email</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map(s => (
                                                <tr key={s._id}>
                                                    <td>
                                                        <input type="checkbox" checked={selectedStudentIds.has(s._id)} onChange={e => {
                                                            const copy = new Set(selectedStudentIds)
                                                            if (e.target.checked) copy.add(s._id)
                                                            else copy.delete(s._id)
                                                            setSelectedStudentIds(copy)
                                                        }} />
                                                    </td>
                                                    <td>{s.name}</td>
                                                    <td>{s.rollNo}</td>
                                                    <td>{s.email}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {tab === 'receipts' && (
                    <div className="admin-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>All Receipts</h3>
                            <button className="btn-secondary" onClick={handleExportFees}>Export Fee Report (Excel)</button>
                        </div>
                        {!receipts.length && <p className="text-muted">No receipts found.</p>}
                        {receipts.length > 0 && (
                            <div className="table-container">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Student</th>
                                            <th>Class</th>
                                            <th>Term</th>
                                            <th>Amount</th>
                                            <th>Date</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {receipts.map(r => (
                                            <tr key={r._id}>
                                                <td>{String(r._id).slice(-6)}</td>
                                                <td>{r.studentName || r.studentEmail}</td>
                                                <td>{r.class}</td>
                                                <td>{r.term}</td>
                                                <td>₹{Number(r.amount || 0).toFixed(2)}</td>
                                                <td>{new Date(r.createdAt || Date.now()).toLocaleDateString()}</td>
                                                <td>
                                                    <button className="btn-secondary small" onClick={() => {
                                                        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}.box{max-width:680px;margin:0 auto;border:1px solid #000;padding:20px;border-radius:4px}table{width:100%;border-collapse:collapse;margin-top:10px}td{padding:6px;border-bottom:1px solid #ccc}</style></head><body><div class="box"><h2>Payment Receipt</h2><p>ID: ${r._id}</p><table><tr><td>Student</td><td>${r.studentName || '-'}</td></tr><tr><td>Amount</td><td>₹${r.amount}</td></tr><tr><td>Date</td><td>${new Date(r.createdAt).toLocaleString()}</td></tr></table></div></body></html>`;
                                                        const w = window.open('', '_blank');
                                                        w.document.write(html);
                                                        w.document.close();
                                                        setTimeout(() => { w.focus(); w.print(); }, 500);
                                                    }}>Print</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
