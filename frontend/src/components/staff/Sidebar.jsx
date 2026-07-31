import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaTimes } from 'react-icons/fa'
import {
    MdDashboard,
    MdEvent,
    MdEventAvailable,
    MdAnnouncement,
    MdMeetingRoom,
    MdBadge,
    MdWorkspacePremium,
    MdAttachMoney
} from 'react-icons/md'

export default function Sidebar({ isOpen, onClose }) {
    const location = useLocation()
    const path = location.pathname

    const menuItems = [
        { title: 'Dashboard', path: '/staff-dashboard', icon: <MdDashboard /> },
        { title: 'Calendar', path: '/staff/calendar', icon: <MdEvent /> },
        { title: 'Attendance', path: '/staff/attendance', icon: <MdEventAvailable /> },
        { title: 'Notices', path: '/staff/notices', icon: <MdAnnouncement /> },
        { title: 'Meeting', path: '/staff/meeting', icon: <MdMeetingRoom /> },
        { title: 'ID Card', path: '/staff/card', icon: <MdBadge /> },
        { title: 'Certificates', path: '/staff/certificates', icon: <MdWorkspacePremium /> },
        { title: 'Salary', path: '/staff/salary', icon: <MdAttachMoney /> },
    ]

    const isActive = (itemPath) => {
        return path === itemPath || path.startsWith(itemPath + '/')
    }

    return (
        <>
            {/* Overlay for mobile when sidebar is open */}
            {isOpen && (
                <div
                    className="sidebar-overlay fixed inset-0 bg-black/50 z-[85] md:hidden"
                    onClick={onClose}
                />
            )}

            <nav className={`parent-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="flex items-center justify-between mb-4 px-2">
                    <div className="font-bold text-lg text-[var(--primary)]">Staff Panel</div>
                    <button className="close-sidebar-btn" onClick={onClose} aria-label="Close Sidebar">
                        <FaTimes />
                    </button>
                </div>

                <ul className="sidebar-menu">
                    {menuItems.map((item, index) => (
                        <li key={index} className="menu-item">
                            <Link
                                to={item.path}
                                className={`menu-link ${isActive(item.path) ? 'active' : ''}`}
                                onClick={() => {
                                    if (window.innerWidth <= 768) onClose()
                                }}
                            >
                                <div className="menu-content">
                                    <span className="menu-icon">{item.icon}</span>
                                    <span className="menu-text">{item.title}</span>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </>
    )
}
