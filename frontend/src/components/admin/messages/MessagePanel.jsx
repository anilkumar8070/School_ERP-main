import React, { useRef, useEffect } from 'react'

export default function MessagePanel({ message, replyDraft, onChangeDraft, onSendReply, onChangeStatus }) {
    const convoRef = useRef(null)
    useEffect(() => { setTimeout(() => { try { if (convoRef.current) convoRef.current.scrollTop = convoRef.current.scrollHeight } catch (e) { } }, 60) }, [message])

    if (!message) return <div style={{ padding: 12 }}>Select a conversation to view details</div>

    return (
        <div className="chat-panel chat-selected">
            <div className="chat-header">
                <div className="chat-meta">{message.studentName || (message.parentName || 'Parent')}</div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{new Date(message.createdAt || message.created).toLocaleString()}</div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center' }}>
                <div><strong>Class:</strong> {message.className ? message.className : <p className="empty-placeholder">-</p>}</div>
                <div><strong>Subject:</strong> {message.subject ? message.subject : <p className="empty-placeholder">-</p>}</div>
            </div>

            <div className="chat-conversation" ref={convoRef} style={{ maxHeight: 360, overflow: 'auto' }}>
                <div className="chat-bubble bubble-right">
                    <div className="bubble-meta">{message.parentName || 'Parent'} · {new Date(message.createdAt || message.created).toLocaleString()}</div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.description}</div>
                </div>

                {(message.history || []).slice().map((h, idx) => {
                    const isAdmin = (h.role || '').toLowerCase() === 'admin'
                    const rawBy = (h.by || h.role || 'Admin')
                    let displayBy = rawBy
                    try {
                        const s = String(rawBy || '')
                        if (s.includes('@') || /\d/.test(s)) {
                            displayBy = isAdmin ? 'Admin' : (s.split('@')[0] || 'User')
                        }
                    } catch (e) { }

                    return (
                        <div key={idx} className={`chat-bubble ${isAdmin ? 'bubble-left' : 'bubble-right'}`}>
                            <div className="bubble-meta">{displayBy} · {new Date(h.at).toLocaleString()}</div>
                            {h.note && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{h.note}</div>}
                        </div>
                    )
                })}
            </div>

            <div className="chat-reply">
                <textarea placeholder="Write a reply to this parent..." value={replyDraft || ''} onChange={e => onChangeDraft && onChangeDraft(e.target.value)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button className="btn btn-primary" onClick={() => onSendReply && onSendReply(message._id || message.id)}>Reply</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {message.status !== 'In Progress' && <button className="btn btn-outline" onClick={() => onChangeStatus && onChangeStatus(message, 'In Progress')}>Mark In Progress</button>}
                        {message.status !== 'Resolved' && <button className="btn btn-primary" onClick={() => onChangeStatus && onChangeStatus(message, 'Resolved')}>Resolve</button>}
                        {message.status !== 'Closed' && <button className="btn btn-outline" onClick={() => onChangeStatus && onChangeStatus(message, 'Closed')}>Close</button>}
                    </div>
                </div>
            </div>
        </div>
    )
}
