import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { uploadFile, submitRegister } from '../api'
import './Auth.css'

export default function ParentsRegister() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [contact, setContact] = useState('')
    const [address, setAddress] = useState('')
    const [parentOf, setParentOf] = useState('')
    const [avatarFile, setAvatarFile] = useState(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const mutation = useMutation({
        mutationFn: async ({ username, password, name, contact, address, parentOf, avatarFile }) => {
            let avatarUrl = ''
            if (avatarFile) {
                const fd = new FormData()
                fd.append('file', avatarFile)
                const up = await uploadFile(fd)
                avatarUrl = up.url
            }
            const payload = { username, password, name, role: 'parent', contact, address, parentOf: parentOf ? [parentOf] : [], avatar: avatarUrl }
            return submitRegister(payload)
        },
        onSuccess: () => {
            setError('')
            setSuccess('Registration successful. You can now login.')
        },
        onError: (err) => {
            setError(err?.message || 'Registration failed')
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        mutation.mutate({ username, password, name, contact, address, parentOf, avatarFile })
    }

    return (
        <div className="auth-root">
            <div className="auth-card">
                <div className="accent" />
                <div className="brand">
                    <div className="logo">P</div>
                    <div>
                        <div style={{ fontWeight: 700 }}>School ERP</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Parents Registration</div>
                    </div>
                </div>

                <h2>Parents Register</h2>
                <form onSubmit={handleSubmit}>
                    <label>
                        Name
                        <input value={name} onChange={(e) => setName(e.target.value)} required />
                    </label>
                    <label>
                        Email or Username
                        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </label>
                    <label>
                        Password
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </label>
                    <label>
                        Contact
                        <input value={contact} onChange={(e) => setContact(e.target.value)} required />
                    </label>
                    <label>
                        Address
                        <input value={address} onChange={(e) => setAddress(e.target.value)} required />
                    </label>
                    <label>
                        Parent of (student name or id)
                        <input value={parentOf} onChange={(e) => setParentOf(e.target.value)} required />
                    </label>
                    <label>
                        Profile Image
                        <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files && e.target.files[0])} />
                    </label>

                    {error && <div className="auth-error">{error}</div>}
                    {success && <div className="auth-success">{success}</div>}

                    <div className="auth-actions">
                        <button type="submit" className="btn-primary" disabled={mutation.isLoading}>
                            {mutation.isLoading ? 'Creating...' : 'Create account'}
                        </button>
                        <a
                            href="/parents-login"
                            onClick={(e) => {
                                e.preventDefault()
                                window.history.pushState({}, '', '/parents-login')
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
