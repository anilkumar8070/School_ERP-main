import React, { useState } from 'react'
import { getMySalaryPayments } from '../api'
import { getAuth } from '../utils/session'
import FacultyLayout from '../components/faculty/FacultyLayout'
// css removed
import { useQuery, useMutation } from '@tanstack/react-query'

export default function FacultySalary() {
    const [error, setError] = useState('')
    const { token } = getAuth()

    const { data: payments = [], isLoading } = useQuery({ queryKey: ['mySalaryPayments', token], queryFn: () => getMySalaryPayments(token), enabled: !!token, onError: (err) => setError(err?.message || 'Failed to load') })

    const downloadMutation = useMutation({
        mutationFn: async ({ id }) => {
            const { token } = getAuth()
            const base = (import.meta.env.VITE_API_BASE || '')
            const htmlRes = await fetch(`${base}/api/salary/receipt/${id}`, { headers: { Authorization: `Bearer ${token}` } })
            if (!htmlRes.ok) {
                const err = await htmlRes.json().catch(() => ({ message: 'Download failed' }))
                throw new Error(err.message || 'Download failed')
            }
            const html = await htmlRes.text()
            const blob = new Blob([html], { type: 'text/html' })
            return { blob }
        },
        onSuccess: ({ blob }) => {
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
        },
        onError: (err) => setError(err?.message || 'Failed to download receipt')
    })

    function downloadReceipt(id) {
        downloadMutation.mutate({ id })
    }

    return (
        <FacultyLayout title="Salary">
            <div className="faculty-page">
                <h2>My Salary</h2>
                {error && <div className="error" style={{ color: 'var(--text-muted)', marginBottom: 12 }}>{error}</div>}

                <div className="table-container">
                    <table className="data-table">
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
                                <tr key={p._id}>
                                    <td>{p.receiptNo || '-'}</td>
                                    <td>{p.month}</td>
                                    <td>₹{p.amount}</td>
                                    <td>
                                        <span className={`status-badge ${p.status === 'paid' ? 'paid' : 'pending'}`}>
                                            {p.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        {p.status === 'paid' ? (
                                            <button className="action-btn" type="button" onClick={() => downloadReceipt(p._id, p.receiptNo)}>Download Receipt</button>
                                        ) : (
                                            <span style={{ opacity: 0.7, fontSize: 13, color: 'var(--text-muted)' }}>Pending</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {payments.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No salary records found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </FacultyLayout>
    )
}
