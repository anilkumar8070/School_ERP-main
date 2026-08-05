import { Outlet } from 'react-router-dom';
import { createContext, useContext } from 'react';
import React, { useState, useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import GlobalFooter from '../GlobalFooter'
import { getAuth } from '../../utils/session'
import '../../pages/AdminPanel.css'

const LayoutContext = createContext(null);

export default function AdminLayout({
    children,
    title = 'Admin Panel',
    sidebarItems = undefined,
    copyrightText = 'copyright @AdminPanel 2025',
}) {
    const context = useContext(LayoutContext);
    useEffect(() => {
        if (context && title && context.setTitle) {
            context.setTitle(title);
        }
    }, [title, context]);

    if (context) {
        return <>{children || <Outlet />}</>;
    }

    const [currentTitle, setCurrentTitle] = React.useState(title);

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

    const [sidebarOpen, setSidebarOpen] = useState(() => {
        try {
            if (window.innerWidth <= 768) return false
            const val = localStorage.getItem('sidebar_open')
            return val !== null ? val === 'true' : true
        } catch (e) { return true }
    })
    
    useEffect(() => {
        localStorage.setItem('sidebar_open', sidebarOpen)
    }, [sidebarOpen])

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
        <LayoutContext.Provider value={{ setTitle: setCurrentTitle }}>
            <div className={`admin-root ${attached ? 'sidebar-attached' : ''} ${darkMode ? 'dark' : 'light'}`}>
            <Header
                onToggleSidebar={toggleSidebar}
                onAttachSidebar={attachAndOpen}
                title={currentTitle}
                sidebarOpen={sidebarOpen}
                darkMode={darkMode}
                toggleTheme={toggleTheme}
            />
            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} items={sidebarItems} closeOnNavigate={false} attached={attached} />

            <main className={`admin-content ${sidebarOpen ? 'sidebar-open' : ''}`} style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <div style={{ padding: '24px', flex: 1 }}>
                    {children || <Outlet />}
                </div>
                <div style={{ marginTop: 'auto' }}>
                    <GlobalFooter copyrightText={copyrightText} />
                </div>
            </main>
        </div>
            </LayoutContext.Provider>
    )
}

