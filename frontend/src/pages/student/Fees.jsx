import React, { useEffect, useState } from 'react'
import { getFeeStructure, getFeeForClass, createRazorpayOrder, confirmPayment, getMyReceipts, getMyStudent, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'
import { useQueryClient } from '@tanstack/react-query'

export default function Fees() {
    const [fees, setFees] = useState({})
    const [receipts, setReceipts] = useState([])
    const [student, setStudent] = useState(null)
    const [selectedReceipt, setSelectedReceipt] = useState(null)
    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [paymentDraft, setPaymentDraft] = useState({ cls: '', term: '', amount: 0, name: '', email: '', rollNo: '' })

    async function load() {
        try {
            const { token } = getAuth()
            let studentRecord = null
            try {
                studentRecord = await getMyStudent(token)
                setStudent(studentRecord)
            } catch (err) { }

            const map = {}
            if (studentRecord && studentRecord.class) {
                const cls = String(studentRecord.class)
                try {
                    const entries = await getFeeForClass(cls, studentRecord.section || 'ALL', token)
                    if (entries && entries.length) map[cls] = entries[0]
                } catch (err) { console.warn('Failed to fetch fee for class', err) }
            } else {
                try {
                    const data = await getFeeStructure(token)
                    const grouped = {}
                        ; (data || []).forEach(f => { grouped[f.class] = grouped[f.class] || []; grouped[f.class].push(f) })
                    Object.keys(grouped).forEach(cls => {
                        const items = grouped[cls]
                        const all = items.find(x => x.section === 'ALL') || items[0]
                        map[cls] = all
                    })
                } catch (err) { console.warn('Failed to load all fee structure', err) }
            }

            setFees(map)
            const my = await getMyReceipts(token)
            setReceipts(my || [])
        } catch (e) { console.error(e) }
    }

    useEffect(() => { load() }, [])

    function isPaidForTerm(cls, term) {
        return receipts.some(r => (r.class === cls) && (r.term === term))
    }

    function parseYmd(s) {
        if (!s) return null
        try { const [y, m, d] = String(s).split('-').map(n => parseInt(n, 10)); if (!y || !m || !d) return null; return new Date(y, m - 1, d) } catch { return null }
    }
    function monthsBetween(a, b) {
        const years = b.getFullYear() - a.getFullYear();
        const months = years * 12 + (b.getMonth() - a.getMonth());
        return months + (b.getDate() > a.getDate() ? 1 : 0)
    }
    function daysBetween(a, b) {
        const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)
        return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
    }
    function calcFineForTerm(f, termLabel) {
        const today = new Date()
        const isT1 = termLabel === 'Term1'
        const dueStr = isT1 ? (f.term1DueDate || '') : (f.term2DueDate || '')
        const mode = isT1 ? (f.term1FineMode || 'none') : (f.term2FineMode || 'none')
        const rate = Number(isT1 ? (f.term1FineAmount || 0) : (f.term2FineAmount || 0))
        const due = parseYmd(dueStr)
        if (!due || !rate || mode === 'none') return 0
        if (today <= due) return 0
        if (mode === 'flat') return rate
        if (mode === 'per_day') return rate * daysBetween(new Date(due), new Date(today))
        if (mode === 'per_month') return rate * Math.max(1, monthsBetween(new Date(due), new Date(today)))
        return 0
    }

    function pay(cls, term, amount) {
        const auth = getAuth()
        setPaymentDraft({ cls, term, amount, name: student?.name || auth.username || '', email: student?.email || auth.username || '', rollNo: student?.rollNo || '' })
        setPaymentModalOpen(true)
    }

    async function startPayment() {
        try {
            const { token, sub, username } = getAuth()
            const { cls, term, amount, name, email, rollNo } = paymentDraft
            setPaymentModalOpen(false)
            const qc = useQueryClient()
            const order = await qc.fetchQuery(['createFeeOrder', cls, term, amount], () => createRazorpayOrder(amount, `fee_${cls}_${term}_${Date.now()}`, token))
            const runtimeKey = import.meta.env.VITE_RAZORPAY_KEY || ''

            async function loadRazorpaySdk() {
                if (typeof window === 'undefined') return false
                if (window.Razorpay) return true
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script')
                    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
                    script.async = true
                    script.onload = () => resolve(true)
                    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'))
                    document.body.appendChild(script)
                })
            }
            if (!runtimeKey) {
                alert('Razorpay key is not configured.')
                return
            }
            const options = {
                key: runtimeKey,
                amount: order.amount,
                currency: order.currency,
                name: 'ERP Fee Payment',
                description: `Fee for Class ${cls} ${term}`,
                order_id: order.id,
                prefill: { name: name || username, email: email || username },
                notes: { rollNo: rollNo || '' },
                handler: async function (response) {
                    try {
                        const payload = {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            studentId: student?._id || sub,
                            studentName: name || student?.name || username,
                            studentEmail: email || student?.email || username,
                            class: cls,
                            term,
                            amount
                        }
                        await qc.fetchQuery(['confirmFeePayment', response.razorpay_payment_id], () => confirmPayment(payload, token))
                        alert('Payment successful')
                        try { await qc.invalidateQueries(['myReceipts', token]) } catch (e) { }
                        await load()
                    } catch (err) { console.error(err); alert('Payment confirmation failed') }
                }
            }
            await loadRazorpaySdk()
            if (!window.Razorpay) { alert('Razorpay SDK not available.'); return }
            const rzp = new window.Razorpay(options)
            rzp.open()
        } catch (e) { console.error(e); alert('Payment failed to start') }
    }

    const classesToShow = student?.class ? [student.class] : Object.keys(fees)

    // ... helper functions
    function openReceipt(r) { setSelectedReceipt(r) }
    function closeReceipt() { setSelectedReceipt(null) }
    function closePaymentModal() { setPaymentModalOpen(false) }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <div>
                    <h3>Your Fees</h3>
                    <p className="text-muted">Manage and pay your term fees securely.</p>
                </div>
                {student && (
                    <div className="badge blue">
                        {student.name} • Class {student.class} {student.section ? `(${student.section})` : ''}
                    </div>
                )}
            </header>

            <main className="flex flex-col gap-6">
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {classesToShow.length === 0 && <div className="text-muted col-span-full">No fee data available.</div>}
                    {classesToShow.map(cls => {
                        const f = fees[cls]
                        if (!f) return null
                        return (
                            <div key={cls} className="card">
                                <h4 className="card-title mb-4">Class {cls}</h4>
                                <div className="flex flex-col gap-4">
                                    <div className="p-3 rounded bg-surface border border-subtle">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-semibold">Term 1</span>
                                            {isPaidForTerm(cls, 'Term1') ? <span className="badge green">Paid</span> : <span className="badge yellow">Due</span>}
                                        </div>
                                        {(() => {
                                            const base = Number(f.term1 || 0);
                                            const fine = isPaidForTerm(cls, 'Term1') ? 0 : calcFineForTerm(f, 'Term1');
                                            const total = base + fine;
                                            return (
                                                <>
                                                    <div className="text-2xl font-bold mb-2">₹{total}</div>
                                                    {fine > 0 && <div className="text-xs text-red-500 mb-2">Includes fine: ₹{fine}</div>}
                                                    {f.term1DueDate && <div className="text-xs text-muted mb-3">Due: {f.term1DueDate}</div>}
                                                    {isPaidForTerm(cls, 'Term1') ?
                                                        <button className="btn outline w-full" onClick={() => openReceipt(receipts.find(r => r.class === cls && r.term === 'Term1'))}>View Receipt</button>
                                                        : <button className="btn primary w-full" onClick={() => pay(cls, 'Term1', total)}>Pay Now</button>
                                                    }
                                                </>
                                            )
                                        })()}
                                    </div>

                                    <div className="p-3 rounded bg-surface border border-subtle">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-semibold">Term 2</span>
                                            {isPaidForTerm(cls, 'Term2') ? <span className="badge green">Paid</span> : <span className="badge yellow">Due</span>}
                                        </div>
                                        {(() => {
                                            const base = Number(f.term2 || 0);
                                            const fine = isPaidForTerm(cls, 'Term2') ? 0 : calcFineForTerm(f, 'Term2');
                                            const total = base + fine;
                                            return (
                                                <>
                                                    <div className="text-2xl font-bold mb-2">₹{total}</div>
                                                    {fine > 0 && <div className="text-xs text-red-500 mb-2">Includes fine: ₹{fine}</div>}
                                                    {f.term2DueDate && <div className="text-xs text-muted mb-3">Due: {f.term2DueDate}</div>}
                                                    {isPaidForTerm(cls, 'Term2') ?
                                                        <button className="btn outline w-full" onClick={() => openReceipt(receipts.find(r => r.class === cls && r.term === 'Term2'))}>View Receipt</button>
                                                        : <button className="btn primary w-full" onClick={() => pay(cls, 'Term2', total)}>Pay Now</button>
                                                    }
                                                </>
                                            )
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </section>

                <section className="card">
                    <h4 className="card-title mb-4">Payment History</h4>
                    <div className="overflow-x-auto">
                        {receipts.length === 0 ? <div className="text-muted">No payments found.</div> : (
                            <table className="student-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Class</th>
                                        <th>Term</th>
                                        <th>Amount</th>
                                        <th>Payment ID</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receipts.map(r => (
                                        <tr key={r._id}>
                                            <td>{new Date(r.createdAt || r.date || Date.now()).toLocaleDateString()}</td>
                                            <td>{r.class}</td>
                                            <td>{r.term}</td>
                                            <td>₹{r.amount}</td>
                                            <td className="font-mono text-xs">{r.razorpayPaymentId || '-'}</td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <button className="btn outline sm" onClick={() => openReceipt(r)}>View</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </main>

            {/* Modals remain mostly same but using card classes */}
            {paymentModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closePaymentModal}>
                    <div className="bg-card p-6 rounded-xl w-full max-w-md border border-subtle" onClick={e => e.stopPropagation()}>
                        <h4 className="text-lg font-bold mb-4 text-main">Confirm Payment</h4>
                        <div className="grid gap-4 mb-6">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-muted">Name</label>
                                <input className="p-2 border border rounded bg-main text-main" value={paymentDraft.name} onChange={e => setPaymentDraft(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-muted">Email</label>
                                <input className="p-2 border border rounded bg-main text-main" value={paymentDraft.email} onChange={e => setPaymentDraft(p => ({ ...p, email: e.target.value }))} />
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-muted">Amount</label>
                                <input className="p-2 border border rounded bg-main text-main" value={paymentDraft.amount} readOnly />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button className="btn outline" onClick={closePaymentModal}>Cancel</button>
                            <button className="btn primary" onClick={startPayment}>Pay Now</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedReceipt && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeReceipt}>
                    <div className="bg-card p-6 rounded-xl w-full max-w-md border border-subtle relative" onClick={e => e.stopPropagation()}>
                        <button className="absolute top-4 right-4 text-muted hover:text-main" onClick={closeReceipt}>✕</button>
                        <h4 className="text-lg font-bold mb-4 text-main">Receipt</h4>
                        <div className="grid gap-3 mb-6 text-sm text-main">
                            <div><span className="font-semibold text-muted">Student:</span> {selectedReceipt.studentName}</div>
                            <div><span className="font-semibold text-muted">Class/Term:</span> {selectedReceipt.class} / {selectedReceipt.term}</div>
                            <div><span className="font-semibold text-muted">Amount:</span> ₹{selectedReceipt.amount}</div>
                            <div className="font-mono text-xs bg-surface p-2 rounded">{selectedReceipt.razorpayPaymentId}</div>
                        </div>
                        <div className="flex justify-end">
                            <button className="btn outline" onClick={async () => {
                                // download logic (simplified reuse)
                                try {
                                    const r = selectedReceipt
                                    const href = (r.pdfUrl || r.pdfPath || '')
                                    if (!href) return alert('No receipt file')
                                    const url = href.startsWith('http') ? href : `${API_BASE}${href}`
                                    window.open(url, '_blank')
                                } catch (e) { alert('Download failed') }
                            }}>Download PDF</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
