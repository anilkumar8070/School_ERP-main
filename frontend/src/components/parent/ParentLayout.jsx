import { Outlet } from 'react-router-dom';
import { createContext, useContext } from 'react';
import React, { useState, useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import GlobalFooter from '../GlobalFooter'
import '../../pages/ParentPanel.css'
import { getAuth } from '../../utils/session'

const LayoutContext = createContext(null);

export default function ParentLayout({ children, title = 'Parent Panel' }) {
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
    const [darkMode, setDarkMode] = useState(false)

    useEffect(() => {
        // Auth check
        try {
            const { token, role } = getAuth()
            if (!token) {
                window.location.href = '/parents-login'
            } else if (role !== 'parent') {
                if (role === 'admin') window.location.href = '/admin-dashboard'
                else if (role === 'faculty') window.location.href = '/faculty-dashboard'
                else if (role === 'student') window.location.href = '/student-dashboard'
                else window.location.href = '/'
            }
        } catch (e) {
            try { window.location.href = '/parents-login' } catch (err) { }
        }

        // Theme init
        try {
            const saved = localStorage.getItem('parent_theme')
            if (saved === 'dark') setDarkMode(true)
        } catch (e) { }
    }, [])

    function toggleTheme() {
        setDarkMode(prev => {
            const newVal = !prev
            localStorage.setItem('parent_theme', newVal ? 'dark' : 'light')
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
        <LayoutContext.Provider value={{ setTitle: setCurrentTitle }}>
            <div className={`parent-root ${attached ? 'sidebar-attached' : ''} ${darkMode ? 'dark' : ''}`}>
            <Header
                onToggleSidebar={toggle}
                onAttachSidebar={attachAndOpen}
                title={currentTitle}
                sidebarOpen={open}
                darkMode={darkMode}
                toggleTheme={toggleTheme}
            />
            <Sidebar isOpen={open} onClose={close} />

            <main className={`parent-content ${open ? 'sidebar-open' : ''}`} onClick={() => { if (window.innerWidth <= 768) close() }} style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <div style={{ padding: '1.5rem', flex: 1 }}>
                    {children || <Outlet />}
                </div>
                <div style={{ marginTop: 'auto' }}>
                    <GlobalFooter />
                </div>
            </main>
        </div>
            </LayoutContext.Provider>
    )
}
