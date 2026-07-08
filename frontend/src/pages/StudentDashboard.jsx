import React, { useEffect, useState } from 'react'
import { getMyMeetings } from '../api'

export default function StudentDashboard() {
    const profileRaw = (() => {
        try { return localStorage.getItem('student_profile') } catch (e) { return null }
    })()
    const profile = profileRaw ? JSON.parse(profileRaw) : { name: 'Student' }

    return (
        <div className="student-dashboard">
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-main mb-2">Welcome, {profile.name || 'Student'}</h2>
                <p className="text-muted">Use the quick links below or the sidebar to navigate your student panel.</p>
            </header>

            <section className="card mb-6 p-6">
                <h3 className="text-xl font-bold text-main mb-4">Upcoming Meetings</h3>
                <MeetingList />
            </section>
            <div className="cards">
                <a className="card" href="/student/meeting">
                    <div className="card-title">Meetings</div>
                </a>
                <a className="card" href="/student/resources">
                    <div className="card-title">Student Resources</div>
                </a>
                <a className="card" href="/student/assignments">
                    <div className="card-title">Assignment Hub</div>
                </a>

                <a className="card" href="/student/notices">
                    <div className="card-title">Notices</div>
                </a>
                <a className="card" href="/student/attendance">
                    <div className="card-title">Attendance</div>
                </a>
                <a className="card" href="/student/calendar">
                    <div className="card-title">Academic Calendar</div>
                </a>
            </div>
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

    if (loading) return <div className="text-muted p-4 text-center">Loading meetings...</div>
    if (!meetings || meetings.length === 0) return <div className="text-muted p-4 text-center border border-dashed border-subtle rounded-lg">No upcoming meetings.</div>

    return (
        <div className="space-y-3">
            {meetings.map(m => (
                <div key={m._id} className="p-4 rounded-lg border border-subtle bg-surface hover:border-primary/30 transition-all">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <h4 className="font-bold text-main text-lg mb-1">{m.title}</h4>
                            <div className="text-sm text-primary font-medium mb-1">{new Date(m.datetime).toLocaleString()}</div>
                            <p className="text-sm text-muted">{m.summary}</p>
                        </div>
                        <div className="flex-shrink-0">
                            {(() => {
                                try {
                                    const dt = new Date(m.datetime)
                                    const now = new Date()
                                    if (dt.getTime() <= now.getTime()) {
                                        return <span className="badge gray">Expired</span>
                                    }
                                } catch (e) { }
                                if (m.link) return <a className="btn primary sm" href={m.link} target="_blank" rel="noreferrer">Join Meeting</a>
                                return <span className="badge gray">No link</span>
                            })()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
