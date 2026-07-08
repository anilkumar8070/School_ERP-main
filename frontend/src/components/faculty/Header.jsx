import React, { useState, useEffect, useRef } from 'react'
import { clearAuth } from '../../utils/session'
import { useNavigate } from 'react-router-dom'
import { logoutApi } from '../../api'
import { FiSun, FiMoon } from 'react-icons/fi'

export default function Header({ onToggleSidebar, onAttachSidebar, sidebarOpen = false, darkMode, toggleTheme }) {
    const [open, setOpen] = useState(false)
    const [profile, setProfile] = useState({ name: '', employeeId: '', subject: '', education: '', email: '', contact: '', avatar: '' })
    const panelRef = useRef()

    useEffect(() => {
        try {
            const v = localStorage.getItem('faculty_profile')
            if (v) { setProfile(JSON.parse(v)); return }
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
                setProfile(p => ({ ...p, name: payload.name || payload.fullname || p.name, email: payload.email || p.email, avatar: payload.avatar || payload.picture || p.avatar }))
            }
        } catch (e) { }
    }, [])

    useEffect(() => {
        function onProfileUpdated(e) {
            if (!e || !e.detail || e.detail.role !== 'faculty') return
            try {
                const v = localStorage.getItem('faculty_profile')
                if (v) setProfile(JSON.parse(v))
            } catch (err) { }
        }
        window.addEventListener('erp_profile_updated', onProfileUpdated)
        return () => window.removeEventListener('erp_profile_updated', onProfileUpdated)
    }, [])

    useEffect(() => {
        function onDoc(e) {
            if (!panelRef.current) return
            if (!panelRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('click', onDoc)
        return () => document.removeEventListener('click', onDoc)
    }, [])

    const navigate = useNavigate()
    function handleLogout() {
        try { logoutApi().catch(() => { }) } catch (e) { }
        clearAuth({ global: false })
        navigate('/faculty-login')
    }

    // navigate to profile page instead of inline editing
    function handleViewProfile() {
        setOpen(false)
        navigate('/faculty/profile')
    }

    return (
        <header className="faculty-header">
            <button
                className={`hamburger ${sidebarOpen ? 'open' : ''}`}
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={sidebarOpen}
                onClick={onToggleSidebar}
            >
                <span />
                <span />
                <span />
            </button>

            {/* Hemensburg button: opens sidebar and visually looks like Windows icon */}
            <button
                className="hemensburg"
                aria-label="Open attached menu"
                onClick={() => { try { if (typeof onAttachSidebar === 'function') onAttachSidebar(); else onToggleSidebar && onToggleSidebar() } catch (e) { if (onToggleSidebar) onToggleSidebar() } }}
            >
                <span className="cell" />
                <span className="cell" />
                <span className="cell" />
                <span className="cell" />
            </button>

            <div className="faculty-title">FACULTY PANEL</div>

            <div className="header-spacer" />

            {/* Theme Toggle Button */}
            <button
                onClick={toggleTheme}
                style={{ background: 'transparent', border: 'none', color: 'inherit', marginRight: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
            </button>

            <div className="faculty-profile" ref={panelRef}>
                <button className="profile-btn" onClick={() => setOpen(s => !s)} aria-haspopup="true" aria-expanded={open}>
                    {profile.avatar ? <img src={profile.avatar} alt="avatar" /> : <div className="avatar-placeholder">F</div>}
                    <span className="profile-label">{(profile.name || '').split(' ')[0] || 'Me'}</span>
                </button>

                {open && (
                    <div className="profile-panel" role="menu">
                        <button className="profile-item" onClick={handleViewProfile}>View profile</button>
                        <button className="profile-item" onClick={handleLogout}>Logout</button>
                    </div>
                )}
            </div>
        </header>
    )
}
