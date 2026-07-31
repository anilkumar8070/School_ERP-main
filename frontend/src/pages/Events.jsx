import React, { useState, useEffect } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import { getAuth } from '../utils/session'
import { getEvents, postEvent } from '../api'
import '../pages/AdminPanel.css'

export default function Events() {
    const [open, setOpen] = useState(false)
    const [current, setCurrent] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [events, setEvents] = useState({})
    const [formDate, setFormDate] = useState('')
    const [title, setTitle] = useState('')
    const [desc, setDesc] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const { token } = getAuth()
                const items = await getEvents()
                // transform array of events into map keyed by yyyy-mm-dd
                const map = {}
                    ; (items || []).forEach((ev, idx) => {
                        const d = new Date(ev.date)
                        const y = d.getFullYear()
                        const m = String(d.getMonth() + 1).padStart(2, '0')
                        const day = String(d.getDate()).padStart(2, '0')
                        const key = `${y}-${m}-${day}`
                        const entry = { title: ev.title, desc: ev.description || '', color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'][idx % 4], id: ev._id }
                        map[key] = map[key] ? [...map[key], entry] : [entry]
                    })
                setEvents(map)
            } catch (e) {
                console.warn('Failed to load events from server', e)
            }
        }
        load()
    }, [])

    function openModal(dateKey) {
        setFormDate(dateKeyToDisplay(dateKey || null))
        setTitle('')
        setDesc('')
        setOpen(true)
    }

    function closeModal() { setOpen(false); setFormDate(''); setTitle(''); setDesc('') }

    function prevMonth() { setCurrent(c => new Date(c.getFullYear(), c.getMonth() - 1, 1)) }
    function nextMonth() { setCurrent(c => new Date(c.getFullYear(), c.getMonth() + 1, 1)) }
    function gotoToday() { const d = new Date(); setCurrent(new Date(d.getFullYear(), d.getMonth(), 1)) }

    function monthTitle(d) {
        return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
    }

    function daysMatrix(d) {
        const year = d.getFullYear(), month = d.getMonth()
        const firstDay = new Date(year, month, 1)
        const startWeekday = firstDay.getDay() // 0..6 (Sun..Sat)
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        const prevDays = startWeekday // number of days to take from previous month
        const prevMonthLast = new Date(year, month, 0).getDate()

        const cells = []
        // previous month tail
        for (let i = prevMonthLast - prevDays + 1; i <= prevMonthLast; i++) {
            const date = new Date(year, month - 1, i)
            cells.push({ date, inMonth: false })
        }
        // current month
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i)
            cells.push({ date, inMonth: true })
        }
        // next month fill
        let next = 1
        while (cells.length < 42) {
            const date = new Date(year, month + 1, next++)
            cells.push({ date, inMonth: false })
        }
        return cells
    }

    function dateKey(d) {
        if (!d) return ''
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }

    function dateKeyToDisplay(key) {
        if (!key) return ''
        const [y, m, d] = key.split('-')
        return `${d}/${m}/${y}`
    }

    function parseDisplayToKey(s) {
        // expect dd/mm/yyyy
        if (!s) return ''
        const parts = s.split('/')
        if (parts.length !== 3) return ''
        const [d, m, y] = parts
        if (!d || !m || !y) return ''
        return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    async function saveEvent() {
        const key = parseDisplayToKey(formDate)
        if (!key) return alert('Please provide a valid date in dd/mm/yyyy')
        const ev = { title: title || '(no title)', description: desc || '', date: new Date(`${key}T00:00:00Z`) };
        try {
            const { token } = getAuth()
            await postEvent(ev, token)
            const items = await getEvents()
            const map = {}
                ; (items || []).forEach((e, idx) => {
                    const d = new Date(e.date)
                    const y = d.getFullYear()
                    const m = String(d.getMonth() + 1).padStart(2, '0')
                    const day = String(d.getDate()).padStart(2, '0')
                    const k = `${y}-${m}-${day}`
                    const entry = { title: e.title, desc: e.description || '', color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'][idx % 4], id: e._id }
                    map[k] = map[k] ? [...map[k], entry] : [entry]
                })
            setEvents(map)
            closeModal()
        } catch (err) {
            console.error('Failed to save event', err)
            alert('Failed to save event: ' + (err.message || 'server error'))
        }
    }

    const cells = daysMatrix(current)

    return (
        <AdminLayout title="Events">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2><span style={{ marginRight: 8 }}>📅</span> Admin Event Calendar</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary small" onClick={gotoToday}>Today</button>
                        <button className="btn-secondary small" onClick={prevMonth}>&lt;</button>
                        <button className="btn-secondary small" onClick={nextMonth}>&gt;</button>
                        <button className="btn-primary" onClick={() => openModal(dateKey(new Date()))}>+ Add Event</button>
                    </div>
                </header>

                <div className="admin-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ padding: 16, borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '1.2rem', backgroundColor: 'var(--bg-card)' }}>
                        {monthTitle(current)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w =>
                            <div key={w} style={{ padding: 10, textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{w}</div>
                        )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', autoRows: 'minmax(100px, auto)', gap: '1px', backgroundColor: 'var(--border)' }}>
                        {cells.map((cell, i) => {
                            const key = dateKey(cell.date)
                            const dayNum = cell.date.getDate()
                            const cellEvents = events[key] || []
                            const todayKey = dateKey(new Date())
                            const isToday = key === todayKey

                            // Determine cell background color
                            let bg = 'var(--bg-card)'
                            if (isToday) bg = 'var(--bg-secondary)'
                            else if (!cell.inMonth) bg = 'var(--bg-main)'

                            return (
                                <div
                                    key={i}
                                    onClick={() => openModal(key)}
                                    style={{
                                        padding: 8,
                                        minHeight: 100,
                                        backgroundColor: bg,
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={e => !isToday && (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                                    onMouseLeave={e => !isToday && (e.currentTarget.style.backgroundColor = bg)}
                                >
                                    <div style={{
                                        fontWeight: isToday ? 800 : 400,
                                        color: isToday ? 'var(--primary-color)' : 'var(--text-primary)',
                                        marginBottom: 4,
                                        fontSize: '0.9rem'
                                    }}>
                                        {dayNum}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {cellEvents.slice(0, 3).map((ev, idx) => (
                                            <div key={idx} style={{
                                                fontSize: '0.75rem',
                                                padding: '2px 4px',
                                                borderRadius: 4,
                                                backgroundColor: ev.color || '#3b82f6',
                                                color: '#fff',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {ev.title}
                                            </div>
                                        ))}
                                        {cellEvents.length > 3 && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>+{cellEvents.length - 3} more</div>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {open && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div className="admin-card" style={{ width: '400px', padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                            <h3 style={{ marginTop: 0 }}>Add New Event</h3>
                            <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
                                <input className="admin-input" value={formDate} onChange={e => setFormDate(e.target.value)} placeholder="dd/mm/yyyy" />
                                <input className="admin-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Event Title" />
                                <textarea className="admin-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Event Description" style={{ minHeight: 80 }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                                <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button className="btn-primary" onClick={saveEvent}>Save Event</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
