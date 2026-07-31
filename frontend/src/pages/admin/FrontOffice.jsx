import React, { useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getFrontOfficeEntries, createFrontOfficeEntry } from '../../api'
import { getAuth } from '../../utils/session'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

export default function FrontOffice() {
    const { token } = getAuth()
    const qc = useQueryClient()
    
    const [visitorName, setVisitorName] = useState('')
    const [purpose, setPurpose] = useState('')
    const [host, setHost] = useState('')
    const [checkOutTime, setCheckOutTime] = useState('')
    const [status, setStatus] = useState('In')
    const [notes, setNotes] = useState('')

    const { data: entries = [], isLoading } = useQuery({
        queryKey: ['frontOffice', token],
        queryFn: () => getFrontOfficeEntries(token),
        enabled: !!token
    })

    const createMutation = useMutation({
        mutationFn: (payload) => createFrontOfficeEntry(payload, token),
        onSuccess: () => {
            toast.success('Entry created successfully')
            setVisitorName(''); setPurpose(''); setHost(''); setCheckOutTime(''); setNotes('')
            try { qc.invalidateQueries(['frontOffice', token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to create entry')
    })

    function onSubmit(e) {
        e.preventDefault()
        if (!visitorName) return toast.error('Visitor name is required')
        
        const payload = {
            visitorName, purpose, host, status, notes
        }
        if (checkOutTime) payload.checkOutTime = checkOutTime
        
        createMutation.mutate(payload)
    }

    return (
        <AdminLayout title="Front Office">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Front Office Management</h2>
                </header>

                <div className="admin-card">
                    <form onSubmit={onSubmit} className="admin-form-grid">
                        <div className="form-group">
                            <label>Visitor Name</label>
                            <input className="admin-input" value={visitorName} onChange={e => setVisitorName(e.target.value)} placeholder="Name" required />
                        </div>
                        <div className="form-group">
                            <label>Purpose</label>
                            <input className="admin-input" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Purpose of visit" />
                        </div>
                        <div className="form-group">
                            <label>Host (Faculty/Staff)</label>
                            <input className="admin-input" value={host} onChange={e => setHost(e.target.value)} placeholder="Host Name" />
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select className="admin-select" value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="In">In</option>
                                <option value="Out">Out</option>
                            </select>
                        </div>
                        {status === 'Out' && (
                            <div className="form-group">
                                <label>Check-out Time</label>
                                <input className="admin-input" type="datetime-local" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} />
                            </div>
                        )}
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Notes</label>
                            <textarea className="admin-input" value={notes} onChange={e => setNotes(e.target.value)} rows="2" placeholder="Any additional notes" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn-primary" disabled={createMutation.isLoading}>
                                {createMutation.isLoading ? 'Saving...' : 'Add Entry'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <h3>Visitor Logs</h3>
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Date/Time In</th>
                                    <th>Visitor</th>
                                    <th>Purpose</th>
                                    <th>Host</th>
                                    <th>Status</th>
                                    <th>Time Out</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>}
                                {!isLoading && entries.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }} className="empty-state">No entries found</td></tr>
                                )}
                                {!isLoading && entries.map(entry => (
                                    <tr key={entry._id}>
                                        <td>{new Date(entry.checkInTime).toLocaleString()}</td>
                                        <td>{entry.visitorName}</td>
                                        <td>{entry.purpose || '-'}</td>
                                        <td>{entry.host || '-'}</td>
                                        <td>
                                            <span className={`badge ${entry.status === 'In' ? 'green' : 'gray'}`}>
                                                {entry.status}
                                            </span>
                                        </td>
                                        <td>{entry.checkOutTime ? new Date(entry.checkOutTime).toLocaleString() : '-'}</td>
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
