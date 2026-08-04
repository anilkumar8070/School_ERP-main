import React, { useState, useEffect, useRef } from 'react'
import { clearAuth } from '../../utils/session'
import { useNavigate } from 'react-router-dom'
import { logoutApi } from '../../api'

export default function Header({ onToggleSidebar, onAttachSidebar, sidebarOpen, darkMode, toggleTheme }) {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const panelRef = useRef()
    const [profile, setProfile] = useState({ name: '', email: '', contact: '', address: '', avatar: '' })

    useEffect(() => {
        try {
            const v = localStorage.getItem('staff_profile')
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
                setProfile(p => ({ ...p, name: payload.name || payload.fullname || p.name, email: payload.email || p.email, avatar: payload.avatar || p.picture || p.avatar }))
            }
        } catch (e) { }
    }, [])

    useEffect(() => {
        function onProfileUpdated(e) {
            if (!e || !e.detail || e.detail.role !== 'staff') return
            try {
                const v = localStorage.getItem('staff_profile')
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

    function handleLogout() {
        try { logoutApi().catch(() => { }) } catch (e) { }
        clearAuth({ global: false })
        navigate('/staff-login')
    }

    function handleViewProfile() {
        setOpen(false)
        navigate('/staff/profile')
    }

    return (
        <header className="parent-header">
            <button className="hamburger" aria-label="Toggle sidebar" onClick={onToggleSidebar}>
                <span />
                <span />
                <span />
            </button>

            {/* Desktop Toggle (Hemensburg) */}
            <button
                className="hemensburg"
                onClick={() => {
                    if (onAttachSidebar) onAttachSidebar()
                    else if (onToggleSidebar) onToggleSidebar()
                }}
            >
                <span className="cell" />
                <span className="cell" />
                <span className="cell" />
                <span className="cell" />
            </button>

            <div className="parent-title">STAFF PANEL</div>

            <div className="header-spacer" />

            {/* Theme Toggle Removed */}

            <div className="parent-profile" ref={panelRef}>
                <button className="profile-btn" onClick={() => setOpen(s => !s)}>
                    {profile.avatar ? <img src={profile.avatar} alt="avatar" /> : <div className="avatar-placeholder">S</div>}
                    <span className="profile-label staff-mobile-hide">{(profile.name || '').split(' ')[0] || 'Me'}</span>
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
