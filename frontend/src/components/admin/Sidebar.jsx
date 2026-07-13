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
    MdAdminPanelSettings,
    MdAttachMoney,
    MdEventAvailable,
    MdImage,
    MdAssignment
} from 'react-icons/md'
import './Sidebar.css'

const menuItems = [
    {
        title: 'Dashboard',
        icon: <MdDashboard />,
        path: '/admin-dashboard',
        subItems: [] // Direct link, no sub-items
    },
    {
        title: 'Academic Management',
        icon: <MdSchool />,
        subItems: [
            { label: 'Academic Management', path: '/admin/academics' },
            { label: 'Faculty Timetable', path: '/admin/faculty-timetable' },
            { label: 'Admit Card', path: '/admin/admit-cards' },
            { label: 'Certificates', path: '/admin/certificates' },
            { label: 'Report Card', path: '/admin/report-card' },
            { label: 'Test Creation', path: '/admin/tests' },
            { label: 'View Test Series', path: '/admin/view-test-series' },
            { label: 'Test Results', path: '/admin/test-results' },
            { label: 'Student Rank Analytics', path: '/admin/analytics-student-rank' },
        ]
    },
    {
        title: 'Student Management',
        icon: <MdPerson />,
        subItems: [
            { label: 'Student Management', path: '/admin/students' },
            { label: 'Student Attendance', path: '/admin/attendance/students' },
            { label: 'Student Leave', path: '/admin/leaves/student' },
            { label: 'Student Approvals', path: '/admin/student-approvals' },
            { label: 'Requests', path: '/admin/requests' },
        ]
    },
    {
        title: 'Faculty Management',
        icon: <MdPeople />,
        subItems: [
            { label: 'Faculty Management', path: '/admin/faculty' },
            { label: 'Faculty Attendance', path: '/admin/attendance/faculty' },
            { label: 'Faculty Leave', path: '/admin/leaves/faculty' },
            { label: 'Faculty Salary', path: '/admin/salary' },
        ]
    },
    {
        title: 'Staff & HR Management',
        icon: <MdWork />,
        subItems: [
            { label: 'Staff Management', path: '/admin/staff' },
            { label: 'Staff Attendance', path: '/admin/attendance/staff' },
            { label: 'Staff Leave', path: '/admin/leaves/staff' },
            { label: 'Staff Salary', path: '/admin/staff-salary' },
            { label: 'HR Management', path: '/admin/hr' },
        ]
    },
    {
        title: 'Parent Management',
        icon: <MdFamilyRestroom />,
        subItems: [
            { label: 'Parents Management', path: '/admin/parents' },
            { label: 'Parent Messages', path: '/admin/messages' },
        ]
    },
    {
        title: 'Administration & Operations',
        icon: <MdAdminPanelSettings />,
        subItems: [
            // 'Admin Settings' mapped to /admin/admins or /admin/profile based on context, choosing admins management for now
            { label: 'Admin Settings', path: '/admin/admins' },
            { label: 'Approval', path: '/admin/approvals' },
            { label: 'House Management', path: '/admin/house-management' },
            { label: 'Hostel Management', path: '/admin/hostel-management' },
            { label: 'Transport Management', path: '/admin/transport-management' },
        ]
    },
    {
        title: 'Finance & Accounts',
        icon: <MdAttachMoney />,
        subItems: [
            { label: 'Finance Management', path: '/admin/finance' },
            { label: 'Card Management', path: '/admin/card-management' },
        ]
    },
    {
        title: 'Meetings & Communication',
        icon: <MdEventAvailable />,
        subItems: [
            { label: 'Meeting', path: '/admin/meeting' },
            { label: 'Notices', path: '/admin/notices' },
            { label: 'Notifications', path: '/admin/notifications' },
            { label: 'Notification Settings', path: '/admin/notification-settings' },
            { label: 'Complaints', path: '/admin/complaints' },
        ]
    },
    {
        title: 'Media & Events',
        icon: <MdImage />,
        subItems: [
            { label: 'Gallery', path: '/admin/gallery' },
            { label: 'Events', path: '/admin/events' },
        ]
    },
    {
        title: 'Forms & Queries',
        icon: <MdAssignment />,
        subItems: [
            { label: 'Form', path: '/admin/form' },
            { label: 'Forms Query', path: '/admin/form-queries' },
            { label: 'Contact Page Query', path: '/admin/contact-queries' },
        ]
    },
    {
        title: 'Other Operations',
        icon: <MdAssignment />,
        subItems: [
            { label: 'Library', path: '/admin/library-management' },
            { label: 'Behavior Records', path: '/admin/behavior-records' },
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
                        zIndex: 40
                    }}
                />
            )}

            <nav className={`admin-sidebar-new ${isOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <span>School ERP</span>
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
