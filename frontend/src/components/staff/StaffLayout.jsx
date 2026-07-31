import React, { useEffect, useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'
import '../../pages/ParentPanel.css'
import { getAuth } from '../../utils/session'

export default function StaffLayout({ children, title = 'Staff Panel' }) {
    const [open, setOpen] = useState(false)
    const [attached, setAttached] = useState(false)
    const [darkMode, setDarkMode] = useState(false)

    useEffect(() => {
        // Auth check
        try {
            const { token, role } = getAuth()
            if (!token) {
                window.location.href = '/staff-login'
            } else if (role !== 'staff') {
                if (role === 'admin') window.location.href = '/admin-dashboard'
                else if (role === 'faculty') window.location.href = '/faculty-dashboard'
                else if (role === 'student') window.location.href = '/student-dashboard'
                else if (role === 'parent') window.location.href = '/parent-dashboard'
                else window.location.href = '/start'
            }
        } catch (e) {
            try { window.location.href = '/staff-login' } catch (err) { }
        }

        // Theme init
        try {
            const saved = localStorage.getItem('staff_theme')
            if (saved === 'dark') setDarkMode(true)
        } catch (e) { }
    }, [])

    function toggleTheme() {
        setDarkMode(prev => {
            const newVal = !prev
            localStorage.setItem('staff_theme', newVal ? 'dark' : 'light')
            return newVal
        })
    }

    function toggle() { setOpen(s => !s) }
    function close() { setOpen(false); setAttached(false) }

    function attachAndOpen() {
        setAttached(true)
        setOpen(true)
    }

    return (
        <div className={`parent-root ${attached ? 'sidebar-attached' : ''} ${darkMode ? 'dark' : ''}`}>
            <Header
                onToggleSidebar={toggle}
                onAttachSidebar={attachAndOpen}
                sidebarOpen={open}
                darkMode={darkMode}
                toggleTheme={toggleTheme}
            />
            <Sidebar isOpen={open} onClose={close} />

            <main className={`parent-content ${open ? 'sidebar-open' : ''}`} onClick={() => { if (window.innerWidth <= 768) close() }}>
                {children}
            </main>

            <Footer />
        </div>
    )
}
