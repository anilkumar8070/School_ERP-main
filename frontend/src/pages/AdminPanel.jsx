import React, { useEffect, useState } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import { API_BASE } from '../api'
import { getAuth } from '../utils/session'

function formatNumber(n) {
    const num = (typeof n === 'number') ? n : (Number(n) || 0)
    return num.toLocaleString()
}

import { FiUsers, FiCheckCircle, FiDollarSign, FiBriefcase } from 'react-icons/fi'

// ... existing imports

export default function AdminPanel() {
    const [counts, setCounts] = useState({ students: 0, teachers: 0, classes: 0, fees: 0 })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // ... (existing load logic)
        async function load() {
            setLoading(true)
            try {
                const { token } = getAuth()
                const res = await fetch(`${API_BASE}/api/admin/dashboard`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                if (res.ok) {
                    const data = await res.json()
                    if (data) {
                        setCounts({
                            students: data.students || 0,
                            teachers: data.teachers || 0,
                            classes: data.classes || 0,
                            fees: data.fees || 0,
                        })
                    }
                }
            } catch (err) {
                console.error('Failed to load admin dashboard', err)
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

    return (
        <AdminLayout>
            <div className="admin-page">
                {/* Dashboard Welcome Section */}
                <div className="dashboard-header">
                    <div className="welcome-text">
                        <h2>Welcome back, Admin!</h2>
                        <p>Here's what's happening with your school today.</p>
                    </div>
                    <div className="system-status">
                        <span className="status-dot"></span> System Online
                    </div>
                </div>

                {/* Stats Grid - 4 Columns */}
                <div className="dashboard-stats-grid">

                    {/* Card 1: Total Students */}
                    <div className="stat-card">
                        <div className="stat-icon-wrapper text-purple">
                            <FiUsers className="stat-icon-svg" />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Total Students</span>
                            <div className="stat-value">{formatNumber(counts.students)}</div>
                        </div>
                    </div>

                    {/* Card 2: Attendance Rate */}
                    <div className="stat-card">
                        <div className="stat-icon-wrapper text-green">
                            <FiCheckCircle className="stat-icon-svg" />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Attendance Rate</span>
                            <div className="stat-value">0%</div>
                        </div>
                    </div>

                    {/* Card 3: Fee Collection */}
                    <div className="stat-card">
                        <div className="stat-icon-wrapper text-teal">
                            <FiDollarSign className="stat-icon-svg" />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Fee Collection</span>
                            <div className="stat-value">₹{formatNumber(counts.fees)}</div>
                        </div>
                    </div>

                    {/* Card 4: Faculty Members */}
                    <div className="stat-card">
                        <div className="stat-icon-wrapper text-orange">
                            <FiBriefcase className="stat-icon-svg" />
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">Faculty Members</span>
                            <div className="stat-value">{formatNumber(counts.teachers)}</div>
                        </div>
                    </div>

                </div>

            </div>
        </AdminLayout>
    )
}
