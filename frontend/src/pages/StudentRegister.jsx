import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { submitStudentRegistration } from '../api'
import './Auth.css'

export default function StudentRegister() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [className, setClassName] = useState('1')
    const [medium, setMedium] = useState('English')
    const [address, setAddress] = useState('')
    const [school, setSchool] = useState('')
    const [accessId, setAccessId] = useState('123')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const mutation = useMutation({
        mutationFn: (payload) => submitStudentRegistration(payload),
        onSuccess: (data) => {
            setError('')
            setSuccess('Registration submitted for admin approval. You will be notified on approval.')
            setTimeout(() => {
                setName('')
                setEmail('')
                setClassName('1')
                setAddress('')
                setSchool('')
                setAccessId('123')
                try { window.location.reload() } catch (e) { }
            }, 1100)
        },
        onError: (err) => {
            setError(err?.message || 'Registration failed')
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        const payload = { name, email, class: className, address, school, accessId, medium }
        mutation.mutate(payload)
    }

    return (
        <div className="auth-root">
            <div className="auth-card">
                <div className="accent" />
                <div className="brand">
                    <div className="logo">ST</div>
                    <div>
                        <div style={{ fontWeight: 700 }}>School ERP</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Student Registration</div>
                    </div>
                </div>

                <h2>Student Register</h2>
                <form onSubmit={handleSubmit}>
                    <label>
                        Name
                        <input value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label>
                        Email
                        <input value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </label>
                    <label>
                        Class
                        <select value={className} onChange={(e) => setClassName(e.target.value)}>
                            {Array.from({ length: 12 }).map((_, i) => <option key={i} value={`${i + 1}`}>{i + 1}</option>)}
                        </select>
                    </label>
                    <label>
                        Medium
                        <select value={medium} onChange={(e) => setMedium(e.target.value)}>

                            <option value="Hindi">Hindi</option>
                            <option value="English">English</option>
                            <option value="Bengali">Bengali</option>
                            <option value="Tamil">Tamil</option>
                            <option value="Telugu">Telugu</option>
                            <option value="Marathi">Marathi</option>
                            <option value="Gujarati">Gujarati</option>
                            <option value="Urdu">Urdu</option>
                            <option value="Kannada">Kannada</option>
                            <option value="Malayalam">Malayalam</option>
                        </select>
                    </label>
                    <label>
                        Address
                        <input value={address} onChange={(e) => setAddress(e.target.value)} />
                    </label>
                    <label>
                        School Name
                        <input value={school} onChange={(e) => setSchool(e.target.value)} />
                    </label>
                    <label>
                        Access ID
                        <input value={accessId} onChange={(e) => setAccessId(e.target.value)} />
                    </label>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <div className="auth-actions">
                        <button type="submit" className="btn-primary" disabled={mutation.isLoading}>
                            {mutation.isLoading ? 'Creating...' : 'Create account'}
                        </button>
                        <a
                            href="/student-login"
                            onClick={(e) => {
                                e.preventDefault()
                                window.history.pushState({}, '', '/student-login')
                                window.dispatchEvent(new PopStateEvent('popstate'))
                            }}
                        >
                            Back to Login
                        </a>
                    </div>
                </form>
            </div>
        </div>
    )
}
