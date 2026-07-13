import React, { useState } from 'react'
import './Auth.css'
import { forgotPassword } from '../api'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)
        try {
            await forgotPassword(email)
            setSuccess('If an account exists with that email, a reset link has been sent.')
            setTimeout(() => { setEmail(''); try { window.location.reload() } catch (e) { } }, 1200)
        } catch (err) {
            setError(err.message || 'Failed to request password reset')
        } finally { setLoading(false) }
    }

    return (
        <div className="auth-root">
            <div className="auth-card">
                <div className="accent" />
                <div className="brand">
                    <div className="logo">PW</div>
                    <div>
                        <div style={{ fontWeight: 700 }}>School ERP</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Password Reset</div>
                    </div>
                </div>

                <h2>Forgot Password</h2>
                <form onSubmit={handleSubmit}>
                    <label>
                        Email
                        <input value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </label>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <div className="auth-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
