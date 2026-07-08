import React, { useState } from 'react'
import { clearAuth, getAuth } from '../../utils/session'
import { useNavigate } from 'react-router-dom'
import { logoutApi } from '../../api'
import { FiSun, FiMoon, FiMenu } from 'react-icons/fi'
import './Header.css'

export default function Header({ onToggleSidebar, onAttachSidebar, sidebarOpen = false, darkMode, toggleTheme }) {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const auth = getAuth()
    const [profile, setProfile] = useState({ name: '', email: '', contact: '', address: '', avatar: '' })
    const displayName = (profile.name) || (auth && (auth.name || auth.username)) || 'Admin'

    React.useEffect(() => {
        try {
            const v = localStorage.getItem('admin_profile')
            if (v) setProfile(JSON.parse(v))
        } catch (e) { }
    }, [])

    React.useEffect(() => {
        try {
            const mq = window.matchMedia('(max-width: 480px)')
            const onChange = (e) => setIsMobile(Boolean(e && e.matches))
            // set initial
            setIsMobile(Boolean(mq && mq.matches))
            if (mq && mq.addEventListener) mq.addEventListener('change', onChange)
            else if (mq && mq.addListener) mq.addListener(onChange)
            return () => {
                try {
                    if (mq && mq.removeEventListener) mq.removeEventListener('change', onChange)
                    else if (mq && mq.removeListener) mq.removeListener(onChange)
                } catch (err) { }
            }
        } catch (err) { }
    }, [])

    // If no saved profile, try to prefill from JWT payload (token)
    React.useEffect(() => {
        try {
            const v = localStorage.getItem('admin_profile')
            if (v) return
        } catch (e) { }
        try {
            const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
            if (!token) return
            const payload = (() => {
                try {
                    const p = token.split('.')[1]
                    const json = atob(p.replace(/-/g, '+').replace(/_/g, '/'))
                    return JSON.parse(decodeURIComponent(escape(json)))
                } catch (err) { return null }
            })()
            if (payload) {
                setProfile(p => ({
                    ...p,
                    name: payload.name || payload.fullname || p.name,
                    email: payload.email || p.email,
                    avatar: payload.avatar || payload.picture || p.avatar || ''
                }))
            }
        } catch (e) { }
    }, [])

    React.useEffect(() => {
        function onProfileUpdated(e) {
            if (!e || !e.detail || e.detail.role !== 'admin') return
            try {
                const v = localStorage.getItem('admin_profile')
                if (v) setProfile(JSON.parse(v))
            } catch (err) { }
        }
        window.addEventListener('erp_profile_updated', onProfileUpdated)
        return () => window.removeEventListener('erp_profile_updated', onProfileUpdated)
    }, [])

    function handleLogout() {
        setOpen(false)
        try { logoutApi().catch(() => { }) } catch (e) { }
        clearAuth({ global: false })
        navigate('/admin-login')
    }

    function handleViewProfile() {
        setOpen(false)
        navigate('/admin/profile')
    }

    return (
        <header className="admin-header">
            <button
                className={`hamburger ${sidebarOpen ? 'open' : ''}`}
                aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                onClick={onToggleSidebar}
                aria-expanded={sidebarOpen}
            >
                <FiMenu size={24} color={darkMode ? '#fff' : '#111827'} />
            </button>

            {/* Header Content Wrapper */}
            <div className="header-content">


                <div className="header-actions">
                    {/* Theme Toggle */}
                    <button className="icon-btn" onClick={toggleTheme} title="Toggle Theme">
                        {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
                    </button>



                    {/* Profile */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className="profile-btn"
                            onClick={() => setOpen(o => !o)}
                            title="Profile"
                            aria-haspopup="menu"
                            aria-expanded={open}
                        >
                            <span className="profile-avatar-ring" aria-hidden>
                                {profile.avatar ? (
                                    <img src={profile.avatar} alt={`${displayName} avatar`} className="profile-avatar-img" />
                                ) : (
                                    <div className="avatar-placeholder">{(displayName || 'A')[0].toUpperCase()}</div>
                                )}
                            </span>
                            <div className="profile-info">
                                <span className="profile-name">{(displayName || 'Admin').split(' ')[0]}</span>
                                <span className="profile-role">Admin</span>
                            </div>
                        </button>
                        {open && (
                            <div className="profile-dropdown" role="menu">
                                <button className="profile-item" onClick={handleViewProfile}>View profile</button>
                                <button className="profile-item" onClick={handleLogout}>Logout</button>
                            </div>
                        )}
                    </div>


                </div>
            </div>
        </header>
    )
}
