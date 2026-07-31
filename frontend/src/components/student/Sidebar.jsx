import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaAngleDown, FaTimes, FaCircle } from 'react-icons/fa'
import {
    MdDashboard,
    MdSchool,
    MdPerson,
    MdPeople,
    MdWork,
    MdFamilyRestroom,
    MdAttachMoney,
    MdEventAvailable,
    MdAssignment
} from 'react-icons/md'
import './Sidebar.css'

const menuItems = [
    {
        title: 'Dashboard',
        icon: <MdDashboard />,
        path: '/student-dashboard',
        subItems: []
    },
    {
        title: 'Academics',
        icon: <MdSchool />,
        subItems: [
            { label: 'Syllabus', path: '/student/syllabus' },
            { label: 'Assignments', path: '/student/assignments' },
            { label: 'Tests', path: '/student/tests' },
            { label: 'Results', path: '/student/results' },
            { label: 'Marks', path: '/student/marks' },
            { label: 'Report Card', path: '/student/report-card' },
            { label: 'Admit Card', path: '/student/admit-cards' },
            { label: 'Certificates', path: '/student/certificates' },
        ]
    },
    {
        title: 'Attendance & Schedule',
        icon: <MdEventAvailable />,
        subItems: [
            { label: 'Attendance', path: '/student/attendance' },
            { label: 'Time-Table', path: '/student/timetable' },
        ]
    },
    {
        title: 'Student Services',
        icon: <MdPerson />,
        subItems: [
            { label: 'Card', path: '/student/card' },
            { label: 'Hostel', path: '/student/hostel' },
            { label: 'Transport', path: '/student/transport' },
        ]
    },
    {
        title: 'Parents & Support',
        icon: <MdFamilyRestroom />,
        subItems: [
            { label: 'Parents', path: '/student/parents' },
            { label: 'Complaint Box', path: '/student/complaint' },
        ]
    },
    {
        title: 'Finance',
        icon: <MdAttachMoney />,
        subItems: [
            { label: 'Fee Structure', path: '/student/fees' },
        ]
    },
]

export default function Sidebar({ isOpen, onClose }) {
    const location = useLocation()
    const [openCategories, setOpenCategories] = useState({})

    // Initialize open categories based on current path on mount/update
    useEffect(() => {
        const path = location.pathname
        const newOpenState = { ...openCategories }
        let changed = false

        menuItems.forEach((item, index) => {
            if (item.subItems) {
                const isActive = item.subItems.some(sub => path === sub.path || path.startsWith(sub.path + '/'))
                if (isActive && !newOpenState[index]) {
                    newOpenState[index] = true
                    changed = true
                }
            }
        })

        if (changed) {
            setOpenCategories(newOpenState)
        }
    }, [location.pathname])

    const toggleCategory = (index) => {
        setOpenCategories(prev => ({
            ...prev,
            [index]: !prev[index]
        }))
    }

    const isActive = (path) => {
        return location.pathname === path || location.pathname.startsWith(path + '/')
    }

    return (
        <>
            {/* Overlay for mobile when sidebar is open */}
            {isOpen && (
                <div
                    className="sidebar-overlay mobile-overlay"
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 1050
                    }}
                />
            )}

            <nav className={`student-sidebar-new ${isOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <span>Student Panel</span>
                    </div>
                    {/* Always allow closing via button on mobile/desktop */}
                    <button className="close-sidebar-btn" onClick={onClose} aria-label="Close Sidebar">
                        <FaTimes />
                    </button>
                </div>

                <ul className="sidebar-menu">
                    {menuItems.map((item, index) => {
                        const isCategoryOpen = openCategories[index]
                        // Check if parent is active (if it's a direct link) or any child is active
                        const isParentActive = item.path
                            ? isActive(item.path)
                            : item.subItems?.some(sub => isActive(sub.path))

                        if (!item.subItems || item.subItems.length === 0) {
                            return (
                                <li key={index} className="menu-item">
                                    <Link
                                        to={item.path}
                                        className={`menu-link ${isActive(item.path) ? 'active' : ''}`}
                                        onClick={() => {
                                            // Close on mobile selection if needed, generally kept open on desktop
                                            if (window.innerWidth <= 768) onClose()
                                        }}
                                    >
                                        <div className="menu-content">
                                            <span className="menu-icon">{item.icon}</span>
                                            <span className="menu-text">{item.title}</span>
                                        </div>
                                    </Link>
                                </li>
                            )
                        }

                        return (
                            <li key={index} className="menu-item">
                                <div
                                    className={`menu-link ${isParentActive ? 'active' : ''}`}
                                    onClick={() => toggleCategory(index)}
                                >
                                    <div className="menu-content">
                                        <span className="menu-icon">{item.icon}</span>
                                        <span className="menu-text">{item.title}</span>
                                    </div>
                                    <FaAngleDown className={`menu-arrow ${isCategoryOpen ? 'rotated' : ''}`} />
                                </div>

                                <ul className={`submenu ${isCategoryOpen ? 'open' : ''}`}>
                                    {item.subItems.map((sub, subIdx) => (
                                        <li key={subIdx} className="submenu-item">
                                            <Link
                                                to={sub.path}
                                                className={`submenu-link ${isActive(sub.path) ? 'active' : ''}`}
                                                onClick={() => {
                                                    if (window.innerWidth <= 768) onClose()
                                                }}
                                            >
                                                <FaCircle className="submenu-icon" size={6} />
                                                {sub.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        )
                    })}
                </ul>
            </nav>
        </>
    )
}
