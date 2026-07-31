import React, { useState } from 'react'
import { login } from '../api'
import { setAuth } from '../utils/session'
import LoginLayout from '../components/LoginLayout'

export default function FacultyLogin() {
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
            if (data.role !== 'faculty') {
                setError('This account does not have teacher/faculty access.')
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
            title="Teacher Login"
            image="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=1000"
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            signupLink="/faculty-register"
        />
    )
}
