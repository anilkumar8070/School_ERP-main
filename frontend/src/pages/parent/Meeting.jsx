import React, { useEffect, useState } from 'react'
import ParentLayout from '../../components/parent/ParentLayout'
import { getMyMeetings } from '../../api'
import '../Student.css'

export default function ParentMeeting() {
    return (
        <ParentLayout title="Meetings">
            <div style={{ padding: 16 }}>
                <h2>Upcoming Meetings</h2>
                <UserMeetings />
            </div>
        </ParentLayout>
    )
}

function UserMeetings() {
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

    if (loading) return <div className="meetings-loading">Loading meetings…</div>
    if (!meetings || meetings.length === 0) return <div className="meetings-empty">No upcoming meetings.</div>

    return (
        <div className="meetings-list">
            {meetings.map(m => (
                <div key={m._id} className="meeting-item">
                    <div className="mi-left">
                        <div className="mi-title">{m.title}</div>
                        <div className="mi-datetime">{new Date(m.datetime).toLocaleString()}</div>
                        <div className="mi-summary">{m.summary}</div>
                    </div>
                    <div className="mi-actions">
                        {m.link ? <a className="mi-join" href={m.link} target="_blank" rel="noreferrer">Join</a> : <span className="mi-no-link">No link</span>}
                    </div>
                </div>
            ))}
        </div>
    )
}
