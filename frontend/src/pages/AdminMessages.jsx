import React, { useState } from 'react'
import AdminLayout from '../components/admin/AdminLayout'
import { getAuth } from '../utils/session'
import { getMessages, updateMessageStatus } from '../api'
import { toast } from 'react-toastify'
import useAsyncAction from '../hooks/useAsyncAction'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function AdminMessages() {
    const [replyDrafts, setReplyDrafts] = useState({})
    const [searchTerm, setSearchTerm] = useState('')

    const { token } = getAuth()
    const qc = useQueryClient()

    const { data: messages = [], isLoading: loadingMessages } = useQuery({ queryKey: ['messages', token], queryFn: () => getMessages(token), enabled: !!token })

    function colorFromId(id) {
        if (!id) return 'var(--text-muted)'
        let h = 0
        for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
        const hue = Math.abs(h) % 360
        return `hsl(${hue}deg 70% 60%)`
    }

    const [replyBusy, runReply] = useAsyncAction()

    const replyMutation = useMutation({
        mutationFn: ({ msgId, note }) => updateMessageStatus(msgId, 'Replied', note, token),
        onSuccess: (updated) => {
            qc.setQueryData(['messages', token], old => {
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

    const activeMessages = messages.filter(m => { const s = (m.status || '').toLowerCase(); return s !== 'resolved' && s !== 'closed' })
        .filter(m => {
            if (!searchTerm || !searchTerm.trim()) return true
            const s = searchTerm.toLowerCase()
            const hay = `${m.parentName || ''} ${m.studentName || ''} ${m.className || ''} ${m.subject || ''} ${m.description || ''} ${m.parentEmail || m.by || ''}`.toLowerCase()
            return hay.indexOf(s) !== -1
        })

    const historyMessages = messages.filter(m => { const s = (m.status || '').toLowerCase(); return s === 'resolved' || s === 'closed' })

    return (
        <AdminLayout title="Parent Messages">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Parent Messages</h2>
                </header>

                <div className="admin-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                        <h3 className="section-title">Conversations</h3>
                        <input
                            className="admin-input"
                            style={{ width: 300 }}
                            placeholder="Search by name, class or email"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {loadingMessages && <div className="text-muted">Loading messages...</div>}
                    {!loadingMessages && messages.length === 0 && <div className="text-muted">No messages found.</div>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {activeMessages.map(m => (
                            <div key={m._id || m.id} style={{
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: 16,
                                borderLeft: `4px solid ${colorFromId(m._id || m.id)}`,
                                background: 'var(--bg-main)' /* Use bg-main for inner panels to contrast with card or vice versa? Actually card is bg-card. Inner panel usually simpler. Let's use transparent but border. */
                                , backgroundColor: 'var(--bg-card)' /* Ensure it blends or stands out. Wait, inner items inside a card usually shouldn't have background unless needed. Let's keep it clean */
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%',
                                            background: colorFromId(m._id || m.id),
                                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                                        }}>
                                            {(m.parentName || 'P')[0]}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{m.studentName || (m.parentName || 'Unknown')}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {(m.parentName || 'Parent')} • {m.className || 'No Class'} • {new Date(m.createdAt || m.created).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="badge badge-blue">{m.subject || 'No Subject'}</div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                    {/* Original Query */}
                                    <div style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: '12px 12px 12px 0', background: 'var(--bg-main)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
                                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.description}</div>
                                    </div>

                                    {/* History/Replies */}
                                    {(m.history || []).map((h, idx) => {
                                        const isAdmin = (h.role || '').toLowerCase() === 'admin'
                                        const rawBy = (h.by || h.role || 'Admin')
                                        let displayBy = isAdmin ? 'Admin' : rawBy

                                        return (
                                            <div key={idx} style={{
                                                alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                                                maxWidth: '85%',
                                                padding: '10px 14px',
                                                borderRadius: isAdmin ? '12px 12px 0 12px' : '12px 12px 12px 0',
                                                background: isAdmin ? 'var(--primary-color)' : 'var(--bg-main)',
                                                color: isAdmin ? '#fff' : 'var(--text-main)',
                                                border: isAdmin ? 'none' : '1px solid var(--border)'
                                            }}>
                                                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>{displayBy} • {new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                <div style={{ whiteSpace: 'pre-wrap' }}>{h.note}</div>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <textarea
                                        className="admin-input"
                                        style={{ flex: 1, minHeight: 42, height: 42, paddingTop: 10, resize: 'none' }}
                                        placeholder="Type a reply..."
                                        value={replyDrafts[m._id || m.id] || ''}
                                        onChange={e => setReplyDrafts(prev => ({ ...prev, [m._id || m.id]: e.target.value }))}
                                    />
                                    <button className="btn primary" style={{ height: 42 }} onClick={() => sendReply(m._id || m.id)}>Reply</button>
                                </div>

                                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                                    {m.status !== 'In Progress' && <button className="btn secondary small" onClick={async () => {
                                        try { await updateMessageStatus(m._id || m.id, 'In Progress', '', token); qc.invalidateQueries(['messages', token]); toast.success('Marked In Progress') } catch (e) { toast.error('Error') }
                                    }}>Mark Progress</button>}
                                    {m.status !== 'Resolved' && <button className="btn primary small" onClick={async () => {
                                        try { await updateMessageStatus(m._id || m.id, 'Resolved', '', token); qc.invalidateQueries(['messages', token]); toast.success('Resolved') } catch (e) { toast.error('Error') }
                                    }}>Resolve</button>}
                                    {m.status !== 'Closed' && <button className="btn danger small" onClick={async () => {
                                        try { await updateMessageStatus(m._id || m.id, 'Closed', '', token); qc.invalidateQueries(['messages', token]); toast.success('Closed') } catch (e) { toast.error('Error') }
                                    }}>Close</button>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {historyMessages.length > 0 && (
                        <div style={{ marginTop: 40 }}>
                            <h3 className="section-title">Resolved History</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {historyMessages.map(m => (
                                    <div key={m._id || m.id} style={{
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        padding: 12,
                                        opacity: 0.8,
                                        background: 'var(--bg-main)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <strong>{m.studentName || 'Parent'}</strong>
                                            <span className="badge badge-green">Resolved</span>
                                        </div>
                                        <div className="small text-muted" style={{ marginTop: 4 }}>{m.description.substring(0, 100)}...</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    )
}
