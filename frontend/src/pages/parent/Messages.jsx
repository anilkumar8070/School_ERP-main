import React, { useState } from 'react'
import ParentLayout from '../../components/parent/ParentLayout'
import { getAuth } from '../../utils/session'
import { postMessage, getMyMessages } from '../../api'
import { toast } from 'react-toastify'
import { updateMessageStatus } from '../../api'
import useAsyncAction from '../../hooks/useAsyncAction'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function ParentMessages() {
    const [parentName, setParentName] = useState('')
    const [studentName, setStudentName] = useState('')
    const [className, setClassName] = useState('')
    const [subject, setSubject] = useState('')
    const [description, setDescription] = useState('')
    const [priority, setPriority] = useState('Medium')

    const [replyDrafts, setReplyDrafts] = useState({})

    const { token } = getAuth()
    const qc = useQueryClient()

    const { data: messages = [], isLoading: loadingMessages } = useQuery({ queryKey: ['myMessages', token], queryFn: () => getMyMessages(token), enabled: !!token })
    const [loading, setLoading] = useState(false)

    const sendMessageMutation = useMutation({
        mutationFn: (payload) => postMessage(payload, token),
        onSuccess: () => qc.invalidateQueries(['myMessages', token])
    })

    async function handleSubmit(e) {
        e && e.preventDefault()
        if (!description.trim()) return toast.error('Enter message description')
        setLoading(true)
        try {
            const payload = { parentName, studentName, className, subject, description, priority }
            await sendMessageMutation.mutateAsync(payload)
            toast.success('Message sent to admin')
            setParentName('')
            setStudentName('')
            setClassName('')
            setSubject('')
            setDescription('')
            setPriority('Medium')
        } catch (err) {
            console.error(err)
            toast.error('Failed to send message')
        } finally {
            setLoading(false)
        }
    }

    const [replyBusy, runReply] = useAsyncAction()

    const replyMutation = useMutation({
        mutationFn: ({ msgId, note }) => updateMessageStatus(msgId, 'Replied', note, token),
        onSuccess: (updated) => {
            // Update cache with updated message
            qc.setQueryData(['myMessages', token], old => {
                if (!Array.isArray(old)) return old
                return old.map(m => ((m._id || m.id) === (updated._id || updated.id) ? updated : m))
            })
            const updatedId = (updated && (updated._id || updated.id))
            setReplyDrafts(prev => { const n = { ...prev }; if (updatedId) delete n[updatedId]; return n })
            toast.success('Reply sent')
        },
        onError: () => {
            toast.error('Failed to send reply')
        }
    })

    async function sendReply(msgId) {
        await runReply(async () => {
            const note = (replyDrafts[msgId] || '').trim()
            if (!note) return toast.error('Enter reply')
            if (!token) return toast.error('Not authenticated')
            await replyMutation.mutateAsync({ msgId, note })
        })
    }

    const inputClass = "w-full p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors"

    return (
        <ParentLayout>
            <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
                <div className="flex flex-col gap-6">
                    {/* Send Message Card */}
                    <div className="bg-[var(--bg-card)] p-6 rounded-xl border border-[var(--border)] shadow-sm">
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-6">Send Message to Admin</h2>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-main)]">Parent Name
                                    <input className={inputClass} value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Parent name" />
                                </label>
                                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-main)]">Student Name
                                    <input className={inputClass} value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Student name" />
                                </label>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-main)]">Class
                                    <input className={inputClass} value={className} onChange={e => setClassName(e.target.value)} placeholder="Class" />
                                </label>
                                <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-main)]">Subject
                                    <input className={inputClass} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
                                </label>
                            </div>
                            <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-main)]">Description
                                <textarea className={inputClass} value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Type your message here..." />
                            </label>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-[var(--text-main)]">Priority</label>
                                <div className="flex gap-2">
                                    {['High', 'Medium', 'Low'].map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setPriority(p)}
                                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${priority === p
                                                    ? (p === 'High' ? 'bg-red-100 text-red-700 border border-red-200' : p === 'Medium' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-green-100 text-green-700 border border-green-200')
                                                    : 'bg-[var(--bg-main)] text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--bg-hover)]'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-2">
                                <button type="submit" className="btn primary w-full md:w-auto" disabled={loading}>{loading ? 'Sending...' : 'Send Message'}</button>
                            </div>
                        </form>
                    </div>

                    {/* Messages List */}
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-main)] mb-4">Your Messages</h3>
                        {loadingMessages && <div className="text-[var(--text-muted)]">Loading...</div>}
                        {!loadingMessages && messages.length === 0 && <div className="text-[var(--text-muted)] italic">No messages yet.</div>}

                        <div className="flex flex-col gap-4">
                            {messages.map(m => (
                                <div key={m._id || m.id} className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)] shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="font-semibold text-[var(--text-main)]">{m.studentName || 'Student'}</div>
                                            <div className="text-xs text-[var(--text-muted)] mt-0.5">{new Date(m.createdAt || m.created).toLocaleString()}</div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${(m.status === 'Resolved' || m.status === 'Closed') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                                            }`}>
                                            {m.status || 'Sent'}
                                        </span>
                                    </div>

                                    <div className="flex gap-4 mb-4 text-sm text-[var(--text-main)]">
                                        <div><span className="text-[var(--text-muted)]">Class:</span> {m.className || '-'}</div>
                                        <div><span className="text-[var(--text-muted)]">Subject:</span> {m.subject || '-'}</div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <div className="self-end max-w-[85%] p-3 rounded-lg rounded-tr-none bg-[var(--primary)] text-white shadow-sm">
                                            <div className="text-xs opacity-90 mb-1">You</div>
                                            <div className="whitespace-pre-wrap text-sm">{m.description}</div>
                                        </div>

                                        {(m.history || []).map((h, idx) => {
                                            const isAdmin = (h.role || '').toLowerCase() === 'admin'
                                            return (
                                                <div key={idx} className={`max-w-[85%] p-3 rounded-lg shadow-sm text-sm ${isAdmin
                                                        ? 'self-start rounded-tl-none bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)]'
                                                        : 'self-end rounded-tr-none bg-[var(--primary)] text-white'
                                                    }`}>
                                                    <div className="text-xs opacity-75 mb-1">{isAdmin ? 'Admin' : 'You'} • {new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    <div className="whitespace-pre-wrap">{h.note}</div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-[var(--border)] flex gap-2">
                                        <textarea
                                            className="flex-1 p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] text-sm resize-none"
                                            placeholder="Write a reply..."
                                            value={replyDrafts[m._id || m.id] || ''}
                                            onChange={e => setReplyDrafts(prev => ({ ...prev, [m._id || m.id]: e.target.value }))}
                                            rows={1}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendReply(m._id || m.id);
                                                }
                                            }}
                                        />
                                        <button className="btn primary small h-auto" onClick={() => sendReply(m._id || m.id)}>Reply</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </ParentLayout>
    )
}

