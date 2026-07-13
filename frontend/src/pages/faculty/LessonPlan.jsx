import React, { useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import '../../pages/AdminPanel.css'
import { getLessonPlans, addLessonPlan } from '../../api'
import { getAuth } from '../../utils/session'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'

export default function LessonPlan() {
    const { token } = getAuth()
    const qc = useQueryClient()
    
    // Filter state
    const [filterClass, setFilterClass] = useState('')
    const [filterSubject, setFilterSubject] = useState('')

    // Form state
    const [classVal, setClassVal] = useState('')
    const [section, setSection] = useState('')
    const [subject, setSubject] = useState('')
    const [title, setTitle] = useState('')
    const [lessonDate, setLessonDate] = useState('')
    const [durationMinutes, setDurationMinutes] = useState('')
    const [objectives, setObjectives] = useState('')
    const [materials, setMaterials] = useState('')
    const [activities, setActivities] = useState('')
    const [homework, setHomework] = useState('')
    const [assessment, setAssessment] = useState('')
    const [status, setStatus] = useState('Draft')
    const [notes, setNotes] = useState('')

    const { data: plans = [], isLoading } = useQuery({
        queryKey: ['lessonPlans', filterClass, filterSubject, token],
        queryFn: () => getLessonPlans({ class: filterClass, subject: filterSubject }, token),
        enabled: !!token
    })

    const addMutation = useMutation({
        mutationFn: (payload) => addLessonPlan(payload, token),
        onSuccess: () => {
            toast.success('Lesson plan created successfully')
            setClassVal(''); setSection(''); setSubject(''); setTitle(''); setLessonDate('');
            setDurationMinutes(''); setObjectives(''); setMaterials(''); setActivities('');
            setHomework(''); setAssessment(''); setStatus('Draft'); setNotes('');
            try { qc.invalidateQueries(['lessonPlans']) } catch(e){}
        },
        onError: (err) => toast.error(err.message || 'Failed to create lesson plan')
    })

    function onSubmit(e) {
        e.preventDefault()
        if (!classVal || !subject || !title || !lessonDate) {
            return toast.error('Class, Subject, Title and Date are required')
        }
        
        addMutation.mutate({
            class: classVal, section, subject, title, lessonDate, 
            durationMinutes: Number(durationMinutes) || 0, 
            objectives, materials, activities, homework, assessment, status, notes
        })
    }

    return (
        <FacultyLayout title="Lesson Planning">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Lesson Planning</h2>
                </header>

                <div className="admin-card">
                    <form onSubmit={onSubmit} className="admin-form-grid">
                        <h3 style={{ gridColumn: '1 / -1', marginBottom: '10px' }}>Create Lesson Plan</h3>
                        <div className="form-group">
                            <label>Class *</label>
                            <input className="admin-input" value={classVal} onChange={e => setClassVal(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Section</label>
                            <input className="admin-input" value={section} onChange={e => setSection(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Subject *</label>
                            <input className="admin-input" value={subject} onChange={e => setSubject(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Lesson Title *</label>
                            <input className="admin-input" value={title} onChange={e => setTitle(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Date *</label>
                            <input className="admin-input" type="date" value={lessonDate} onChange={e => setLessonDate(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Duration (Minutes)</label>
                            <input className="admin-input" type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Objectives</label>
                            <textarea className="admin-input" value={objectives} onChange={e => setObjectives(e.target.value)} rows="2" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Materials Needed</label>
                            <textarea className="admin-input" value={materials} onChange={e => setMaterials(e.target.value)} rows="1" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Activities</label>
                            <textarea className="admin-input" value={activities} onChange={e => setActivities(e.target.value)} rows="2" />
                        </div>
                        <div className="form-group">
                            <label>Homework</label>
                            <input className="admin-input" value={homework} onChange={e => setHomework(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Assessment</label>
                            <input className="admin-input" value={assessment} onChange={e => setAssessment(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select className="admin-select" value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="Draft">Draft</option>
                                <option value="Approved">Approved</option>
                                <option value="Completed">Completed</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label>Notes</label>
                            <textarea className="admin-input" value={notes} onChange={e => setNotes(e.target.value)} rows="1" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="btn-primary" disabled={addMutation.isLoading}>
                                {addMutation.isLoading ? 'Saving...' : 'Create Lesson Plan'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="admin-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3>My Lesson Plans</h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input 
                                className="admin-input" 
                                placeholder="Filter by Class" 
                                value={filterClass}
                                onChange={e => setFilterClass(e.target.value)}
                                style={{ padding: '4px 8px', minHeight: '32px' }}
                            />
                            <input 
                                className="admin-input" 
                                placeholder="Filter by Subject" 
                                value={filterSubject}
                                onChange={e => setFilterSubject(e.target.value)}
                                style={{ padding: '4px 8px', minHeight: '32px' }}
                            />
                        </div>
                    </div>
                    
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Class & Subject</th>
                                    <th>Title</th>
                                    <th>Objectives</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>}
                                {!isLoading && plans.length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }} className="empty-state">No lesson plans found</td></tr>
                                )}
                                {!isLoading && plans.map(plan => (
                                    <tr key={plan._id}>
                                        <td>{new Date(plan.lessonDate).toLocaleDateString()}</td>
                                        <td>
                                            <div style={{ fontWeight: 'bold' }}>{plan.class} {plan.section ? `(${plan.section})` : ''}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{plan.subject}</div>
                                        </td>
                                        <td>{plan.title}</td>
                                        <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {plan.objectives || '-'}
                                        </td>
                                        <td>
                                            <span className={`badge ${plan.status === 'Completed' ? 'green' : plan.status === 'Approved' ? 'blue' : 'gray'}`}>
                                                {plan.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </FacultyLayout>
    )
}
