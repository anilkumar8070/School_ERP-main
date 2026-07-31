
export default function StaffDashboard() {
    // Minimal attendance card on dashboard; details available on the attendance page
    return (
        <StaffLayout title="Dashboard">
            <div className="parent-page parent-dashboard-shell">
                <section className="dashboard-header parent-hero-card">
                    <div className="header-inner parent-hero-copy">
                        <div className="parent-kicker">Staff workspace</div>
                        <h2>Welcome back, Staff.</h2>
                        <p>
                            Manage your daily schedule, track your attendance, and access important resources.
                        </p>
                        <div className="parent-hero-actions">
                            <Link className="btn-primary" to="/staff/attendance">Open Attendance</Link>
                        </div>
                    </div>

                    <div className="parent-hero-panel">
                        <div className="parent-hero-chip">
                            <span>Overview</span>
                            <strong>At a glance</strong>
                        </div>
                        <div className="parent-hero-grid">
                            <div>
                                <span>Attendance</span>
                                <strong>100%</strong>
                            </div>
                            <div>
                                <span>Leaves</span>
                                <strong>0</strong>
                            </div>
                            <div>
                                <span>Tasks</span>
                                <strong>2</strong>
                            </div>
                            <div>
                                <span>Messages</span>
                                <strong>0</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="dashboard-cards parent-dashboard-cards">
                    <article className="stat-card parent-dashboard-card">
                        <div className="stat-icon" aria-hidden="true">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div className="stat-body">
                            <div className="stat-title">Attendance</div>
                            <div className="stat-value">100%</div>
                            <div className="text-subtle" style={{ marginTop: 4 }}>Current month</div>
                        </div>
                    </article>
                </section>

                <section className="parent-dashboard-actions">
                    <Link className="quick-card parent-dashboard-card parent-action-card" to="/staff/attendance">
                        <div className="qc-top">
                            <span className="qc-icon" aria-hidden="true">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M18 21v-2a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </span>
                            <div className="quick-card-title">Daily Attendance</div>
                        </div>
                        <div className="quick-card-desc">Mark your presence and check leave status.</div>
                        <strong className="parent-action-link">Open &rarr;</strong>
                    </Link>
                </section>
            </div>
        </StaffLayout>
    )
}
