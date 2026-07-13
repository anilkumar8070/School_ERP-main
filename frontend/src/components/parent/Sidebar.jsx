import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaTimes, FaCircle } from 'react-icons/fa'
import {
    MdDashboard,
    MdPeople,
    MdAssignment,
    MdEventAvailable,
    MdAnnouncement,
    MdMessage,
    MdPerson,
    MdSchool,
    MdMeetingRoom
} from 'react-icons/md'

export default function Sidebar({ isOpen, onClose }) {
    const location = useLocation()
    const path = location.pathname

    const menuItems = [
        {
            title: 'Dashboard',
            icon: <MdDashboard />,
            path: '/parent-dashboard'
        },
        {
            title: 'Link Student',
            icon: <MdPeople />,
            path: '/parent/link-student'
        },
        {
            title: 'Student Progress',
            icon: <MdAssignment />,
            path: '/parent/progress'
        },
        {
            title: 'Attendance',
            icon: <MdEventAvailable />,
            path: '/parent/attendance'
        },
        {
            title: 'Notices',
            icon: <MdAnnouncement />,
            path: '/parent/notices'
        },
        {
            title: 'Meetings',
            icon: <MdMeetingRoom />,
            path: '/parent/meeting'
        },
        {
            title: 'Messages',
            icon: <MdMessage />,
            path: '/parent/messages'
        },
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
                    <div className="font-bold text-lg text-[var(--primary)]">Parent Panel</div>
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
                                    // Close on mobile selection
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
