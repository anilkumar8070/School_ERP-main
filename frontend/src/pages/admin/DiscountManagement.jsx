import React, { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getStudents, getDiscounts, createDiscount, deleteDiscount } from '../../api'
import { getAuth } from '../../utils/session'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

export default function DiscountManagement() {
    const { token } = getAuth()
    const qc = useQueryClient()
    
    // Form state
    const [searchQuery, setSearchQuery] = useState('')
    const [students, setStudents] = useState([])
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [type, setType] = useState('Sibling')
    const [amountType, setAmountType] = useState('flat')
    const [amount, setAmount] = useState('')
    const [term, setTerm] = useState('Both')
    const [reason, setReason] = useState('')

    const { data: discounts = [], isLoading } = useQuery({
        queryKey: ['discounts', token],
        queryFn: () => getDiscounts(token),
        enabled: !!token
    })

    const createMutation = useMutation({
        mutationFn: (payload) => createDiscount(payload, token),
        onSuccess: () => {
            toast.success('Discount applied successfully')
            setSelectedStudent(null); setSearchQuery(''); setAmount(''); setReason('');
            try { qc.invalidateQueries(['discounts', token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to apply discount')
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => deleteDiscount(id, token),
        onSuccess: () => {
            toast.success('Discount removed')
            try { qc.invalidateQueries(['discounts', token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to remove discount')
    })

    // Debounced student search
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) {
            setStudents([])
            return
        }
        const timer = setTimeout(async () => {
            try {
                const list = await getStudents({ search: searchQuery }, token) // or name: searchQuery
                setStudents(Array.isArray(list) ? list : [])
            } catch (e) {
                console.warn('Failed to fetch students', e)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery, token])

    function onSubmit(e) {
        e.preventDefault()
        if (!selectedStudent) return toast.error('Please select a student')
        if (!amount) return toast.error('Amount is required')
        
        createMutation.mutate({
            studentId: selectedStudent._id,
            studentName: selectedStudent.name,
            type, amountType, amount: Number(amount), term, reason
        })
    }

    return (
        <AdminLayout title="Discount Management">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Discount Management</h2>
                </header>

                <div className="admin-card">
                    <form onSubmit={onSubmit} className="admin-form-grid">
                        <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
                            <label>Select Student *</label>
                            {selectedStudent ? (
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div className="admin-input" style={{ backgroundColor: 'var(--surface)', flex: 1 }}>
                                        {selectedStudent.name} (Class {selectedStudent.class})
                                    </div>
                                    <button type="button" className="btn-secondary" onClick={() => setSelectedStudent(null)}>Change</button>
                                </div>
                            ) : (
                                <div>
                                    <input 
                                        className="admin-input" 
                                        value={searchQuery} 
                                        onChange={e => setSearchQuery(e.target.value)} 
                                        placeholder="Type at least 2 characters to search by name/email/rollNo..." 
                                    />
                                    {students.length > 0 && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                                            {students.map(st => (
                                                <div 
                                                    key={st._id} 
                                                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                                                    onClick={() => { setSelectedStudent(st); setStudents([]); setSearchQuery('') }}
                                                >
                                                    {st.name} - Class {st.class || '-'} ({st.rollNo || st.email})
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Discount Type</label>
                            <select className="admin-select" value={type} onChange={e => setType(e.target.value)}>
                                <option value="Sibling">Sibling</option>
                                <option value="Merit">Merit</option>
                                <option value="Staff Ward">Staff Ward</option>
                                <option value="Custom">Custom</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Applicable Term</label>
                            <select className="admin-select" value={term} onChange={e => setTerm(e.target.value)}>
                                <option value="Term1">Term 1</option>
                                <option value="Term2">Term 2</option>
                                <option value="Both">Both Terms</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Amount Type</label>
                            <select className="admin-select" value={amountType} onChange={e => setAmountType(e.target.value)}>
                                <option value="flat">Flat Amount (₹)</option>
                                <option value="percentage">Percentage (%)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Amount *</label>
                            <input className="admin-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Reason / Notes</label>
                            <textarea className="admin-input" value={reason} onChange={e => setReason(e.target.value)} rows="2" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn-primary" disabled={createMutation.isLoading || !selectedStudent}>
                                {createMutation.isLoading ? 'Applying...' : 'Apply Discount'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <h3>Active Discounts</h3>
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Student</th>
                                    <th>Type</th>
                                    <th>Term</th>
                                    <th>Amount</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>}
                                {!isLoading && discounts.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }} className="empty-state">No discounts found</td></tr>
                                )}
                                {!isLoading && discounts.map(d => (
                                    <tr key={d._id}>
                                        <td>{new Date(d.createdAt).toLocaleDateString()}</td>
                                        <td>{d.studentName}</td>
                                        <td>{d.type}</td>
                                        <td>{d.term}</td>
                                        <td>{d.amountType === 'percentage' ? `${d.amount}%` : `₹${d.amount}`}</td>
                                        <td>
                                            <button 
                                                className="btn-secondary" 
                                                style={{ color: 'var(--error)' }}
                                                onClick={() => { if(window.confirm('Remove this discount?')) deleteMutation.mutate(d._id) }}
                                                disabled={deleteMutation.isLoading}
                                            >
                                                Remove
                                            </button>
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
