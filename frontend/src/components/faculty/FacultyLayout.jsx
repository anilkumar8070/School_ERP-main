import React, { useEffect, useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import GlobalFooter from '../GlobalFooter'
import { getAuth } from '../../utils/session'
import '../../pages/Faculty.css'

export default function FacultyLayout({ children, title = 'Faculty Panel' }) {
    const [open, setOpen] = useState(() => {
        try {
            if (window.innerWidth <= 768) return false
            const val = localStorage.getItem('sidebar_open')
            return val !== null ? val === 'true' : true
        } catch (e) { return true }
    })
    
    useEffect(() => {
        localStorage.setItem('sidebar_open', open)
    }, [open])

    const [attached, setAttached] = useState(false)
    // Dark mode removed as per user request
    const darkMode = false;

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
            />
            <Sidebar isOpen={open} onClose={close} />

            <main className={`faculty-content ${open ? 'sidebar-open' : ''}`} onClick={close} style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <div style={{ padding: '1.5rem', flex: 1 }}>
                    {children}
                </div>
                <div style={{ marginTop: 'auto' }}>
                    <GlobalFooter />
                </div>
            </main>
        </div>
    )
}
