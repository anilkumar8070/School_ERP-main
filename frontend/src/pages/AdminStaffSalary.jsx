import React, { useEffect, useState } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import '../pages/AdminPanel.css'
import { API_BASE, getStaffList, getStaffSalaryPayments, createStaffSalaryOrder, confirmStaffSalaryPayment } from '../api'
import { getAuth } from '../utils/session'

function formatStaffId(staff) {
    if (!staff) return ''
    const eid = (staff.employeeId || '').toString().trim()
    if (eid && /^s/i.test(eid)) return eid
    const mongoId = (staff._id || '').toString()
    if (!mongoId) return ''
    const tail = mongoId.slice(-6).toUpperCase()
    return `STF-${tail}`
}

export default function AdminStaffSalary() {
    const [staffList, setStaffList] = useState([])
    const [payments, setPayments] = useState([])
    const [form, setForm] = useState({ staffId: '', month: '', amount: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function load() {
        setError('')
        try {
            const { token } = getAuth()
            const [staff, pays] = await Promise.all([
                getStaffList(token),
                getStaffSalaryPayments(token),
            ])
            setStaffList(Array.isArray(staff) ? staff : [])
            setPayments(Array.isArray(pays) ? pays : [])
        } catch (e) { setError(e?.message || 'Failed to load staff') }
    }
    useEffect(() => { load() }, [])

    function onChange(e) { const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value })) }

    async function loadRazorpayScript() {
        return new Promise((resolve) => {
            if (window.Razorpay) return resolve(true)
            const s = document.createElement('script')
            s.src = 'https://checkout.razorpay.com/v1/checkout.js'
            s.onload = () => resolve(true)
            s.onerror = () => resolve(false)
            document.body.appendChild(s)
        })
    }

    async function onPay() {
        setLoading(true); setError('')
        try {
            const amountNum = Number(form.amount)
            if (!form.staffId || !form.month || !amountNum) throw new Error('Select staff, month and amount')
            const { token } = getAuth()
            const orderResp = await createStaffSalaryOrder({ userId: form.staffId, month: form.month, amount: amountNum }, token)
            const loaded = await loadRazorpayScript()
            const keyId = (import.meta.env.VITE_RAZORPAY_KEY_ID || '').trim()
            if (!keyId) {
                setError('Razorpay key missing in frontend env (VITE_RAZORPAY_KEY_ID).')
                return
            }
            if (loaded && window.Razorpay && orderResp && orderResp.order) {
                const options = {
                    key: keyId,
                    amount: orderResp.order.amount,
                    currency: orderResp.order.currency || 'INR',
                    name: 'ERP Admin',
                    description: `Salary for ${orderResp.staff?.name || ''} - ${form.month}`,
                    order_id: orderResp.order.id,
                    prefill: { name: orderResp.staff?.name || 'Staff', email: orderResp.staff?.email || '' },
                    notes: { userId: orderResp.staff?.id, month: form.month },
                    handler: async function (resp) {
                        try {
                            const confirmed = await confirmStaffSalaryPayment({ userId: form.staffId, month: form.month, amount: amountNum, orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }, token)
                            setPayments(prev => [confirmed, ...prev])
                            setForm(prev => ({ ...prev, amount: '' }))
                        } catch (e) { setError(e?.message || 'Payment confirm failed') }
                    },
                    modal: { ondismiss: function () { } },
                    method: { card: true, netbanking: true, wallet: true, upi: true },
                    theme: { color: '#7c3aed' },
                }
                const rzp = new window.Razorpay(options)
                rzp.on('payment.failed', function (resp) {
                    setError(resp?.error?.description || 'Payment failed')
                })
                rzp.open()
            } else {
                setError('Failed to initiate payment')
            }
        } catch (e) { setError(e?.message || 'Payment failed') }
        finally { setLoading(false) }
    }

    async function downloadReceipt(id) {
        try {
            const { token } = getAuth()
            const htmlUrl = `${API_BASE}/api/staff-salary/receipt/${id}?token=${encodeURIComponent(token)}`
            window.open(htmlUrl, '_blank')
        } catch (e) {
            setError(e?.message || 'Failed to open receipt')
        }
    }

    return (
        <AdminLayout title="Staff Salary">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Staff Salary Payment</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Process and manage staff salary payments.</p>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ alignItems: 'end' }}>
                        <div className="form-group">
                            <label>Staff</label>
                            <select className="admin-select" name="staffId" value={form.staffId} onChange={onChange}>
                                <option value="">Select staff</option>
                                {staffList.map(s => <option key={s._id} value={s._id}>{s.name} ({formatStaffId(s) || 'N/A'})</option>)}
                            </select>
                        </div>
                        {form.staffId && (
                            <div className="form-group" style={{ alignSelf: 'center', marginBottom: 12 }}>
                                <span className="status-badge status-info">ID: {(() => { const st = staffList.find(x => String(x._id) === String(form.staffId)); return formatStaffId(st) })()}</span>
                            </div>
                        )}
                        <div className="form-group">
                            <label>Month</label>
                            <input className="admin-input" name="month" placeholder="e.g. December 2025" value={form.month} onChange={onChange} />
                        </div>
                        <div className="form-group">
                            <label>Amount (₹)</label>
                            <input className="admin-input" name="amount" type="number" value={form.amount} onChange={onChange} />
                        </div>
                        <button className="btn-primary" disabled={loading} onClick={onPay}>{loading ? 'Paying…' : 'Mark as Paid'}</button>
                    </div>
                    {error && <div className="error-message" style={{ marginTop: 10, color: 'var(--danger-color)' }}>{error}</div>}
                </div>

                <div className="admin-card">
                    <h3>Payment History</h3>
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Receipt</th>
                                    <th>Staff</th>
                                    <th>Month</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No payment history found.</td></tr>}
                                {payments.map(p => (
                                    <tr key={p._id}>
                                        <td>{p.receiptNo || '-'}</td>
                                        <td>{p.staffName || p.userId}</td>
                                        <td>{p.month}</td>
                                        <td>₹{p.amount}</td>
                                        <td><span className={`status-badge ${p.status === 'paid' ? 'status-success' : 'status-warning'}`}>{p.status}</span></td>
                                        <td>
                                            {p.status === 'paid' ? (
                                                <button className="btn-secondary" onClick={() => downloadReceipt(p._id)}>Download Receipt</button>
                                            ) : (
                                                <span style={{ opacity: 0.7 }}>Pending</span>
                                            )}
                                        </td>
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
