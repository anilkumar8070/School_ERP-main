import { useEffect, useState } from 'react'
import { getAuth } from '../utils/session'
import { getMyMeetings, getNotices } from '../api'

function StatCard({ title, value, icon, hint }) {
    return (
        <article className="stat-card parent-dashboard-card">
            <div className="stat-icon" aria-hidden="true">{icon}</div>
            <div className="stat-body">
                <div className="stat-title">{title}</div>
                <div className="stat-value">{value}</div>
                {hint ? <div className="text-subtle" style={{ marginTop: 4 }}>{hint}</div> : null}
            </div>
        </article>
    )
}

function ActionCard({ href, title, text, icon }) {
    return (
        <a className="quick-card parent-dashboard-card parent-action-card" href={href}>
            <div className="qc-top">
                <span className="qc-icon" aria-hidden="true">{icon}</span>
                <div className="quick-card-title">{title}</div>
            </div>
            <div className="quick-card-desc">{text}</div>
            <strong className="parent-action-link">Open <FaArrowRight /></strong>
        </a>
    )
}

export default function ParentDashboard() {
    const { token } = getAuth()
    const [meetings, setMeetings] = useState([])
    const [notices, setNotices] = useState([])
    const [loading, setLoading] = useState(true)

    const profile = (() => {
        try {
            const raw = localStorage.getItem('parent_profile')
            if (raw) return JSON.parse(raw)
        } catch (e) { }
        try {
            const auth = getAuth()
            return { name: auth.name || 'Parent' }
        } catch (e) { }
        return { name: 'Parent' }
    })()

    const firstName = (profile.name || 'Parent').split(' ')[0]

    useEffect(() => {
        let mounted = true
        async function load() {
            setLoading(true)
            try {
                const [meetingData, noticeData] = await Promise.all([
                    getMyMeetings(token).catch(() => []),
                    getNotices({}, token).catch(() => []),
                ])
                if (!mounted) return
                setMeetings(Array.isArray(meetingData) ? meetingData : [])
                setNotices(Array.isArray(noticeData) ? noticeData : [])
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [token])

    const linkedStudentCount = (() => {
        try {
            const raw = localStorage.getItem('parent_profile')
            if (!raw) return 1
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed.students)) return parsed.students.length
            if (Array.isArray(parsed.linkedStudents)) return parsed.linkedStudents.length
            return parsed.studentName ? 1 : 1
        } catch (e) {
            return 1
        }
    })()

    const attendance = '98%'
    const unreadNotices = notices.length
    const pendingMessages = 4

    const recentMeetings = meetings.slice(0, 3)
    const recentNotices = notices.slice(0, 3)

    return (
        <ParentLayout title="Parent Dashboard">
            <div className="parent-page parent-dashboard-shell">
                <section className="dashboard-header parent-hero-card">
                    <div className="header-inner parent-hero-copy">
                        <div className="parent-kicker"><FaUserGraduate /> Parent workspace</div>
                        <h2>Welcome back, {firstName}.</h2>
                        <p>
                            Track attendance, read notices, and join meetings from one place without digging through the portal.
                        </p>
                        <div className="parent-hero-actions">
                            <a className="btn-primary" href="/parent/progress">View progress</a>
                            <a className="btn-secondary" href="/parent/messages">Open messages</a>
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
                                <strong>{attendance}</strong>
                            </div>
                            <div>
                                <span>Notices</span>
                                <strong>{unreadNotices}</strong>
                            </div>
                            <div>
                                <span>Meetings</span>
                                <strong>{recentMeetings.length}</strong>
                            </div>
                            <div>
                                <span>Messages</span>
                                <strong>{pendingMessages}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="dashboard-cards parent-dashboard-cards">
                    <StatCard title="Attendance" value={attendance} icon={<FaCalendarCheck />} hint="Current overall presence" />
                    <StatCard title="Linked student" value={linkedStudentCount} icon={<FaUserGraduate />} hint="Child accounts connected to you" />
                    <StatCard title="Notices" value={unreadNotices} icon={<FaBell />} hint="Recent announcements" />
                    <StatCard title="Messages" value={pendingMessages} icon={<FaComments />} hint="Open conversations" />
                </section>

                <section className="parent-dashboard-grid">
                    <article className="parent-dashboard-card parent-panel-card">
                        <div className="student-section-title">
                            <div>
                                <span><FaCalendarCheck /> Meetings</span>
                                <h2>Upcoming meetings</h2>
                            </div>
                            <a href="/parent/meeting">View all</a>
                        </div>

                        {loading ? (
                            <div className="meetings-loading">Loading meetings...</div>
                        ) : recentMeetings.length === 0 ? (
                            <div className="meetings-empty">No upcoming meetings right now.</div>
                        ) : (
                            <div className="parent-list">
                                {recentMeetings.map((meeting) => (
                                    <div key={meeting._id} className="parent-list-item meeting-item">
                                        <div>
                                            <div className="mi-title">{meeting.title || 'Meeting'}</div>
                                            <div className="mi-datetime">
                                                {meeting.datetime ? new Date(meeting.datetime).toLocaleString() : 'Schedule pending'}
                                            </div>
                                            <p className="mi-summary">{meeting.summary || 'Parent meeting details will appear here.'}</p>
                                        </div>
                                        {meeting.link ? (
                                            <a className="btn-secondary" href={meeting.link} target="_blank" rel="noreferrer">Join</a>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>

                    <article className="parent-dashboard-card parent-panel-card">
                        <div className="student-section-title">
                            <div>
                                <span><FaBell /> Notices</span>
                                <h2>Recent announcements</h2>
                            </div>
                            <a href="/parent/notices">View all</a>
                        </div>

                        {loading ? (
                            <div className="meetings-loading">Loading notices...</div>
                        ) : recentNotices.length === 0 ? (
                            <div className="meetings-empty">No notices available.</div>
                        ) : (
                            <div className="parent-list">
                                {recentNotices.map((notice) => (
                                    <div key={notice._id} className="parent-list-item notice-card">
                                        <div className="notice-title">{notice.title}</div>
                                        <div className="notice-meta">
                                            {notice.createdByName || 'School'}
                                            {notice.createdAt ? ` • ${new Date(notice.createdAt).toLocaleDateString()}` : ''}
                                        </div>
                                        <div className="notice-body">{notice.body || 'No details provided.'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>
                </section>

                <section className="parent-dashboard-actions">
                    <ActionCard
                        href="/parent/link-student"
                        title="Link student"
                        text="Connect your child account to unlock attendance, notices, and progress."
                        icon={<FaLink />}
                    />
                    <ActionCard
                        href="/parent/attendance"
                        title="Attendance"
                        text="Check presence trends and recent leave history at a glance."
                        icon={<FaCalendarCheck />}
                    />
                    <ActionCard
                        href="/parent/notices"
                        title="Notices"
                        text="Read the latest updates from the school without hunting around."
                        icon={<FaBell />}
                    />
                    <ActionCard
                        href="/parent/messages"
                        title="Messages"
                        text="Open parent-school conversations and keep replies in one place."
                        icon={<FaComments />}
                    />
                </section>
            </div>
        </ParentLayout>
    )
}
