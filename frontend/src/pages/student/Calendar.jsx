import React, { useState, useEffect } from 'react'
import StudentLayout from '../../components/student/StudentLayout'
import '../Events.css'
import { getEvents } from '../../api'

export default function Calendar() {
    const [current, setCurrent] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [events, setEvents] = useState({})
    const [open, setOpen] = useState(false)
    const [selectedKey, setSelectedKey] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const items = await getEvents()
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
                setEvents(map)
            } catch (e) { console.warn('Failed to load events for student calendar', e) }
        }
        load()
    }, [])

    function prevMonth() { setCurrent(c => new Date(c.getFullYear(), c.getMonth() - 1, 1)) }
    function nextMonth() { setCurrent(c => new Date(c.getFullYear(), c.getMonth() + 1, 1)) }
    function gotoToday() { const d = new Date(); setCurrent(new Date(d.getFullYear(), d.getMonth(), 1)) }

    function monthTitle(d) { return d.toLocaleString(undefined, { month: 'long', year: 'numeric' }) }

    function daysMatrix(d) {
        const year = d.getFullYear(), month = d.getMonth()
        const firstDay = new Date(year, month, 1)
        const startWeekday = firstDay.getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        const prevDays = startWeekday
        const prevMonthLast = new Date(year, month, 0).getDate()

        const cells = []
        for (let i = prevMonthLast - prevDays + 1; i <= prevMonthLast; i++) {
            const date = new Date(year, month - 1, i)
            cells.push({ date, inMonth: false })
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i)
            cells.push({ date, inMonth: true })
        }
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

    function openModalFor(key) { setSelectedKey(key); setOpen(true) }
    function closeModal() { setOpen(false); setSelectedKey('') }

    const cells = daysMatrix(current)

    return (
        <div className="events-page">
            <header className="events-header">
                <h1 className="page-title"><span className="icon">📅</span> School Calendar</h1>
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
                            const cellEvents = events[key] || []
                            const todayKey = dateKey(new Date())
                            const isToday = key === todayKey
                            const hasEvents = cellEvents.length > 0
                            const primaryColor = hasEvents ? (cellEvents[0].color || '') : ''
                            return (
                                <div key={i} className={`cal-cell ${cell.inMonth ? '' : 'muted'} ${isToday ? 'today' : ''} ${hasEvents ? `has-events ${primaryColor}` : ''}`} onClick={() => hasEvents && openModalFor(key)}>
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

            {open && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h2 className="modal-title">Events on {selectedKey}</h2>
                        <div className="modal-body">
                            {(events[selectedKey] || []).map(ev => (
                                <div key={ev.id} style={{ marginBottom: 8 }}>
                                    <div style={{ fontWeight: 700 }}>{ev.title}</div>
                                    {ev.desc && <div style={{ color: '#444', marginTop: 4 }}>{ev.desc}</div>}
                                </div>
                            ))}
                        </div>
                        <div className="modal-actions">
                            <button className="btn" onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
