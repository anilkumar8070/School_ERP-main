import React, { useEffect, useState } from 'react'
import StaffLayout from '../../components/staff/StaffLayout'
import { getMyMeetings } from '../../api'
import { getAuth } from '../../utils/session'

export default function StaffMeeting() {
    const [meetings, setMeetings] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    async function load() {
        setError('')
        setLoading(true)
        try {
            const { token } = getAuth()
            if (!token) throw new Error('Not authenticated')
            const items = await getMyMeetings(token)
            setMeetings(items || [])
        } catch (e) {
            console.error('Failed to load meetings', e)
            setError(e?.message || 'Failed to load meetings')
            setMeetings([])
        } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    return (
        <StaffLayout title="Meetings">
            <div className="parent-page">
                <h2>Meetings</h2>
                {error && <div className="error">{error}</div>}
                {loading && <div>Loading meetings…</div>}
                {!loading && (!meetings || meetings.length === 0) && <div>No upcoming meetings.</div>}
                {!loading && meetings && meetings.length > 0 && (
                    <div className="meetings-list">
                        {meetings.map(m => (
                            <div key={m._id} className="meeting-item" style={{ border: '1px solid #eee', padding: 12, marginBottom: 8, borderRadius: 8 }}>
                                <div style={{ fontWeight: 800 }}>{m.title}</div>
                                <div style={{ color: '#6b7280', fontSize: 13 }}>{new Date(m.datetime).toLocaleString()}</div>
                                <div style={{ marginTop: 8 }}>{m.summary || '-'}</div>
                                <div style={{ marginTop: 8 }}>
                                    Audience: <strong>{m.audience || 'all'}</strong>
                                    {m.link ? <a style={{ marginLeft: 12 }} href={m.link} target="_blank" rel="noreferrer">Join</a> : null}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </StaffLayout>
    )
}
