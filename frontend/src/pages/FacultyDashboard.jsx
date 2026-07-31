import React from 'react'
import { useNavigate } from 'react-router-dom'
import FacultyLayout from '../components/faculty/FacultyLayout'
import { getAuth } from '../utils/session'
import { getFacultyDashboard } from '../api'
import { useQuery } from '@tanstack/react-query'

function fmt(n) { return (n || 0).toLocaleString() }

export default function FacultyDashboard() {
    const { token } = getAuth()
    const navigate = useNavigate()
    const { data, isError } = useQuery({
        queryKey: ['facultyDashboard', token],
        queryFn: () => getFacultyDashboard(token),
        enabled: !!token,
        retry: 0,
        // Poll every 15 seconds to keep dashboard numbers near real-time
        refetchInterval: 15000,
    })
    const dashboard = (!token || isError || !data) ? { classes: 5, students: 142, assignments: 12 } : {
        classes: (data && (data.assignedClassesCount || (Array.isArray(data.assignedClasses) ? data.assignedClasses.length : 0))) || 0,
        students: (data && (data.assignedStudentsCount || data.students)) || 0,
        assignments: (data && (data.assignments || 0)) || 0,
        upcomingMeetings: (data && data.upcomingMeetings) || 0
    }

    return (
        <FacultyLayout title="Faculty Dashboard">
            <div className="parent-page parent-dashboard-shell">
                <section className="dashboard-header parent-hero-card">
                    <div className="header-inner parent-hero-copy">
                        <div className="parent-kicker">Faculty workspace</div>
                        <h2>Welcome back, Faculty.</h2>
                        <p>
                            Manage your classes, students, assignments, and schedule from your central academic hub.
                        </p>
                        <div className="parent-hero-actions">
                            <a className="btn-primary" href="/faculty/assignments">Upload Assignment</a>
                            <a className="btn-secondary" href="/faculty/attendance">Take Attendance</a>
                        </div>
                    </div>

                    <div className="parent-hero-panel">
                        <div className="parent-hero-chip">
                            <span>Overview</span>
                            <strong>At a glance</strong>
                        </div>
                        <div className="parent-hero-grid">
                            <div>
                                <span>Classes</span>
                                <strong>{fmt(dashboard.classes)}</strong>
                            </div>
                            <div>
                                <span>Students</span>
                                <strong>{fmt(dashboard.students)}</strong>
                            </div>
                            <div>
                                <span>Assignments</span>
                                <strong>{fmt(dashboard.assignments)}</strong>
                            </div>
                            <div>
                                <span>Meetings</span>
                                <strong>{fmt(dashboard.upcomingMeetings)}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="dashboard-cards parent-dashboard-cards">
                    <article className="stat-card parent-dashboard-card">
                        <div className="stat-icon" aria-hidden="true">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 11V7a5 5 0 1 1 10 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div className="stat-body">
                            <div className="stat-title">Classes</div>
                            <div className="stat-value">{fmt(dashboard.classes)}</div>
                            <div className="text-subtle" style={{ marginTop: 4 }}>Assigned to you</div>
                        </div>
                    </article>
                    <article className="stat-card parent-dashboard-card">
                        <div className="stat-icon" aria-hidden="true">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="9.5" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div className="stat-body">
                            <div className="stat-title">Students</div>
                            <div className="stat-value">{fmt(dashboard.students)}</div>
                            <div className="text-subtle" style={{ marginTop: 4 }}>Total in classes</div>
                        </div>
                    </article>
                    <article className="stat-card parent-dashboard-card">
                        <div className="stat-icon" aria-hidden="true">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div className="stat-body">
                            <div className="stat-title">Assignments</div>
                            <div className="stat-value">{fmt(dashboard.assignments)}</div>
                            <div className="text-subtle" style={{ marginTop: 4 }}>Pending reviews</div>
                        </div>
                    </article>
                    <article className="stat-card parent-dashboard-card">
                        <div className="stat-icon" aria-hidden="true">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
                                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div className="stat-body">
                            <div className="stat-title">Meetings</div>
                            <div className="stat-value">{fmt(dashboard.upcomingMeetings)}</div>
                            <div className="text-subtle" style={{ marginTop: 4 }}>Scheduled today</div>
                        </div>
                    </article>
                </section>

                <section className="parent-dashboard-actions">
                    <a className="quick-card parent-dashboard-card parent-action-card" href="/faculty/assignments">
                        <div className="qc-top">
                            <span className="qc-icon" aria-hidden="true">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </span>
                            <div className="quick-card-title">Upload Assignment</div>
                        </div>
                        <div className="quick-card-desc">Create and upload assignment files with due dates.</div>
                        <strong className="parent-action-link">Open &rarr;</strong>
                    </a>
                    
                    <a className="quick-card parent-dashboard-card parent-action-card" href="/faculty/add-marks">
                        <div className="qc-top">
                            <span className="qc-icon" aria-hidden="true">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </span>
                            <div className="quick-card-title">Add / Update Marks</div>
                        </div>
                        <div className="quick-card-desc">Enter student marks by class and subject.</div>
                        <strong className="parent-action-link">Open &rarr;</strong>
                    </a>

                    <a className="quick-card parent-dashboard-card parent-action-card" href="/faculty/attendance">
                        <div className="qc-top">
                            <span className="qc-icon" aria-hidden="true">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 13h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 3v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </span>
                            <div className="quick-card-title">Class Attendance</div>
                        </div>
                        <div className="quick-card-desc">Record and review attendance class-wise.</div>
                        <strong className="parent-action-link">Open &rarr;</strong>
                    </a>

                    <a className="quick-card parent-dashboard-card parent-action-card" href="/faculty/attendance-self">
                        <div className="qc-top">
                            <span className="qc-icon" aria-hidden="true">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M18 21v-2a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </span>
                            <div className="quick-card-title">Self Attendance</div>
                        </div>
                        <div className="quick-card-desc">Mark your attendance and download history.</div>
                        <strong className="parent-action-link">Open &rarr;</strong>
                    </a>
                </section>
            </div>
        </FacultyLayout>
    )
}
