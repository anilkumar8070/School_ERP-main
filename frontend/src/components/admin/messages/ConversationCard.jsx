import React from 'react'

export default function ConversationCard({ m, onSelect, isSelected }) {
    return (
        <div key={m._id || m.id} className={`chat-panel ${isSelected ? 'selected' : ''}`} onClick={() => onSelect && onSelect(m)} style={{ cursor: 'pointer' }}>
            <div className="chat-header">
                <div className="chat-meta">{m.studentName || (m.parentName || 'Parent')}</div>
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{new Date(m.createdAt || m.created).toLocaleString()}</div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center' }}>
                <div><strong>Class:</strong> {m.className ? m.className : <p className="empty-placeholder">-</p>}</div>
                <div><strong>Subject:</strong> {m.subject ? m.subject : <p className="empty-placeholder">-</p>}</div>
            </div>

            <div className="chat-conversation">
                <div className="chat-bubble bubble-right">
                    <div className="bubble-meta">{m.parentName || 'Parent'} · {new Date(m.createdAt || m.created).toLocaleString()}</div>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.description}</div>
                </div>

                {(m.history || []).slice().map((h, idx) => {
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
        </div>
    )
}
