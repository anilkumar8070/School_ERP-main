import React, { useEffect, useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'
import { getAuth } from '../../utils/session'
import '../../pages/Faculty.css'

export default function FacultyLayout({ children, title = 'Faculty Panel' }) {
    const [open, setOpen] = useState(false)
    const [attached, setAttached] = useState(false)
    const [darkMode, setDarkMode] = useState(() => {
        try {
            return localStorage.getItem('faculty_theme') === 'dark'
        } catch (e) { return false }
    })

    useEffect(() => {
        localStorage.setItem('faculty_theme', darkMode ? 'dark' : 'light')
    }, [darkMode])

    function toggleTheme() {
        setDarkMode(prev => !prev)
    }

    useEffect(() => {
        // require faculty role (session-based)
        try {
            const { token, role } = getAuth()
            if (!token) {
                window.location.href = '/faculty-login'
            } else if (role !== 'faculty') {
                if (role === 'admin') window.location.href = '/admin-dashboard'
                else if (role === 'student') window.location.href = '/student-dashboard'
                else if (role === 'parent') window.location.href = '/parents-dashboard'
                else window.location.href = '/'
            }
        } catch (e) {
            try { window.location.href = '/faculty-login' } catch (err) { }
        }
    }, [])

    function toggle() { setOpen(s => !s) }
    function close() { setOpen(false); setAttached(false) }

    function attachAndOpen() {
        setAttached(true)
        setOpen(true)
    }

    return (
        <div className={`faculty-root ${attached ? 'sidebar-attached' : ''} ${darkMode ? 'dark' : 'light'}`}>
            <Header
                onToggleSidebar={toggle}
                onAttachSidebar={attachAndOpen}
                title={title}
                sidebarOpen={open}
                darkMode={darkMode}
                toggleTheme={toggleTheme}
            />
            <Sidebar isOpen={open} onClose={close} />

            <main className={`faculty-content ${open ? 'sidebar-open' : ''}`} onClick={close}>
                {children}
            </main>

            <Footer />
        </div>
    )
}
