import React, { useState, useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'
import { getAuth } from '../../utils/session'
import '../../pages/Student.css'

export default function StudentLayout({ children }) {
    const [open, setOpen] = useState(window.innerWidth >= 768)
    const [darkMode, setDarkMode] = useState(() => {
        try {
            return localStorage.getItem('student_theme') === 'dark'
        } catch (e) { return false }
    })

    useEffect(() => {
        localStorage.setItem('student_theme', darkMode ? 'dark' : 'light')
    }, [darkMode])

    function toggleTheme() {
        setDarkMode(prev => !prev)
    }

    useEffect(() => {
        const { token, role } = getAuth()
        if (!token || role !== 'student') {
            // redirect to appropriate login
            window.location.href = '/student-login'
        }
    }, [])

    useEffect(() => {
        // set "active" class on matching sidebar links and update on history changes
        function updateActive() {
            try {
                const links = document.querySelectorAll('.student-sidebar nav a')
                links.forEach(a => {
                    const href = a.getAttribute('href') || ''
                    const url = new URL(href, window.location.origin)
                    const path = url.pathname
                    if (path === window.location.pathname) a.classList.add('active')
                    else a.classList.remove('active')
                })
            } catch (e) { }
        }

        updateActive()
        const onPop = () => setTimeout(updateActive, 10)
        window.addEventListener('popstate', onPop)
        // also update after clicks (single page navigation)
        document.addEventListener('click', updateActive)
        return () => {
            window.removeEventListener('popstate', onPop)
            document.removeEventListener('click', updateActive)
        }
    }, [])

    return (
        <div className={`student-app ${darkMode ? 'dark' : 'light'}`}>
            <Header
                onToggleSidebar={() => setOpen(s => !s)}
                darkMode={darkMode}
                toggleTheme={toggleTheme}
            />
            <Sidebar isOpen={open} onClose={() => setOpen(false)} />

            <main className={`student-main ${open ? 'sidebar-open' : ''}`}>
                {children}
            </main>

            <Footer />
        </div>
    )
}
