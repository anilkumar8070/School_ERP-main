import React, { useState, useEffect } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getStudents, getBehaviorRecords, addBehaviorRecord } from '../../api'
import { getAuth } from '../../utils/session'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

export default function BehaviorRecordsAdmin() {
    const { token } = getAuth()
    const qc = useQueryClient()
    
    const [searchQuery, setSearchQuery] = useState('')
    const [students, setStudents] = useState([])
    const [selectedStudent, setSelectedStudent] = useState(null)
    
    // Form state
    const [type, setType] = useState('Positive')
    const [description, setDescription] = useState('')
    const [date, setDate] = useState('')
    const [actionTaken, setActionTaken] = useState('')

    const { data: records = [], isLoading } = useQuery({
        queryKey: ['behaviorRecords', selectedStudent?._id, token],
        queryFn: () => getBehaviorRecords(selectedStudent._id, token),
        enabled: !!selectedStudent && !!token
    })

    const addMutation = useMutation({
        mutationFn: (payload) => addBehaviorRecord(payload, token),
        onSuccess: () => {
            toast.success('Record added successfully')
            setDescription(''); setDate(''); setActionTaken('')
            try { qc.invalidateQueries(['behaviorRecords', selectedStudent?._id, token]) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to add record')
    })

    // Debounced student search
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) {
            setStudents([])
            return
        }
        const timer = setTimeout(async () => {
            try {
                const list = await getStudents({ search: searchQuery }, token)
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
        if (!description || !date) return toast.error('Description and date are required')
        
        addMutation.mutate({
            studentId: selectedStudent._id,
            type, description, date, actionTaken
        })
    }

    return (
        <AdminLayout title="Behavior Records">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Behavior Records</h2>
                </header>

                <div className="admin-card">
                    <div className="admin-form-grid" style={{ marginBottom: '20px' }}>
                        <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
                            <label>Search and Select Student *</label>
                            {selectedStudent ? (
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div className="admin-input" style={{ backgroundColor: 'var(--surface)', flex: 1 }}>
                                        {selectedStudent.name} (Class {selectedStudent.class}) - {selectedStudent.rollNo || selectedStudent.email}
                                    </div>
                                    <button type="button" className="btn-secondary" onClick={() => setSelectedStudent(null)}>Change Student</button>
                                </div>
                            ) : (
                                <div>
                                    <input 
                                        className="admin-input" 
                                        value={searchQuery} 
                                        onChange={e => setSearchQuery(e.target.value)} 
                                        placeholder="Type name or roll number..." 
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
                    </div>

                    {selectedStudent && (
                        <form onSubmit={onSubmit} className="admin-form-grid" style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                            <h3 style={{ gridColumn: '1 / -1', marginBottom: '10px' }}>Add Incident / Remark</h3>
                            <div className="form-group">
                                <label>Type</label>
                                <select className="admin-select" value={type} onChange={e => setType(e.target.value)}>
                                    <option value="Positive">Positive</option>
                                    <option value="Minor Infraction">Minor Infraction</option>
                                    <option value="Major Infraction">Major Infraction</option>
                                    <option value="Warning">Warning</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Date *</label>
                                <input className="admin-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Description *</label>
                                <textarea className="admin-input" value={description} onChange={e => setDescription(e.target.value)} rows="2" required />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Action Taken (optional)</label>
                                <textarea className="admin-input" value={actionTaken} onChange={e => setActionTaken(e.target.value)} rows="1" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <button type="submit" className="btn-primary" disabled={addMutation.isLoading}>
                                    {addMutation.isLoading ? 'Adding...' : 'Add Record'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {selectedStudent && (
                    <div className="admin-card">
                        <h3>Behavior History for {selectedStudent.name}</h3>
                        <div className="table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                        <th>Action Taken</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading && <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>}
                                    {!isLoading && records.length === 0 && (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }} className="empty-state">No behavior records found</td></tr>
                                    )}
                                    {!isLoading && records.map(record => (
                                        <tr key={record._id}>
                                            <td>{new Date(record.date).toLocaleDateString()}</td>
                                            <td>
                                                <span className={`badge ${record.type === 'Positive' ? 'green' : record.type === 'Warning' ? 'yellow' : 'red'}`}>
                                                    {record.type}
                                                </span>
                                            </td>
                                            <td>{record.description}</td>
                                            <td>{record.actionTaken || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
