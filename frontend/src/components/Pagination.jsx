import React from 'react'

export default function Pagination({ page, setPage, total, limit = 50 }) {
    const totalPages = Math.ceil(total / limit)
    if (totalPages <= 1) return null

    return (
        <div style={{ padding: 15, display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
            <button className="btn outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button className="btn outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
    )
}
