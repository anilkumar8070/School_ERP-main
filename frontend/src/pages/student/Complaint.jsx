import React, { useState, useEffect } from 'react'
import { getAuth } from '../../utils/session'

export default function Complaint() {
    const [text, setText] = useState('')
    const [priority, setPriority] = useState('Medium')
    const [complaints, setComplaints] = useState([])

    useEffect(() => {
        try {
            const v = localStorage.getItem('student_complaints')
            if (v) setComplaints(JSON.parse(v))
        } catch (e) {
            // ignore
        }
    }, [])

    function save(list) {
        try { localStorage.setItem('student_complaints', JSON.stringify(list)) } catch (e) { }
        setComplaints(list)
    }

    function submit(e) {
        e && e.preventDefault()
        if (!text.trim()) return alert('Please enter complaint details')
        const c = { id: Date.now(), text: text.trim(), priority, created: new Date().toISOString(), status: 'Open' }
        save([c, ...complaints])
        setText('')
        setPriority('Medium')
        alert('Complaint submitted')
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Complaint Box</h3>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="card p-6 h-fit">
                    <h4 className="text-lg font-bold text-main mb-4">Raise a Complaint</h4>
                    <form onSubmit={submit}>
                        <div className="mb-4">
                            <textarea
                                className="w-full p-4 rounded-lg bg-surface border border-subtle text-main focus:ring-2 focus:ring-primary/20 outline-none resize-none h-40"
                                placeholder={text.length > 0 ? `${text.length}/500 characters` : 'Describe your complaint here...'}
                                value={text}
                                maxLength={500}
                                onChange={e => setText(e.target.value)}
                            />
                            <div className="text-right text-xs text-muted mt-1">{text.length}/500</div>
                        </div>

                        <div className="mb-6">
                            <label className="text-sm text-muted block mb-2">Priority Level</label>
                            <div className="flex gap-4">
                                {['High', 'Medium', 'Low'].map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className={`flex-1 p-3 rounded-lg border transition-all ${priority === p
                                                ? 'bg-primary text-white border-primary shadow-lg scale-105'
                                                : 'bg-surface text-muted border-subtle hover:bg-opacity-80'
                                            }`}
                                    >
                                        <div className="text-xl mb-1">{p === 'High' ? '!' : p === 'Medium' ? '⚠' : '✓'}</div>
                                        <div className="text-xs font-bold uppercase tracking-wider">{p}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button className="btn primary big w-full" type="submit">Submit Complaint</button>
                    </form>
                </section>

                <section className="card p-6">
                    <h4 className="text-lg font-bold text-main mb-4">My Complaints</h4>
                    {complaints.length === 0 && <div className="text-muted text-center py-8">No complaints submitted yet.</div>}
                    <div className="space-y-4">
                        {complaints.map(c => (
                            <div key={c.id} className="p-4 rounded-lg border border-subtle bg-surface">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`badge ${c.priority === 'High' ? 'red' : c.priority === 'Medium' ? 'orange' : 'green'
                                        }`}>
                                        {c.priority} Priority
                                    </span>
                                    <span className="text-xs text-muted">{new Date(c.created).toLocaleDateString()}</span>
                                </div>
                                <p className="text-main mb-3 whitespace-pre-wrap">{c.text}</p>
                                <div className="flex justify-between items-center text-sm border-t border-subtle pt-2 mt-2">
                                    <span className="text-muted">Status</span>
                                    <span className={`font-bold ${c.status === 'Open' ? 'text-primary' : 'text-green-500'
                                        }`}>{c.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
