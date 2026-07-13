import React, { useEffect, useState } from 'react'
import { API_BASE, getMyStaffSalaryPayments } from '../api'
import { getAuth } from '../utils/session'
import StaffLayout from '../components/staff/StaffLayout'
import './AdminSalary.css'

export default function StaffSalary() {
    const [payments, setPayments] = useState([])
    const [error, setError] = useState('')

    async function load() {
        setError('')
        try {
            const { token } = getAuth()
            const list = await getMyStaffSalaryPayments(token)
            setPayments(list || [])
        } catch (e) { setError(e?.message || 'Failed to load') }
    }
    useEffect(() => { load() }, [])

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
        <StaffLayout title="Staff Salary">
            <div className="staff-salary-page">
                <h2>My Staff Salary</h2>
                {error && <div className="error">{error}</div>}
                <table className="payments-table colorful">
                    <thead>
                        <tr>
                            <th>Receipt</th>
                            <th>Month</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payments.map(p => (
                            <tr key={p._id} className={p.status === 'paid' ? 'row-paid' : 'row-pending'}>
                                <td>{p.receiptNo || '-'}</td>
                                <td>{p.month}</td>
                                <td>₹{p.amount}</td>
                                <td>{p.status}</td>
                                <td>
                                    {p.status === 'paid' ? (
                                        <button type="button" onClick={() => downloadReceipt(p._id, p.receiptNo)}>Download Receipt (PDF)</button>
                                    ) : (
                                        <span style={{ opacity: 0.7 }}>Pending</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </StaffLayout>
    )
}
