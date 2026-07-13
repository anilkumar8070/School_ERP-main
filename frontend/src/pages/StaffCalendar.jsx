import React, { useEffect, useMemo, useState } from 'react'
import StaffLayout from '../components/staff/StaffLayout'
import { getEvents } from '../api'
import './Events.css'

export default function StaffCalendar() {
    const [current, setCurrent] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [eventsMap, setEventsMap] = useState({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let mounted = true
        async function load() {
            setLoading(true); setError('')
            try {
                const items = await getEvents()
                if (mounted) {
                    const map = {}
                        ; (items || []).forEach((ev, idx) => {
                            const d = new Date(ev.date)
                            const y = d.getFullYear()
                            const m = String(d.getMonth() + 1).padStart(2, '0')
                            const day = String(d.getDate()).padStart(2, '0')
                            const key = `${y}-${m}-${day}`
                            const entry = { title: ev.title, desc: ev.description || '', color: ['blue', 'purple', 'green', 'orange'][idx % 4], id: ev._id }
                            map[key] = map[key] ? [...map[key], entry] : [entry]
                        })
                    setEventsMap(map)
                }
            } catch (e) { if (mounted) setError(e.message || 'Failed to load events') }
            setLoading(false)
        }
        load()
        const id = setInterval(load, 60 * 1000) // refresh every minute
        return () => { mounted = false; clearInterval(id) }
    }, [])

    function monthTitle(d) {
        return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
    }
    function daysMatrix(d) {
        const year = d.getFullYear(), month = d.getMonth()
        const firstDay = new Date(year, month, 1)
        const startWeekday = firstDay.getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const prevDays = startWeekday
        const prevMonthLast = new Date(year, month, 0).getDate()
        const cells = []
        for (let i = prevMonthLast - prevDays + 1; i <= prevMonthLast; i++) cells.push({ date: new Date(year, month - 1, i), inMonth: false })
        for (let i = 1; i <= daysInMonth; i++) cells.push({ date: new Date(year, month, i), inMonth: true })
        let next = 1
        while (cells.length < 42) cells.push({ date: new Date(year, month + 1, next++), inMonth: false })
        return cells
    }
    function dateKey(d) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }
    function prevMonth() { setCurrent(c => new Date(c.getFullYear(), c.getMonth() - 1, 1)) }
    function nextMonth() { setCurrent(c => new Date(c.getFullYear(), c.getMonth() + 1, 1)) }
    function gotoToday() { const d = new Date(); setCurrent(new Date(d.getFullYear(), d.getMonth(), 1)) }
    const cells = useMemo(() => daysMatrix(current), [current])

    return (
        <StaffLayout title="Academic Calendar">
            <div className="admin-page">
                <h2>Academic Calendar</h2>
                <header className="events-header">
                    <h1 className="page-title"><span className="icon">📅</span> Academic Calendar</h1>
                    <div className="controls">
                        <button className="ctrl today" onClick={gotoToday}>today</button>
                        <button className="ctrl nav" onClick={prevMonth}>&lt;</button>
                        <button className="ctrl nav" onClick={nextMonth}>&gt;</button>
                    </div>
                </header>
                <section className="calendar-panel">
                    <div className="calendar-header">
                        <div className="month-title">{monthTitle(current)}</div>
                    </div>
                    <div className="calendar">
                        <div className="cal-weeknames">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => <div key={w} className="cal-weekname">{w}</div>)}
                        </div>
                        <div className="cal-grid">
                            {cells.map((cell, i) => {
                                const key = dateKey(cell.date)
                                const dayNum = cell.date.getDate()
                                const cellEvents = eventsMap[key] || []
                                const todayKey = dateKey(new Date())
                                const isToday = key === todayKey
                                const hasEvents = cellEvents.length > 0
                                const primaryColor = hasEvents ? (cellEvents[0].color || '') : ''
                                return (
                                    <div key={i} className={`cal-cell ${cell.inMonth ? '' : 'muted'} ${isToday ? 'today' : ''} ${hasEvents ? `has-events ${primaryColor}` : ''}`}>
                                        <div className="day-num">{dayNum}</div>
                                        <div className="events-list">
                                            {cellEvents.slice(0, 2).map((ev, idx) => (
                                                <div key={idx} className={`event-pill ${ev.color || 'blue'}`}>{ev.title}</div>
                                            ))}
                                            {cellEvents.length > 2 && <div className="more">+{cellEvents.length - 2}</div>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>
                <p style={{ marginTop: 12, color: '#64748b' }}>Calendar auto-refreshes every minute. Updates made in Admin Events appear here.</p>
            </div>
        </StaffLayout>
    )
}
