import React, { useState, useMemo } from 'react'
import { getAuth } from '../../utils/session'
import { postLeave, getMyLeaves, getAttendance, exportAttendanceCsv, getMyStudent } from '../../api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function getMonthMatrix(year, month) {
    // month: 0-11
    const first = new Date(year, month, 1)
    const startDay = first.getDay() // 0 Sun - 6 Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const matrix = []
    let week = new Array(7).fill(null)
    let day = 1
    // fill first week
    for (let i = startDay; i < 7; i++) {
        week[i] = new Date(year, month, day++)
    }
    matrix.push(week)
    while (day <= daysInMonth) {
        week = new Array(7).fill(null)
        for (let i = 0; i < 7 && day <= daysInMonth; i++) {
            week[i] = new Date(year, month, day++)
        }
        matrix.push(week)
    }
    return matrix
}

// Format a Date object to local YYYY-MM-DD (avoid using toISOString which is UTC)
function formatLocalDate(d) {
    if (!d) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
}

export default function Attendance() {
    const [today] = useState(new Date())
    const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
    const [leaves, setLeaves] = useState([])
    const [form, setForm] = useState({ from: '', to: '', reason: '' })

    const { token } = getAuth()
    const qc = useQueryClient()

    const { data: leavesData = [], isLoading: leavesLoading } = useQuery({ queryKey: ['myLeaves', token], queryFn: () => getMyLeaves(token), enabled: !!token })

    // keep local copy in state for helpers that expect array variable
    React.useEffect(() => { setLeaves(Array.isArray(leavesData) ? leavesData : []) }, [leavesData])

    const leaveMutation = useMutation({
        mutationFn: ({ from, to, reason }) => postLeave(from, to, reason, token),
        onSuccess: () => qc.invalidateQueries(['myLeaves', token])
    })

    async function submitLeave(e) {
        e.preventDefault()
        if (!form.from || !form.to || !form.reason) return alert('Please fill all fields')
        try {
            await leaveMutation.mutateAsync({ from: form.from, to: form.to, reason: form.reason })
            setForm({ from: '', to: '', reason: '' })
            alert('Leave request submitted')
        } catch (err) {
            console.error(err)
            alert('Failed to submit leave')
        }
    }

    function isDateInApprovedLeave(dateObj) {
        if (!dateObj) return false
        const d = formatLocalDate(dateObj)
        return leaves.some(l => l.status === 'Approved' && (String(l.from).slice(0, 10) <= d && String(l.to).slice(0, 10) >= d))
    }

    const matrix = getMonthMatrix(view.year, view.month)
    const [todayAttendance, setTodayAttendance] = useState(null)
    const [downloading, setDownloading] = useState(false)

    // Use react-query to load current student profile and attendance for their class/section
    const { data: me } = useQuery({ queryKey: ['me', token], queryFn: () => getMyStudent(token), enabled: !!token })

    const { data: allAttendance = [] } = useQuery({ queryKey: ['attendance', me?.class, me?.section], queryFn: () => getAttendance({ class: me.class, section: me.section }, token), enabled: !!me && !!token })

    // derive today's attendance using query results
    React.useEffect(() => {
        try {
            const dateStr = formatLocalDate(new Date())
            const todayRec = (allAttendance || []).find(a => String(a.date) === dateStr)
            if (todayRec && me) {
                const myRecord = (todayRec.records || []).find(r => String(r.studentId) === String(me._id))
                setTodayAttendance(myRecord ? myRecord.status : null)
            } else {
                setTodayAttendance(null)
            }
        } catch (e) { console.warn('Failed to derive today attendance', e) }
    }, [allAttendance, me])

    async function downloadMyAttendance() {
        try {
            setDownloading(true)
            const { token } = getAuth()
            if (!token) throw new Error('Not authenticated')
            if (!me) throw new Error('Profile not loaded')
            const query = { studentId: me._id }
            // class/section optional, studentId is sufficient
            if (me.class) query.class = me.class
            if (me.section) query.section = me.section
            // get CSV from server and convert to a printable HTML, then open print dialog
            const { blob, filename } = await exportAttendanceCsv(query, token)
            const csvText = await blob.text()
            // simple CSV parser (handles quoted values)
            function parseCsv(text) {
                const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
                const rows = lines.map(line => {
                    const vals = []
                    let cur = ''
                    let inQuotes = false
                    for (let i = 0; i < line.length; i++) {
                        const ch = line[i]
                        if (ch === '"') {
                            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; continue }
                            inQuotes = !inQuotes
                            continue
                        }
                        if (ch === ',' && !inQuotes) { vals.push(cur); cur = ''; continue }
                        cur += ch
                    }
                    vals.push(cur)
                    return vals.map(v => v.replace(/^"|"$/g, '').trim())
                })
                return rows
            }

            const rows = parseCsv(csvText)
            const header = rows[0] || []
            const dataRows = (rows.slice(1) || []).map(r => (r || []).map(c => c || ''))
            const outName = (filename || `attendance_${(me.rollNo || me.name || 'student').toString().replace(/\s+/g, '_')}.pdf`).replace(/\.[^/.]+$/, '') + '.pdf'

            // Try to generate a PDF automatically using jspdf + autotable
            try {
                const { jsPDF } = await import('jspdf')
                await import('jspdf-autotable')
                const doc = new jsPDF({ unit: 'pt', format: 'a4' })
                const margin = 40
                let y = margin
                doc.setFontSize(16)
                doc.text(`Attendance — ${me.name || ''}`, margin, y)
                doc.setFontSize(11)
                y += 18
                doc.text(`Class: ${me.class || ''}    Section: ${me.section || ''}    Roll: ${me.rollNo || ''}`, margin, y)
                y += 14
                // jspdf-autotable may export a default function. Use that instead of doc.autoTable for compatibility.
                const autoTableModule = await import('jspdf-autotable')
                const autoTable = autoTableModule && (autoTableModule.default || autoTableModule)
                if (typeof autoTable === 'function') {
                    autoTable(doc, {
                        head: [header],
                        body: dataRows,
                        startY: y,
                        styles: { fontSize: 10 },
                        headStyles: { fillColor: [243, 244, 246], textColor: 20 }
                    })
                } else if (typeof doc.autoTable === 'function') {
                    doc.autoTable({ head: [header], body: dataRows, startY: y, styles: { fontSize: 10 }, headStyles: { fillColor: [243, 244, 246], textColor: 20 } })
                } else {
                    throw new Error('jsPDF autotable plugin not available')
                }
                doc.save(outName)
            } catch (libErr) {
                // If libraries are not installed, fallback to printable window and show install hint
                console.warn('PDF libs missing or failed:', libErr)
                const win = window.open('', '_blank')
                if (!win) throw new Error('Popup blocked')
                const style = `
                    <style>
                      body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #111 }
                      table { border-collapse: collapse; width: 100%; }
                      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                      th { background: #f3f4f6; }
                      h2 { margin-top: 0 }
                    </style>`
                let html = `<!doctype html><html><head><meta charset="utf-8"><title>${outName}</title>${style}</head><body>`
                html += `<h2>Attendance — ${(me.name || '').toString()}</h2>`
                html += `<div>Class: ${me.class || ''} &nbsp;&nbsp; Section: ${me.section || ''} &nbsp;&nbsp; Roll: ${me.rollNo || ''}</div>`
                html += '<table><thead><tr>'
                header.forEach(h => { html += `<th>${h}</th>` })
                html += '</tr></thead><tbody>'
                for (let i = 0; i < dataRows.length; i++) {
                    const r = dataRows[i]
                    html += '<tr>'
                    r.forEach(c => { html += `<td>${c}</td>` })
                    html += '</tr>'
                }
                html += '</tbody></table>'
                html += `<p style="margin-top:18px;color:#9ca3af;font-size:12px">To enable direct PDF download install: <code>npm install jspdf jspdf-autotable</code> and rebuild the frontend.</p>`
                html += `<script>window.onload = function(){ setTimeout(()=>{ window.print(); }, 200); };</script>`
                html += '</body></html>'
                win.document.write(html)
                win.document.close()
            }
        } catch (e) {
            alert(e.message || 'Failed to download attendance')
        } finally { setDownloading(false) }
    }

    const statusForDate = (d) => {
        if (!d || !me) return null
        const key = formatLocalDate(d)
        const rec = (allAttendance || []).find(a => String(a.date) === key)
        if (!rec) return null
        const my = (rec.records || []).find(r => String(r.studentId) === String(me._id))
        return my ? (my.status || null) : null
    }

    return (
        <div className="student-page attendance-page">
            <header className="page-header mb-8">
                <h3 className="text-3xl font-bold text-main">Attendance</h3>
            </header>

            <div className="flex flex-col gap-8">
                <section className="card p-8 flex flex-col w-full">
                    {/* Calendar Header Row */}
                    <div className="flex items-center justify-between w-full mb-8 pb-6 border-b border-subtle">
                        <button className="btn outline w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-hover shrink-0" onClick={() => setView(v => {
                            const m = v.month - 1
                            return m < 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: m }
                        })}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>

                        <div className="text-center flex-1">
                            <h4 className="text-2xl font-bold text-main m-0 leading-tight">
                                {new Date(view.year, view.month).toLocaleString(undefined, { month: 'long' })}
                            </h4>
                            <span className="text-base text-muted font-medium block mt-1">{view.year}</span>
                        </div>

                        <button className="btn outline w-12 h-12 flex items-center justify-center rounded-full hover:bg-surface-hover shrink-0" onClick={() => setView(v => {
                            const m = v.month + 1
                            return m > 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: m }
                        })}>
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    </div>

                    {/* Week Days Header */}
                    <div className="grid grid-cols-7 gap-2 text-center w-full mb-4">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="text-sm font-bold text-muted uppercase tracking-wider py-2">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-4 w-full">
                        {matrix.map((week, wIdx) =>
                            week.map((d, dIdx) => {
                                const st = d ? statusForDate(d) : null
                                const isLeave = d ? isDateInApprovedLeave(d) : false

                                let bgClass = "bg-transparent text-main hover:bg-surface"
                                let badge = null

                                if (!d) {
                                    return <div key={`${wIdx}-${dIdx}`} className="aspect-square w-full"></div>
                                }

                                if (st === 'present') {
                                    bgClass = "bg-green-500/10 text-green-600 border border-green-500/20"
                                    badge = <div className="w-2 h-2 rounded-full bg-green-500 mx-auto mt-2"></div>
                                } else if (st === 'absent') {
                                    bgClass = "bg-red-500/10 text-red-500 border border-red-500/20"
                                    badge = <div className="w-2 h-2 rounded-full bg-red-500 mx-auto mt-2"></div>
                                } else if (st === 'leave' || isLeave) {
                                    bgClass = "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                    badge = <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto mt-2"></div>
                                }

                                return (
                                    <div
                                        key={`${wIdx}-${dIdx}`}
                                        className={`aspect-square w-full flex flex-col items-center justify-center rounded-2xl transition-all font-bold text-lg cursor-default ${bgClass}`}
                                    >
                                        <span>{d.getDate()}</span>
                                        {badge}
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-8 mt-10 justify-center border-t border-subtle pt-8 w-full">
                        <div className="flex items-center gap-3 text-base text-main font-medium">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span> Present
                        </div>
                        <div className="flex items-center gap-3 text-base text-main font-medium">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span> Absent
                        </div>
                        <div className="flex items-center gap-3 text-base text-main font-medium">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span> Leave
                        </div>
                    </div>
                </section>

                <section className="card p-8 flex flex-col gap-8">
                    <div>
                        <div className="flex justify-between items-center mb-8 w-full">
                            <h4 className="text-xl font-bold text-main m-0">Apply for Leave</h4>
                            <div className="flex items-center gap-4">
                                <span className="text-base text-muted font-medium">Today:</span>
                                {todayAttendance === null ? <span className="badge gray">Not Marked</span> : (
                                    todayAttendance === 'present' ? <span className="badge green">Present</span> : <span className="badge red">Absent</span>
                                )}
                            </div>
                        </div>

                        <div className="bg-surface rounded-2xl p-6 border border-dashed border-subtle mb-8">
                            <button type="button" className="btn outline w-full flex items-center justify-center gap-3 py-4 text-base font-bold" onClick={downloadMyAttendance} disabled={downloading}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                {downloading ? 'Generating Report...' : 'Download Attendance Report'}
                            </button>
                        </div>

                        <form onSubmit={submitLeave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-sm font-bold text-muted uppercase block mb-2 ml-1">From Date</label>
                                    <input className="w-full p-4 rounded-xl bg-main border border-subtle text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-base" type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-muted uppercase block mb-2 ml-1">To Date</label>
                                    <input className="w-full p-4 rounded-xl bg-main border border-subtle text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-base" type="date" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-muted uppercase block mb-2 ml-1">Reason</label>
                                <textarea className="w-full p-4 rounded-xl bg-main border border-subtle text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all h-32 resize-none text-base" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Please describe the reason for your leave request..." />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button className="btn primary flex-1 py-3.5 text-base font-bold shadow-lg shadow-primary/20" type="submit">Submit Request</button>
                                <button type="button" className="btn outline px-8 py-3.5 text-base font-bold" onClick={() => setForm({ from: '', to: '', reason: '' })}>Reset</button>
                            </div>
                        </form>
                    </div>

                    <div className="border-t border-subtle pt-8">
                        <h4 className="text-xl font-bold text-main mb-6">My Leave History</h4>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {leaves.length === 0 && <div className="text-muted italic text-center text-base py-10 bg-surface rounded-xl border border-dashed border-subtle">No leave requests found.</div>}
                            {leaves.map(l => (
                                <div key={l._id || l.id} className={`p-5 rounded-xl border text-base transition-all hover:translate-x-1 ${l.status === 'Approved' ? 'border-green-500/30 bg-green-500/5' : 'border-subtle bg-surface hover:border-primary/30'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="font-bold text-main flex items-center gap-3">
                                            <span className="bg-main px-3 py-1 rounded text-sm border border-subtle">{String(l.from).slice(0, 10)}</span>
                                            <span className="text-muted">&rarr;</span>
                                            <span className="bg-main px-3 py-1 rounded text-sm border border-subtle">{String(l.to).slice(0, 10)}</span>
                                        </div>
                                        <span className={`text-xs font-bold px-3 py-1.5 rounded uppercase ${l.status === 'Approved' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'}`}>{l.status}</span>
                                    </div>
                                    <div className="text-muted text-base leading-relaxed">{l.reason}</div>
                                    {l.reviewNote && <div className="text-sm text-orange-500 mt-3 p-3 bg-orange-500/5 rounded border border-orange-500/10"><strong>Note:</strong> {l.reviewNote}</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
