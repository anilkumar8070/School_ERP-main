import React from 'react'
import AdminLayout from '../components/admin/AdminLayout'

export default function TeacherPanel() {
    const items = [
        { label: 'Dashboard', href: '/teacher/dashboard' },
        { label: 'Classes', href: '#' },
        { label: 'Attendance', href: '#' },
        { label: 'Meetings', href: '#' },
        { label: 'Complaints', href: '#' },
        { label: 'Events', href: '#' },
    ]

    return (
        <AdminLayout title="Teacher Panel" sidebarItems={items} copyrightText={'copyright @TeacherPanel 2025'}>
            <div className="admin-page">
                <h2>Welcome to Teacher Dashboard</h2>
                <p>This is the teacher panel placeholder. Select a section from the sidebar.</p>
            </div>
        </AdminLayout>
    )
}
