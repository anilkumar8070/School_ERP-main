import React, { useState } from 'react'
import { postComplaint, getComplaints } from '../../api'
import { getAuth } from '../../utils/session'
import { toast } from 'react-toastify'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function ComplaintFixed() {
    const [text, setText] = useState('')
    const [priority, setPriority] = useState('Medium')

    const { token } = getAuth()
    const qc = useQueryClient()

    const { data: complaints = [], isLoading } = useQuery({ queryKey: ['complaints', token], queryFn: () => getComplaints(token), enabled: !!token })

    const createComplaint = useMutation({
        mutationFn: ({ text, priority }) => postComplaint(text, priority, token),
        onSuccess: (data) => {
            // prepend created complaint to cache if server returned it
            try {
                qc.setQueryData(['complaints', token], old => {
                    const arr = Array.isArray(old) ? old.slice() : []
                    return data ? [data, ...arr] : arr
                })
            } catch (e) { }
            toast.success('Complaint submitted')
            setText('')
            setPriority('Medium')
        },
        onError: () => {
            toast.error('Failed to submit complaint')
        }
    })

    async function submit(e) {
        e && e.preventDefault()
        if (!text.trim()) return alert('Please enter complaint details')
        if (!token) {
            // local fallback: show in UI by updating cache
            qc.setQueryData(['complaints', token], old => [{ id: Date.now(), text: text.trim(), priority, created: new Date().toISOString(), status: 'Open' }, ...(Array.isArray(old) ? old : [])])
            toast.success('Complaint added (local)')
            setText('')
            setPriority('Medium')
            return
        }
        await createComplaint.mutateAsync({ text: text.trim(), priority })
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
                            <label className="text-sm text-muted block mb-2">Complaint Details</label>
                            <textarea
                                className="w-full p-4 rounded-lg bg-surface border border-subtle text-main focus:ring-2 focus:ring-primary/20 outline-none resize-none h-40 transition-shadow"
                                placeholder={text.length > 0 ? `${text.length}/500 characters` : 'Describe your issue in detail...'}
                                value={text}
                                maxLength={500}
                                onChange={e => setText(e.target.value)}
                            />
                            <div className="text-right text-xs text-muted mt-1">{text.length}/500</div>
                        </div>

                        <div className="mb-6">
                            <label className="text-sm text-muted block mb-2">Priority Level</label>
                            <div className="grid grid-cols-3 gap-4">
                                {['High', 'Medium', 'Low'].map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPriority(p)}
                                        className={`p-3 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${priority === p
                                            ? 'bg-primary text-white border-primary shadow-lg scale-105'
                                            : 'bg-surface text-muted border-subtle hover:bg-surface-hover'
                                            }`}
                                    >
                                        <div className="text-xl leading-none">{p === 'High' ? '!' : p === 'Medium' ? '⚠' : '✓'}</div>
                                        <div className="text-xs font-bold uppercase tracking-wider">{p}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button className="btn primary big w-full" type="submit" disabled={createComplaint.isPending}>
                            {createComplaint.isPending ? 'Submitting...' : 'Submit Complaint'}
                        </button>
                    </form>
                </section>

                <section className="card p-6 min-h-[400px]">
                    <h4 className="text-lg font-bold text-main mb-4">My Complaints</h4>

                    {isLoading && <div className="text-muted text-center py-8">Loading complaints...</div>}
                    {!isLoading && complaints.length === 0 && <div className="text-muted text-center py-8 bg-surface rounded-lg border border-dashed border-subtle">No complaints submitted yet.</div>}

                    <div className="space-y-4 max-h-[600px] overflow-y-auto px-1 custom-scrollbar">
                        {complaints.map(c => {
                            const id = c._id || c.id
                            const created = c.createdAt || c.created
                            return (
                                <div key={id} className="p-4 rounded-lg border border-subtle bg-surface hover:border-primary/30 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`badge ${c.priority === 'High' ? 'red' : c.priority === 'Medium' ? 'orange' : 'green'}`}>
                                                {c.priority} Priority
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${(c.status || 'Open') === 'Open' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                    (c.status || 'Open') === 'Resolved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                        'bg-surface-active text-muted border-subtle'
                                                }`}>
                                                {c.status || 'Open'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted whitespace-nowrap">{new Date(created).toLocaleDateString()}</span>
                                    </div>

                                    <p className="text-main mb-3 text-sm whitespace-pre-wrap leading-relaxed">{c.text}</p>

                                    {c.history && c.history.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-subtle space-y-2">
                                            <div className="text-xs font-bold text-muted uppercase tracking-wider">Updates</div>
                                            {c.history.slice().reverse().map((h, i) => (
                                                <div key={i} className="text-xs bg-surface-active/50 p-2 rounded border border-subtle">
                                                    <div className="flex justify-between text-muted mb-1">
                                                        <span>{h.by || 'System'}</span>
                                                        <span>{new Date(h.at).toLocaleDateString()}</span>
                                                    </div>
                                                    {h.note && <div className="text-main font-medium">{h.note}</div>}
                                                    <div className="mt-1">Status: <span className="font-bold text-primary">{h.status}</span></div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </section>
            </div>
        </div>
    )
}
