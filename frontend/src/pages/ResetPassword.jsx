import React, { useState, useEffect } from 'react'
import './Auth.css'
import { resetPassword } from '../api'
import { useSearchParams } from 'react-router-dom'

export default function ResetPassword() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token') || ''
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => { if (!token) setError('No token provided') }, [token])

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setSuccess('')
        if (!token) { setError('No token provided'); return }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return }
        if (password !== confirm) { setError('Passwords do not match'); return }
        setLoading(true)
        try {
            await resetPassword(token, password)
            setSuccess('Password reset successful. You can now login.')
            setTimeout(() => { window.location.href = '/start' }, 1200)
        } catch (err) { setError(err.message || 'Failed to reset password') } finally { setLoading(false) }
    }

    return (
        <div className="auth-root">
            <div className="auth-card">
                <div className="accent" />
                <div className="brand">
                    <div className="logo">RP</div>
                    <div>
                        <div style={{ fontWeight: 700 }}>School ERP</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Reset Password</div>
                    </div>
                </div>

                <h2>Reset Password</h2>
                <form onSubmit={handleSubmit}>
                    <label>
                        New password
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </label>
                    <label>
                        Confirm password
                        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                    </label>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <div className="auth-actions">
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Resetting...' : 'Reset password'}</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
