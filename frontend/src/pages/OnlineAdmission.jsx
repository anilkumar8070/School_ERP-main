import React, { useState } from 'react'
import { submitOnlineAdmission } from '../api'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import './AdminPanel.css' // Reuse the styling variables

export default function OnlineAdmission() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        studentName: '', dob: '', gender: '', address: '', parentName: '', parentPhone: '', classApplying: ''
    })
    const [document, setDocument] = useState(null)

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const onSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const fd = new FormData()
            Object.keys(formData).forEach(k => fd.append(k, formData[k]))
            if (document) {
                fd.append('document', document)
            }
            await submitOnlineAdmission(fd)
            toast.success('Admission form submitted successfully!')
            navigate('/')
        } catch (err) {
            toast.error(err.message || 'Failed to submit form')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
            <div className="admin-card" style={{ maxWidth: '800px', width: '100%' }}>
                <h2 style={{ marginBottom: '20px', color: 'var(--text-main)', textAlign: 'center' }}>Online Admission Form</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '30px', textAlign: 'center' }}>Please fill out the details below to apply for admission.</p>
                
                <form onSubmit={onSubmit} className="admin-form-grid">
                    <div className="form-group">
                        <label>Student Name *</label>
                        <input className="admin-input" name="studentName" value={formData.studentName} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Date of Birth *</label>
                        <input className="admin-input" type="date" name="dob" value={formData.dob} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Gender *</label>
                        <select className="admin-select" name="gender" value={formData.gender} onChange={handleChange} required>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Class Applying For *</label>
                        <input className="admin-input" name="classApplying" value={formData.classApplying} onChange={handleChange} required />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Address *</label>
                        <textarea className="admin-input" name="address" value={formData.address} onChange={handleChange} rows="2" required />
                    </div>
                    
                    <h3 style={{ gridColumn: '1 / -1', marginTop: '10px', color: 'var(--text-main)' }}>Parent Details</h3>
                    <div className="form-group">
                        <label>Parent Name *</label>
                        <input className="admin-input" name="parentName" value={formData.parentName} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label>Parent Phone *</label>
                        <input className="admin-input" name="parentPhone" value={formData.parentPhone} onChange={handleChange} required />
                    </div>

                    <h3 style={{ gridColumn: '1 / -1', marginTop: '10px', color: 'var(--text-main)' }}>Documents</h3>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Upload Document (Birth Certificate / Previous Marksheet - PDF or Image)</label>
                        <input 
                            className="admin-file-input" 
                            type="file" 
                            accept="image/*,.pdf" 
                            onChange={e => setDocument(e.target.files && e.target.files[0])} 
                        />
                    </div>
                    
                    <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px' }}>
                            {loading ? 'Submitting...' : 'Submit Admission Form'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
