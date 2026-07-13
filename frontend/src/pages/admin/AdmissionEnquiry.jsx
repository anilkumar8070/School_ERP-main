import React, { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getAdmissionEnquiries, createAdmissionEnquiry, updateAdmissionEnquiry } from '../../api'
import { getAuth } from '../../utils/session'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

export default function AdmissionEnquiry() {
    const { token } = getAuth()
    const qc = useQueryClient()
    
    const [applicantName, setApplicantName] = useState('')
    const [parentName, setParentName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [classApplying, setClassApplying] = useState('')
    const [notes, setNotes] = useState('')

    const { data: enquiries = [], isLoading } = useQuery({
        queryKey: ['admissionEnquiries', token],
        queryFn: () => getAdmissionEnquiries(token),
        enabled: !!token
    })

    const createMutation = useMutation({
        mutationFn: (payload) => createAdmissionEnquiry(payload, token),
        onSuccess: () => {
            toast.success('Enquiry added successfully')
            setApplicantName(''); setParentName(''); setPhone(''); setEmail(''); setClassApplying(''); setNotes('')
            try { qc.invalidateQueries(['admissionEnquiries', token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to add enquiry')
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }) => updateAdmissionEnquiry(id, payload, token),
        onSuccess: () => {
            toast.success('Enquiry updated')
            try { qc.invalidateQueries(['admissionEnquiries', token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to update enquiry')
    })

    function onSubmit(e) {
        e.preventDefault()
        if (!applicantName || !parentName || !phone || !classApplying) {
            return toast.error('Please fill all required fields')
        }
        createMutation.mutate({ applicantName, parentName, phone, email, classApplying, notes })
    }

    function handleStatusChange(id, status) {
        updateMutation.mutate({ id, payload: { status } })
    }

    return (
        <AdminLayout title="Admission Enquiry">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Admission Enquiries</h2>
                </header>

                <div className="admin-card">
                    <form onSubmit={onSubmit} className="admin-form-grid">
                        <div className="form-group">
                            <label>Applicant Name *</label>
                            <input className="admin-input" value={applicantName} onChange={e => setApplicantName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Parent Name *</label>
                            <input className="admin-input" value={parentName} onChange={e => setParentName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Phone *</label>
                            <input className="admin-input" value={phone} onChange={e => setPhone(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input className="admin-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Class Applying For *</label>
                            <input className="admin-input" value={classApplying} onChange={e => setClassApplying(e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Notes</label>
                            <textarea className="admin-input" value={notes} onChange={e => setNotes(e.target.value)} rows="2" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn-primary" disabled={createMutation.isLoading}>
                                {createMutation.isLoading ? 'Adding...' : 'Add Enquiry'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <h3>Enquiry List</h3>
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Applicant</th>
                                    <th>Parent details</th>
                                    <th>Class</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>}
                                {!isLoading && enquiries.length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }} className="empty-state">No enquiries found</td></tr>
                                )}
                                {!isLoading && enquiries.map(enq => (
                                    <tr key={enq._id}>
                                        <td>{new Date(enq.enquiryDate).toLocaleDateString()}</td>
                                        <td>{enq.applicantName}</td>
                                        <td>
                                            <div>{enq.parentName}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{enq.phone} {enq.email ? `• ${enq.email}` : ''}</div>
                                        </td>
                                        <td>{enq.classApplying}</td>
                                        <td>
                                            <select 
                                                className="admin-select" 
                                                value={enq.status} 
                                                onChange={e => handleStatusChange(enq._id, e.target.value)}
                                                style={{ padding: '4px 8px', fontSize: '0.9rem' }}
                                                disabled={updateMutation.isLoading}
                                            >
                                                <option value="New">New</option>
                                                <option value="Follow-up">Follow-up</option>
                                                <option value="Enrolled">Enrolled</option>
                                                <option value="Dropped">Dropped</option>
                                            </select>
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
