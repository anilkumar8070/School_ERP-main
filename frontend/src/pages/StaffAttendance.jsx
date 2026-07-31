import React, { useEffect, useState } from 'react'
import StaffLayout from '../components/staff/StaffLayout'
import './Auth.css'
import { postLeave, getMyLeaves, getStaffAttendance, getProfile } from '../api'
import { getAuth } from '../utils/session'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function StaffAttendance() {
    const [status, setStatus] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ from: '', to: '', reason: '' })
    const [myLeaves, setMyLeaves] = useState([])
    function formatLocalDate(d) { if (!d) return ''; const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}` }
    const today = formatLocalDate(new Date())
    const [historyQuery, setHistoryQuery] = useState({ from: today, to: today })
    const [historyRows, setHistoryRows] = useState([])
    const [currentUserId, setCurrentUserId] = useState('')

    function onChange(e) { const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value })) }

    async function loadMyLeaves() {
        try {
            const { token } = getAuth()
            const items = await getMyLeaves(token)
            setMyLeaves(Array.isArray(items) ? items : [])
        } catch (e) { setMyLeaves([]) }
    }

    useEffect(() => { loadMyLeaves(); resolveUser() }, [])

    async function resolveUser() {
        try {
            const { token } = getAuth()
            const prof = await getProfile(token)
            const id = prof && prof.user && (prof.user.sub || prof.user.id || prof.user._id)
            if (id) setCurrentUserId(id)
        } catch { }
    }

    async function requestLeave(e) {
        e.preventDefault()
        try {
            if (!form.from || !form.to || !form.reason) throw new Error('Please fill from, to and reason')
            setLoading(true); setMessage('')
            const { token } = getAuth()
            await postLeave(form.from, form.to, form.reason, token)
            setForm({ from: '', to: '', reason: '' })
            await loadMyLeaves()
            setMessage('Leave request submitted to admin')
        } catch (e) { setMessage(e.message || 'Failed to submit leave') }
        finally { setLoading(false) }
    }

    async function loadHistory() {
        try {
            const { token } = getAuth()
            const items = await getStaffAttendance({ from: historyQuery.from, to: historyQuery.to, userId: currentUserId }, token)
            const list = Array.isArray(items) ? items : []
            const rows = []
            for (const d of list) {
                const recs = Array.isArray(d.records) ? d.records : []
                const me = recs.find(r => String(r.userId) === String(currentUserId))
                if (me) rows.push({ date: d.date, status: me.status })
            }
            const sorted = rows.sort((a, b) => a.date.localeCompare(b.date))
            setHistoryRows(sorted)
            const todayRow = sorted.find(r => r.date === today)
            setStatus(todayRow ? (todayRow.status || '').toUpperCase() : 'Not Marked')
        } catch (e) { setMessage(e.message || 'Failed to load attendance history'); setHistoryRows([]) }
    }

    async function downloadHistory() {
        try {
            // Generate PDF client-side from currently loaded `historyRows` to ensure
            // download is always a PDF (no Excel/CSV).
            const doc = new jsPDF({ unit: 'pt', format: 'a4' })
            const title = `Attendance Report: ${historyQuery.from} → ${historyQuery.to}`
            doc.setFontSize(14)
            doc.text(title, 40, 40)
            const body = (historyRows || []).map(r => [String(r.date).slice(0, 10), (r.status || '').toUpperCase()])
            // add table starting below the title
            // Use the autoTable function directly to avoid augmentation issues
            autoTable(doc, { head: [['Date', 'Status']], body, startY: 60, styles: { fontSize: 10 } })
            const filename = `attendance_staff_${historyQuery.from || 'from'}_${historyQuery.to || 'to'}.pdf`
            doc.save(filename)
        } catch (e) { setMessage(e.message || 'Failed to download attendance') }
    }

    useEffect(() => {
        if (currentUserId && historyQuery.from && historyQuery.to) {
            loadHistory()
        }
    }, [currentUserId])

    return (
        <StaffLayout title="Attendance">
            <div className="parent-content-container">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-[var(--text-main)]">Attendance & Leaves</h2>
                    {(() => {
                        const todayRow = historyRows.find(h => h.date === today)
                        const st = todayRow ? todayRow.status : 'not-marked'
                        const label = st === 'not-marked' ? 'Not Marked' : (st || '').toUpperCase()
                        return (
                            <div className={`status-badge ${st} text-sm px-4 py-2`}>
                                Today: {label}
                            </div>
                        )
                    })()}
                </div>

                <div className="grid-2-cols">
                    {/* Left Column: Leave Request Form */}
                    <div className="staff-dashboard-card">
                        <h3 className="text-lg font-bold mb-4">Request Leave</h3>
                        <form onSubmit={requestLeave} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">From Date</label>
                                <input className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)]" type="date" name="from" value={form.from} onChange={onChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">To Date</label>
                                <input className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)]" type="date" name="to" value={form.to} onChange={onChange} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">Reason</label>
                                <textarea
                                    className="w-full p-2 rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] min-h-[100px]"
                                    name="reason"
                                    placeholder="Reason for leave"
                                    value={form.reason}
                                    onChange={onChange}
                                />
                            </div>
                            <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
                                {loading ? 'Submitting...' : 'Submit Leave Request'}
                            </button>
                        </form>
                        {message && <div className="mt-4 p-3 rounded bg-[var(--bg-surface)] text-sm text-[var(--text-main)] border border-[var(--border)]">{message}</div>}

                        <div className="mt-8">
                            <h3 className="text-lg font-bold mb-4">My Leave Requests</h3>
                            <div className="leaves-list flex flex-col gap-3">
                                {myLeaves.length === 0 && <div className="text-[var(--text-muted)] text-sm">No leaves submitted yet.</div>}
                                {myLeaves.map(l => (
                                    <div key={l._id || l.id} className={`p-3 rounded border border-[var(--border)] bg-[var(--bg-surface)] text-sm ${l.status === 'Approved' ? 'border-green-500/30' : ''}`}>
                                        <div className="flex justify-between font-semibold mb-1">
                                            <span>{String(l.from).slice(0, 10)} → {String(l.to).slice(0, 10)}</span>
                                            <span className={`status-badge ${l.status === 'Approved' ? 'present' : l.status === 'Rejected' ? 'absent' : 'pending'}`}>{l.status}</span>
                                        </div>
                                        <div className="text-[var(--text-muted)] mb-1">{l.reason}</div>
                                        {l.reviewNote && <div className="text-xs italic text-[var(--text-light)]">Note: {l.reviewNote}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: History */}
                    <div className="staff-dashboard-card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold m-0">Attendance History</h3>
                            <button className="btn-secondary text-sm px-3 py-1" type="button" onClick={downloadHistory}>Download PDF</button>
                        </div>

                        <div className="bg-[var(--bg-surface)] p-4 rounded-lg mb-4 border border-[var(--border)]">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="text-xs text-[var(--text-muted)] block mb-1">From</label>
                                    <input className="w-full text-sm p-1.5 rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)]" type="date" value={historyQuery.from} onChange={e => setHistoryQuery(q => ({ ...q, from: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--text-muted)] block mb-1">To</label>
                                    <input className="w-full text-sm p-1.5 rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)]" type="date" value={historyQuery.to} onChange={e => setHistoryQuery(q => ({ ...q, to: e.target.value }))} />
                                </div>
                            </div>
                            <button className="btn-primary w-full text-sm py-2" type="button" onClick={loadHistory}>Load History</button>
                        </div>

                        <div className="history-list max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                            {historyRows.length === 0 && <div className="text-center py-8 text-[var(--text-muted)]">No records for selected range.</div>}
                            {historyRows.map(h => (
                                <div key={`${h.date}`} className={`flex justify-between items-center p-3 rounded mb-2 border border-transparent ${h.status === 'present' ? 'row-present' : h.status === 'absent' ? 'row-absent' : 'row-pending'}`}>
                                    <strong className="text-sm font-medium">{String(h.date).slice(0, 10)}</strong>
                                    <span className={`status-badge ${h.status} text-xs`}>{String(h.status || '').toUpperCase()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </StaffLayout>
    )
}
