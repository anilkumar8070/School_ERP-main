import React from 'react'

export default function HistoryPanel({ closed }) {
    if (!closed || closed.length === 0) return null
    return (
        <div style={{ marginTop: 18 }}>
            <h4 style={{ marginBottom: 8 }}>Closed — History</h4>
            {closed.map(m => (
                <div key={m._id || m.id} className="chat-panel" style={{ opacity: 0.95, background: '#fafafa', marginBottom: 10 }}>
                    <div className="chat-header">
                        <div className="chat-meta">{m.studentName || (m.parentName || 'Parent')}</div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{new Date(m.createdAt || m.created).toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '8px 12px' }}>
                        <div style={{ marginBottom: 6 }}><strong>Subject:</strong> {m.subject || '-'}</div>
                        <div style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>{m.description}</div>
                        {(m.history || []).map((h, idx) => (
                            <div key={idx} style={{ fontSize: 13, marginBottom: 6 }}>
                                <div style={{ color: 'rgba(0,0,0,0.6)' }}>{(h.by || h.role || 'Admin')} · {new Date(h.at).toLocaleString()}</div>
                                {h.note && <div style={{ whiteSpace: 'pre-wrap' }}>{h.note}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
