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
            const v = localStorage.getItem('parent_profile')
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
            if (!e || !e.detail || e.detail.role !== 'parent') return
            try {
                const v = localStorage.getItem('parent_profile')
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
        navigate('/parents-login')
    }

    function handleViewProfile() {
        setOpen(false)
        navigate('/parent/profile')
    }

    return (
        <header className="parent-header">
            <button className="hamburger w-10 h-10 inline-flex items-center justify-center mr-2 p-2 rounded-md touch-manipulation" aria-label="Toggle sidebar" onClick={onToggleSidebar}>
                <span className="block w-4 h-px bg-white my-0.5" />
                <span className="block w-4 h-px bg-white my-0.5" />
                <span className="block w-4 h-px bg-white my-0.5" />
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

            <div className="parent-title text-center absolute left-1/2 sm:left-1/2 transform -translate-x-1/2 font-extrabold text-sm">PARENT PANEL</div>

            <div className="header-spacer flex-1" />

            <button
                className="theme-toggle-btn mr-4 p-2 rounded-full bg-transparent border-0 cursor-pointer text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                onClick={toggleTheme}
                aria-label="Toggle Theme"
            >
                {darkMode ? (
                    // Sun icon
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                    </svg>
                ) : (
                    // Moon icon
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" height="20" width="20" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                    </svg>
                )}
            </button>

            <div className="parent-profile relative" ref={panelRef}>
                <button className="profile-btn" onClick={() => setOpen(s => !s)}>
                    {profile.avatar ? <img src={profile.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" /> : <div className="avatar-placeholder">P</div>}
                    <span className="profile-label hidden sm:inline-block font-semibold">{(profile.name || '').split(' ')[0] || 'Me'}</span>
                </button>
                {open && (
                    <div className="profile-panel right-2 top-14 absolute w-44 p-2" role="menu">
                        <button className="profile-item block w-full text-left py-2 px-3" onClick={handleViewProfile}>View profile</button>
                        <button className="profile-item block w-full text-left py-2 px-3" onClick={handleLogout}>Logout</button>
                    </div>
                )}
            </div>
        </header>
    )
}
