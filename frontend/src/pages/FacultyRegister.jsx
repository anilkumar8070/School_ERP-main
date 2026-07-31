import React, { useState } from 'react'
import './Auth.css'

export default function FacultyRegister() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [subject, setSubject] = useState('')
    const [education, setEducation] = useState('')
    const [contact, setContact] = useState('')
    const [avatar, setAvatar] = useState('')
    const [experience, setExperience] = useState('')
    const [hadContactBefore, setHadContactBefore] = useState('no')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)
        try {
            // If faculty registers, submit to approval queue instead of creating user directly
            const payload = { name, email: email || username, subject, education, experience, contact, avatar, hadContactBefore: hadContactBefore === 'yes' }
            const apiBase = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:4000`
            const base = apiBase.replace(/\/$/, '')
            const res = await fetch(`${base}/api/faculty/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Registration failed')
            setSuccess('Registration submitted for admin approval. You will be notified on approval.')
            // clear the form and refresh the page after a short delay
            setTimeout(() => {
                setName('')
                setEmail('')
                setSubject('')
                setEducation('')
                setExperience('')
                setContact('')
                setHadContactBefore('no')
                setAvatar('')
                // optional: reload to show fresh state
                try { window.location.reload() } catch (e) { /* ignore */ }
            }, 1200)
        } catch (err) {
            setError(err.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-root">
            <div className="auth-card">
                <div className="accent" />
                <div className="brand">
                    <div className="logo">F</div>
                    <div>
                        <div style={{ fontWeight: 700 }}>School ERP</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Faculty Registration</div>
                    </div>
                </div>

                <h2>Faculty Register</h2>
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
                        Subject / Specialization
                        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </label>
                    <label>
                        Educational History
                        <input value={education} onChange={(e) => setEducation(e.target.value)} />
                    </label>
                    <label>
                        Experience
                        <input value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g., 5 years of teaching" />
                    </label>
                    <label>
                        Contact
                        <input value={contact} onChange={(e) => setContact(e.target.value)} />
                    </label>
                    <label>
                        Did you have contact to school before?
                        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <input type="radio" name="hadContact" value="yes" checked={hadContactBefore === 'yes'} onChange={() => setHadContactBefore('yes')} />
                                Yes
                            </label>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <input type="radio" name="hadContact" value="no" checked={hadContactBefore === 'no'} onChange={() => setHadContactBefore('no')} />
                                No
                            </label>
                        </div>
                    </label>
                    <label>
                        Profile Photo (optional)
                        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) { const r = new FileReader(); r.onload = () => setAvatar(r.result); r.readAsDataURL(f) } }} />
                    </label>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <div className="auth-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create account'}
                        </button>
                        <a
                            href="/faculty-login"
                            onClick={(e) => {
                                e.preventDefault()
                                window.history.pushState({}, '', '/faculty-login')
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
