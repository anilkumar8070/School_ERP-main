import React from 'react'
import { useNavigate } from 'react-router-dom'
import FacultyLayout from '../components/faculty/FacultyLayout'
import { getAuth } from '../utils/session'
import { getFacultyDashboard } from '../api'
import { useQuery } from '@tanstack/react-query'

function fmt(n) { return n.toLocaleString() }

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
            <div className="faculty-page">
                <h2>Welcome, Faculty</h2>
                <div className="faculty-dashboard-cards">
                    <div className="faculty-card">
                        <div className="card-top">
                            <span className="card-icon" aria-hidden>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M7 11V7a5 5 0 1 1 10 0v4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    <rect x="3" y="11" width="18" height="10" rx="2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <div className="card-title">Classes</div>
                        </div>
                        <div className="card-value">{fmt(dashboard.classes)}</div>
                    </div>

                    <div className="faculty-card">
                        <div className="card-top">
                            <span className="card-icon" aria-hidden>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="9.5" cy="7" r="3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M20 8v6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <div className="card-title">Students</div>
                        </div>
                        <div className="card-value">{fmt(dashboard.students)}</div>
                    </div>

                    <div className="faculty-card">
                        <div className="card-top">
                            <span className="card-icon" aria-hidden>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <div className="card-title">Pending Assignments</div>
                        </div>
                        <div className="card-value">{fmt(dashboard.assignments)}</div>
                    </div>
                </div>

                <h3 style={{ marginTop: 22 }}>Quick Actions</h3>
                <div className="faculty-actions-grid" style={{ marginTop: 12 }}>
                    <div className="quick-card" onClick={() => navigate('/faculty/assignments')} role="button" tabIndex={0}>
                        <div className="qc-top">
                            <span className="qc-icon" aria-hidden>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <div className="quick-card-title">Upload Assignment</div>
                        </div>
                        <div className="quick-card-desc">Create and upload assignment files with due dates.</div>
                    </div>

                    <div className="quick-card" onClick={() => navigate('/faculty/add-marks')} role="button" tabIndex={0}>
                        <div className="qc-top">
                            <span className="qc-icon" aria-hidden>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 20h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <div className="quick-card-title">Add / Update Marks</div>
                        </div>
                        <div className="quick-card-desc">Enter student marks by class and subject.</div>
                    </div>

                    <div className="quick-card" onClick={() => navigate('/faculty/attendance')} role="button" tabIndex={0}>
                        <div className="qc-top">
                            <span className="qc-icon" aria-hidden>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 13h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M12 3v10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <div className="quick-card-title">Total Attendance</div>
                        </div>
                        <div className="quick-card-desc">Record and review attendance class-wise.</div>
                    </div>

                    <div className="quick-card" onClick={() => navigate('/faculty/attendance-self')} role="button" tabIndex={0}>
                        <div className="qc-top">
                            <span className="qc-icon" aria-hidden>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
                                    <path d="M18 21v-2a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </span>
                            <div className="quick-card-title">Self Attendance</div>
                        </div>
                        <div className="quick-card-desc">Mark your attendance and download history.</div>
                    </div>
                </div>
            </div>
        </FacultyLayout>
    )
}
