import React, { useEffect, useState } from 'react'
import { FaArrowRight, FaBookOpen, FaCalendarAlt, FaClipboardCheck, FaComments, FaFileAlt, FaGraduationCap, FaLayerGroup, FaRegClock } from 'react-icons/fa'
import { getMyMeetings, getStudentDashboardStats } from '../api'

const quickLinks = [
    { title: 'Meetings', text: 'Live sessions and parent-teacher conversations.', href: '/student/meeting', icon: FaComments },
    { title: 'Resources', text: 'Notes, files, study material, and downloads.', href: '/student/resources', icon: FaBookOpen },
    { title: 'Assignments', text: 'Submit work and track what is pending.', href: '/student/assignments', icon: FaClipboardCheck },
    { title: 'Notices', text: 'Announcements that matter today.', href: '/student/notices', icon: FaFileAlt },
    { title: 'Attendance', text: 'Presence summary and leave history.', href: '/student/attendance', icon: FaLayerGroup },
    { title: 'Calendar', text: 'Upcoming school events and academic rhythm.', href: '/student/calendar', icon: FaCalendarAlt },
]

export default function StudentDashboard() {
    const profileRaw = (() => {
        try { return localStorage.getItem('student_profile') } catch (e) { return null }
    })()
    const profile = profileRaw ? JSON.parse(profileRaw) : { name: 'Student' }
    const firstName = (profile.name || 'Student').split(' ')[0]

    const [stats, setStats] = useState({ attendance: '--', assignments: '--', tests: '--', schedule: '--', notices: '--' })
    const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')

    useEffect(() => {
        let mounted = true
        async function fetchStats() {
            try {
                if (!token) return
                const data = await getStudentDashboardStats(token)
                if (mounted) setStats(data)
            } catch (e) {
                console.warn('Failed to load dashboard stats', e)
            }
        }
        fetchStats()
        return () => { mounted = false }
    }, [token])

    return (
        <div className="parent-page parent-dashboard-shell">
            <section className="dashboard-header parent-hero-card">
                <div className="header-inner parent-hero-copy">
                    <div className="parent-kicker"><FaGraduationCap /> Student workspace</div>
                    <h2>Welcome back, {firstName}.</h2>
                    <p>
                        Your academic day, meetings, work, attendance, and notices are organized here with less noise and more focus.
                    </p>
                    <div className="parent-hero-actions">
                        <a className="btn-primary" href="/student/assignments">Open Assignments</a>
                        <a className="btn-secondary" href="/student/tests">Start Tests</a>
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
                            <strong>{stats.attendance}</strong>
                        </div>
                        <div>
                            <span>Assignments</span>
                            <strong>{stats.assignments}</strong>
                        </div>
                        <div>
                            <span>Tests</span>
                            <strong>{stats.tests}</strong>
                        </div>
                        <div>
                            <span>Notices</span>
                            <strong>{stats.notices}</strong>
                        </div>
                    </div>
                </div>
            </section>

            <section className="dashboard-cards parent-dashboard-cards">
                <article className="stat-card parent-dashboard-card">
                    <div className="stat-icon" aria-hidden="true"><FaLayerGroup /></div>
                    <div className="stat-body">
                        <div className="stat-title">Attendance</div>
                        <div className="stat-value">{stats.attendance}</div>
                        <div className="text-subtle" style={{ marginTop: 4 }}>Current session</div>
                    </div>
                </article>
                <article className="stat-card parent-dashboard-card">
                    <div className="stat-icon" aria-hidden="true"><FaClipboardCheck /></div>
                    <div className="stat-body">
                        <div className="stat-title">Assignments</div>
                        <div className="stat-value">{stats.assignments}</div>
                        <div className="text-subtle" style={{ marginTop: 4 }}>Active tasks</div>
                    </div>
                </article>
                <article className="stat-card parent-dashboard-card">
                    <div className="stat-icon" aria-hidden="true"><FaFileAlt /></div>
                    <div className="stat-body">
                        <div className="stat-title">Tests</div>
                        <div className="stat-value">{stats.tests}</div>
                        <div className="text-subtle" style={{ marginTop: 4 }}>Ready to attempt</div>
                    </div>
                </article>
                <article className="stat-card parent-dashboard-card">
                    <div className="stat-icon" aria-hidden="true"><FaCalendarAlt /></div>
                    <div className="stat-body">
                        <div className="stat-title">Schedule</div>
                        <div className="stat-value">{stats.schedule}</div>
                        <div className="text-subtle" style={{ marginTop: 4 }}>Classes today</div>
                    </div>
                </article>
            </section>

            <section className="parent-dashboard-grid">
                <article className="parent-dashboard-card parent-panel-card">
                    <div className="student-section-title">
                        <div>
                            <span><FaComments /> Meetings</span>
                            <h2>Upcoming Meetings</h2>
                        </div>
                        <a href="/student/meeting">View all</a>
                    </div>
                    <MeetingList />
                </article>

                <article className="parent-dashboard-card parent-panel-card" style={{ padding: '24px' }}>
                    <div style={{ padding: '16px 0' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--erp-muted)', letterSpacing: '0.08em' }}>Focus cue</span>
                        <h2 style={{ fontSize: '24px', color: 'var(--erp-ink)', margin: '12px 0', lineHeight: '1.4' }}>Keep one tab open, finish one thing, then move.</h2>
                        <p style={{ color: 'var(--erp-text)', lineHeight: '1.6' }}>Small progress compounds. Start with assignments, then review notices and calendar.</p>
                    </div>
                </article>
            </section>
        </div>
    )
}

function MeetingList() {
    const [meetings, setMeetings] = useState(null)
    const [loading, setLoading] = useState(true)
    const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')

    useEffect(() => {
        let mounted = true
        async function load() {
            setLoading(true)
            try {
                if (!token) throw new Error('No token')
                const data = await getMyMeetings(token)
                if (!mounted) return
                setMeetings(data || [])
            } catch (e) {
                console.warn('Failed to load meetings', e)
                if (mounted) setMeetings([])
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [token])

    if (loading) return <div className="student-empty-state">Loading meetings...</div>
    if (!meetings || meetings.length === 0) return <div className="student-empty-state">No upcoming meetings.</div>

    return (
        <div className="student-meeting-list">
            {meetings.map(m => (
                <div key={m._id} className="student-meeting-item">
                    <div>
                        <h4>{m.title}</h4>
                        <span>{new Date(m.datetime).toLocaleString()}</span>
                        <p>{m.summary}</p>
                    </div>
                    {(() => {
                        try {
                            if (new Date(m.datetime).getTime() <= new Date().getTime()) return <span className="student-status">Expired</span>
                        } catch (e) { }
                        if (m.link) return <a className="student-mini-btn" href={m.link} target="_blank" rel="noreferrer">Join</a>
                        return <span className="student-status">No link</span>
                    })()}
                </div>
            ))}
        </div>
    )
}
