import React, { useState } from 'react'
import { login } from '../api'
import { setAuth } from '../utils/session'
import LoginLayout from '../components/LoginLayout'

export default function StudentLogin() {
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
            if (data.role !== 'student') {
                setError('This account does not have student access.')
                setLoading(false)
                return
            }
            setAuth(data.token, data.role)
            window.location.href = data.redirect || '/'
        } catch (err) {
            setError(err.message || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <LoginLayout
            title="Student Login"
            image="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=1000"
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            signupLink="/student-register"
        />
    )
}
