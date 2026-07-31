import { useEffect, useState } from 'react'
import { API_BASE } from '../api'
import { getAuth } from '../utils/session'

function formatNumber(n) {
    const num = (typeof n === 'number') ? n : (Number(n) || 0)
    return num.toLocaleString()
}


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
            <div className="parent-page parent-dashboard-shell">
                <section className="dashboard-header parent-hero-card">
                    <div className="header-inner parent-hero-copy">
                        <div className="parent-kicker"><FiBriefcase /> Admin workspace</div>
                        <h2>Welcome back, Admin.</h2>
                        <p>
                            Oversee school operations, manage students and faculty, and track finances from your command center.
                        </p>
                        <div className="parent-hero-actions">
                            <a className="btn-primary" href="/admin/students">Manage Students</a>
                            <a className="btn-secondary" href="/admin/finance">View Finances</a>
                        </div>
                    </div>

                    <div className="parent-hero-panel">
                        <div className="parent-hero-chip">
                            <span>Overview</span>
                            <strong>At a glance</strong>
                        </div>
                        <div className="parent-hero-grid">
                            <div>
                                <span>Students</span>
                                <strong>{formatNumber(counts.students)}</strong>
                            </div>
                            <div>
                                <span>Teachers</span>
                                <strong>{formatNumber(counts.teachers)}</strong>
                            </div>
                            <div>
                                <span>Classes</span>
                                <strong>{formatNumber(counts.classes)}</strong>
                            </div>
                            <div>
                                <span>Revenue</span>
                                <strong>₹{formatNumber(counts.fees)}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="dashboard-cards parent-dashboard-cards">
                    <article className="stat-card parent-dashboard-card">
                        <div className="stat-icon" aria-hidden="true"><FiUsers /></div>
                        <div className="stat-body">
                            <div className="stat-title">Total Students</div>
                            <div className="stat-value">{formatNumber(counts.students)}</div>
                            <div className="text-subtle" style={{ marginTop: 4 }}>Active enrolled</div>
                        </div>
                    </article>
                    <article className="stat-card parent-dashboard-card">
                        <div className="stat-icon" aria-hidden="true"><FiCheckCircle /></div>
                        <div className="stat-body">
                            <div className="stat-title">Attendance Rate</div>
                            <div className="stat-value">0%</div>
                            <div className="text-subtle" style={{ marginTop: 4 }}>Today's average</div>
                        </div>
                    </article>
                    <article className="stat-card parent-dashboard-card">
                        <div className="stat-icon" aria-hidden="true"><FiDollarSign /></div>
                        <div className="stat-body">
                            <div className="stat-title">Fee Collection</div>
                            <div className="stat-value">₹{formatNumber(counts.fees)}</div>
                            <div className="text-subtle" style={{ marginTop: 4 }}>Total revenue</div>
                        </div>
                    </article>
                    <article className="stat-card parent-dashboard-card">
                        <div className="stat-icon" aria-hidden="true"><FiBriefcase /></div>
                        <div className="stat-body">
                            <div className="stat-title">Faculty Members</div>
                            <div className="stat-value">{formatNumber(counts.teachers)}</div>
                            <div className="text-subtle" style={{ marginTop: 4 }}>Active staff</div>
                        </div>
                    </article>
                </section>
            </div>
        </AdminLayout>
    )
}
