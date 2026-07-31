import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaAngleDown, FaTimes, FaCircle } from 'react-icons/fa'
import {
    MdDashboard,
    MdSchool,
    MdEventAvailable,
    MdAssignment,
    MdMenuBook,
    MdAnnouncement,
    MdMeetingRoom,
    MdCardMembership,
    MdHouse,
    MdAttachMoney,
    MdPerson
} from 'react-icons/md'
import './Sidebar.css'

const menuItems = [
    {
        title: 'Dashboard',
        icon: <MdDashboard />,
        path: '/faculty-dashboard',
        subItems: []
    },
    {
        title: 'Academic & Teaching',
        icon: <MdSchool />,
        subItems: [
            { label: 'Students', path: '/faculty/students' },
            { label: 'Assignments', path: '/faculty/assignments' },
            { label: 'Test Management', path: '/faculty/tests' },
            { label: 'Test Results', path: '/faculty/test-results' },
            { label: 'Marks', path: '/faculty/add-marks' },
            { label: 'Faculty Timetable', path: '/faculty/faculty-timetable' },
        ]
    },
    {
        title: 'Exams & Records',
        icon: <MdAssignment />,
        subItems: [
            { label: 'Admit Card', path: '/faculty/admit-cards' },
            { label: 'Report Card', path: '/faculty/report-card' },
            { label: 'Certificates', path: '/faculty/certificates' },
        ]
    },
    {
        title: 'Attendance & Leave',
        icon: <MdEventAvailable />,
        subItems: [
            { label: 'Attendance', path: '/faculty/attendance' },
            { label: 'Leaves', path: '/faculty/leaves' },
        ]
    },
    {
        title: 'Library & Resources',
        icon: <MdMenuBook />,
        subItems: [
            { label: 'Library', path: '/faculty/library' },
        ]
    },
    {
        title: 'Communication & Activities',
        icon: <MdAnnouncement />,
        subItems: [
            { label: 'Notices', path: '/faculty/notices' },
            { label: 'Meeting', path: '/faculty/meeting' },
        ]
    },
    {
        title: 'Faculty Services',
        icon: <MdPerson />,
        subItems: [
            { label: 'Staff Salary', path: '/faculty/salary' },
            { label: 'Card', path: '/faculty/card-management' },
        ]
    },
    {
        title: 'House & Activities',
        icon: <MdHouse />,
        subItems: [
            { label: 'House Management', path: '/faculty/house-management' },
        ]
    },
    {
        title: 'Academics & Operations',
        icon: <MdAssignment />,
        subItems: [
            { label: 'Behavior Records', path: '/faculty/behavior-records' },
            { label: 'Lesson Plan', path: '/faculty/lesson-plan' },
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

            <nav className={`faculty-sidebar-new ${isOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <span>Faculty Panel</span>
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
