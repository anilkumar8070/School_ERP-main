import React, { useState } from 'react'
import './Auth.css'

export default function AdminRegister() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, name, role: 'admin' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Registration failed')
            setSuccess('Registration successful. You can now login.')
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
                    <div className="logo">S</div>
                    <div>
                        <div style={{ fontWeight: 700 }}>School ERP</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Admin Registration</div>
                    </div>
                </div>

                <h2>Admin Register</h2>
                <form onSubmit={handleSubmit}>
                    <label>
                        Name
                        <input value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label>
                        Email or Username
                        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </label>
                    <label>
                        Password
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </label>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <div className="auth-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create account'}
                        </button>
                        <a
                            href="/admin-login"
                            onClick={(e) => {
                                e.preventDefault()
                                window.history.pushState({}, '', '/admin-login')
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
