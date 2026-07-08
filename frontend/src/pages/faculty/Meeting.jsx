import React, { useEffect, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getMyMeetings, getMeetings, createMeeting, getProfile, getMyFaculty } from '../../api'
import '../Student.css'

export default function Meeting() {
    return (
        <FacultyLayout title="Meetings">
            <div style={{ padding: 16 }}>
                <div className="faculty-page-banner">
                    <div className="faculty-page-banner-inner">Meetings — Create Meeting</div>
                </div>

                <div style={{ width: '100%' }}>
                    <section style={{ marginBottom: 18 }}>
                        <CreateMeetingForm />
                    </section>

                    <section style={{ marginTop: 8 }}>
                        <h3 style={{ marginBottom: 8 }}>Meetings for Faculty / Admin</h3>
                        <FacultyRelevantMeetings />
                    </section>

                    <section style={{ marginTop: 18 }}>
                        <h3 style={{ marginBottom: 8 }}>My Meetings (for Students / Parents)</h3>
                        <MyTargetedMeetings />
                    </section>
                </div>
            </div>
        </FacultyLayout>
    )
}

function FacultyRelevantMeetings() {
    const [meetings, setMeetings] = useState(null)
    const [loading, setLoading] = useState(true)
    const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')

    useEffect(() => {
        let mounted = true
        async function load() {
            setLoading(true)
            try {
                if (!token) throw new Error('No token')
                // use getMyMeetings so faculty can see meetings targeted to their role (including admin-created)
                const all = await getMyMeetings(token)
                if (!mounted) return
                const filtered = (all || []).filter(m => (m.audience || 'all') === 'faculty' || (m.audience || 'all') === 'all')
                setMeetings(filtered)
            } catch (e) {
                console.warn('Failed to load meetings', e)
                if (mounted) setMeetings([])
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        const onCreated = () => { load() }
        window.addEventListener('meeting:created', onCreated)
        return () => { mounted = false; window.removeEventListener('meeting:created', onCreated) }
    }, [token])

    if (loading) return <div className="meetings-loading">Loading meetings…</div>
    if (!meetings || meetings.length === 0) return <div className="meetings-empty">No meetings for faculty.</div>

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            {meetings.map(m => (
                <div key={m._id} className="timetable-card">
                    <div className="info-side">
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'var(--text-main)' }}>{m.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(m.datetime).toLocaleString()}</div>
                        <div style={{ fontSize: 14, marginTop: 6, color: 'var(--text-main)' }}>{m.summary}</div>
                    </div>
                    <div className="action-side">
                        {m.link ? (
                            <a className="btn-primary" href={m.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Join Meeting</a>
                        ) : (
                            <span style={{ fontSize: 13, padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 12, color: 'var(--text-muted)' }}>No Link</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

function MyTargetedMeetings() {
    const [meetings, setMeetings] = useState(null)
    const [loading, setLoading] = useState(true)
    const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')

    useEffect(() => {
        let mounted = true
        async function load() {
            setLoading(true)
            try {
                if (!token) throw new Error('No token')
                const profile = await getProfile(token).catch(() => null)
                const my = await getMyMeetings(token)
                if (!mounted) return
                // show only meetings created by this user intended for students or parents
                const filtered = (my || []).filter(m => (m.audience || '') === 'student' || (m.audience || '') === 'parent')
                // further filter to only those created by this user
                const userId = profile && profile.user && (profile.user.sub || profile.user.id || profile.user._id || profile.user._id)
                const mine = filtered.filter(m => {
                    const createdById = m && (m.createdBy && (m.createdBy._id || m.createdBy)) || m.createdBy || ''
                    return userId && String(createdById) && String(createdById) === String(userId)
                })
                setMeetings(mine)
            } catch (e) {
                console.warn('Failed to load my meetings', e)
                if (mounted) setMeetings([])
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        const onCreated = () => { load() }
        window.addEventListener('meeting:created', onCreated)
        return () => { mounted = false; window.removeEventListener('meeting:created', onCreated) }
    }, [token])

    if (loading) return <div className="meetings-loading">Loading meetings…</div>
    if (!meetings || meetings.length === 0) return <div className="meetings-empty">No meetings created for students/parents.</div>

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            {meetings.map(m => (
                <div key={m._id} className="timetable-card">
                    <div className="info-side">
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'var(--text-main)' }}>{m.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(m.datetime).toLocaleString()}</div>
                        <div style={{ fontSize: 14, marginTop: 6, color: 'var(--text-main)' }}>{m.summary}</div>
                    </div>
                    <div className="action-side">
                        {m.link ? (
                            <a className="btn-primary" href={m.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Join Meeting</a>
                        ) : (
                            <span style={{ fontSize: 13, padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 12, color: 'var(--text-muted)' }}>No Link</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

function CreateMeetingForm() {
    const [title, setTitle] = useState('')
    const [datetime, setDatetime] = useState('')
    const [summary, setSummary] = useState('')
    const [link, setLink] = useState('')
    const [klass, setKlass] = useState('1')
    const [section, setSection] = useState('A')
    const [assigned, setAssigned] = useState(null)
    const [notAssigned, setNotAssigned] = useState(false)
    useEffect(() => {
        let mounted = true
        async function resolve() {
            try {
                const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
                const f = await getMyFaculty(token).catch(() => null)
                if (!f || !Array.isArray(f.assignments) || f.assignments.length === 0) { if (mounted) { setNotAssigned(true); setAssigned([]) }; return }
                const map = {}
                for (const a of f.assignments || []) {
                    const cls = String(a.class || '')
                    if (!cls) continue
                    if (!map[cls]) map[cls] = { sections: new Set(), isClassTeacher: false }
                    if (a.section) map[cls].sections.add(String(a.section))
                    if (a.isClassTeacher) map[cls].isClassTeacher = true
                }
                const assignedList = Object.keys(map).map(k => ({ class: k, sections: Array.from(map[k].sections), isClassTeacher: !!map[k].isClassTeacher }))
                if (mounted) {
                    setAssigned(assignedList)
                    setNotAssigned(false)
                    if (assignedList.length > 0) {
                        setKlass(assignedList[0].class)
                        setSection(assignedList[0].isClassTeacher ? '' : (assignedList[0].sections[0] || ''))
                    }
                }
            } catch (e) { console.warn('resolve assignments failed', e); if (mounted) setNotAssigned(true) }
        }
        resolve()
        return () => { mounted = false }
    }, [])
    const [audience, setAudience] = useState('student')
    const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
    const [busy, setBusy] = useState(false)
    async function submit(e) {
        e && e.preventDefault()
        try {
            if (!token) throw new Error('Not authenticated')
            if (!title || !datetime) return alert('Title and datetime required')
            setBusy(true)
            const payload = { title, datetime, summary, link, audience, class: klass, section }
            await createMeeting(payload, token)
            // notify other components to reload
            try { window.dispatchEvent(new CustomEvent('meeting:created')) } catch (e) { /* ignore */ }
            alert('Meeting created')
            setTitle(''); setDatetime(''); setSummary(''); setLink('')
        } catch (e) { console.error(e); alert('Failed: ' + (e.message || e)) } finally { setBusy(false) }
    }

    return (
        <form onSubmit={submit} className="faculty-form-card">
            <label>Title
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter meeting title" />
            </label>
            <label>Date & Time
                <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} />
            </label>

            <label className="full-width">Agenda / Summary
                <textarea value={summary} onChange={e => setSummary(e.target.value)} placeholder="Describe agenda, topics or notes" />
            </label>

            <label>Audience
                <select value={audience} onChange={e => setAudience(e.target.value)}>
                    <option value="student">Students</option>
                    <option value="parent">Parents</option>
                    <option value="faculty">Faculty</option>
                    <option value="all">All</option>
                </select>
            </label>

            <label>Meeting Link (optional)
                <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://zoom.us/..." />
            </label>

            {audience === 'student' && (
                <>
                    <label>Class
                        <select value={klass} onChange={e => {
                            const v = e.target.value
                            setKlass(v)
                            const entry = (assigned || []).find(a => String(a.class) === String(v))
                            if (entry) setSection(entry.isClassTeacher ? '' : (entry.sections && entry.sections[0] ? String(entry.sections[0]) : ''))
                        }}>
                            {(assigned || []).map(a => <option key={a.class} value={String(a.class)}>Class {a.class}{a.isClassTeacher ? ' (All sections)' : ''}</option>)}
                        </select>
                    </label>

                    <label>Section
                        {assigned && assigned.length > 0 ? (
                            <select value={section} onChange={e => setSection(e.target.value)}>
                                {(() => {
                                    const entry = (assigned || []).find(a => String(a.class) === String(klass))
                                    if (!entry) return [<option key="-" value="">-</option>]
                                    if (entry.isClassTeacher) return [<option key="all" value="">All Sections</option>].concat((entry.sections || []).map(s => <option key={s} value={String(s)}>{String(s)}</option>))
                                    return (entry.sections || []).map(s => <option key={s} value={String(s)}>{String(s)}</option>)
                                })()}
                            </select>
                        ) : (
                            <input value={section} onChange={e => setSection(e.target.value)} />
                        )}
                    </label>
                </>
            )}

            <div className="form-actions">
                <button className="btn-primary" type="submit" disabled={busy}>Create Meeting</button>
            </div>
        </form>
    )
}
