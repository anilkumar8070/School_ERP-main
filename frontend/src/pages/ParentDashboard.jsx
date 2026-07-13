import React, { useState } from 'react'
import ParentLayout from '../components/parent/ParentLayout'

function StatCard({ title, value, icon }) {
    return (
        <div className="stat-card">
            <div className="stat-icon">{icon}</div>
            <div className="stat-body">
                <div className="stat-title">{title}</div>
                <div className="stat-value">{value}</div>
            </div>
        </div>
    )
}

export default function ParentDashboard() {
    const [loading] = useState(false)
    const counts = { attendance: '98%', notices: 12, messages: 4 }

    return (
        <ParentLayout>
            <div className="parent-page">
                <h2>Parent Dashboard</h2>
                <div className="dashboard-cards">
                    <StatCard title="Attendance" value={counts.attendance} icon="📅" />
                    <StatCard title="Notices" value={counts.notices} icon="📣" />
                    <StatCard title="Messages" value={counts.messages} icon="✉️" />
                </div>
                <p style={{ marginTop: 20 }}>This is a simple parent dashboard placeholder.</p>
            </div>
        </ParentLayout>
    )
}
