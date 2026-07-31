import React, { useState, useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'
import { getAuth } from '../../utils/session'
import '../../pages/AdminPanel.css'

export default function AdminLayout({
    children,
    title = 'Admin Panel',
    sidebarItems = undefined,
    copyrightText = 'copyright @AdminPanel 2025',
}) {
    const [darkMode, setDarkMode] = useState(() => {
        try {
            return localStorage.getItem('admin_theme') === 'dark'
        } catch (e) { return false }
    })

    useEffect(() => {
        localStorage.setItem('admin_theme', darkMode ? 'dark' : 'light')
        // Scoped theme: class is applied to .admin-root wrapper, not body
    }, [darkMode])

    function toggleTheme() {
        setDarkMode(prev => !prev)
    }

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [attached, setAttached] = useState(false)

    function toggleSidebar() {
        setSidebarOpen((s) => !s)
    }

    function closeSidebar() {
        setSidebarOpen(false)
        setAttached(false)
    }

    function attachAndOpen() {
        setAttached(true)
        setSidebarOpen(true)
    }

    useEffect(() => {
        // simple client-side protection: require token and admin role (session-based)
        try {
            const { token, role: userRole } = getAuth()
            if (!token) {
                window.location.href = '/admin-login'
            } else if (userRole !== 'admin') {
                if (userRole === 'faculty') window.location.href = '/faculty-dashboard'
                else if (userRole === 'student') window.location.href = '/student-dashboard'
                else if (userRole === 'parent') window.location.href = '/parents-dashboard'
                else window.location.href = '/'
            }
        } catch (e) {
            try { window.location.href = '/admin-login' } catch (err) { }
        }
    }, [])

    return (
        <div className={`admin-root ${attached ? 'sidebar-attached' : ''} ${darkMode ? 'dark' : 'light'}`}>
            <Header
                onToggleSidebar={toggleSidebar}
                onAttachSidebar={attachAndOpen}
                title={title}
                sidebarOpen={sidebarOpen}
                darkMode={darkMode}
                toggleTheme={toggleTheme}
            />
            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} items={sidebarItems} closeOnNavigate={false} attached={attached} />

            <main className={`admin-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
                {children}
            </main>

            <Footer copyrightText={copyrightText} />

        </div>
    )
}

