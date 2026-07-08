import React, { useState } from 'react'
import { login } from '../api'
import { setAuth } from '../utils/session'
import LoginLayout from '../components/LoginLayout'

export default function ParentsLogin() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const data = await login(username, password)
            setAuth(data.token, data.role)
            if (data.role === 'parent') {
                window.location.href = data.redirect || '/parent-dashboard'
            } else {
                window.location.href = data.redirect || '/'
            }
        } catch (err) {
            setError(err.message || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <LoginLayout
            title="Parent Login"
            image="https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=1000"
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            signupLink="/parents-register"
        />
    )
}
