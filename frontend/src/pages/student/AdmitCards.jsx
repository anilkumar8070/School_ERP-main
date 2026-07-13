import React, { useState, useEffect } from 'react'
import { getAuth } from '../../utils/session'
import { API_BASE } from '../../api'
import { useMutation } from '@tanstack/react-query'

export default function StudentAdmitCards() {
    const { token } = getAuth()
    const [list, setList] = useState([])

    useEffect(() => {
        let mounted = true
        async function load() {
            try {
                if (!token) return setList([])
                const base = API_BASE || (window && window.location && window.location.origin) || ''
                const res = await fetch(`${base}/api/admitcards/my`, { headers: { Authorization: `Bearer ${token}` } })
                if (!res.ok) return setList([])
                const json = await res.json().catch(() => [])
                if (mounted) setList(Array.isArray(json) ? json : [])
            } catch (e) { if (mounted) setList([]) }
        }
        load()
        return () => { mounted = false }
    }, [token])

    const [downloadingId, setDownloadingId] = useState(null)
    const downloadMutation = useMutation({
        mutationFn: async ({ urlOrId }) => {
            if (!urlOrId) throw new Error('Invalid file')
            const base = API_BASE || (window && window.location && window.location.origin) || ''
            let fetchUrl = urlOrId && String(urlOrId).startsWith('http') ? urlOrId : `${base}${String(urlOrId).startsWith('/') ? '' : '/'}${String(urlOrId)}`
            if (!String(urlOrId).startsWith('http') && !String(urlOrId).startsWith('/uploads') && !String(urlOrId).startsWith('/api/')) {
                fetchUrl = `${base}/api/admitcards/${urlOrId}/download`
            }
            const headers = {}
            if (token) headers['Authorization'] = `Bearer ${token}`
            const res = await fetch(fetchUrl, { credentials: 'include', headers })
            if (!res.ok) {
                const txt = await res.text().catch(() => '')
                throw new Error(txt || 'Failed to download file')
            }
            const blob = await res.blob()
            return { blob }
        },
        onMutate: (vars) => setDownloadingId(vars.urlOrId),
        onSettled: () => setDownloadingId(null),
        onSuccess: ({ blob }, vars) => {
            try {
                const filename = vars.filename || 'admit-card.pdf'
                const link = document.createElement('a')
                link.href = window.URL.createObjectURL(blob)
                link.download = filename
                document.body.appendChild(link)
                link.click()
                link.remove()
                window.URL.revokeObjectURL(link.href)
            } catch (e) { alert('Download failed') }
        },
        onError: (err) => alert(err?.message || 'Download failed')
    })

    function downloadFile(urlOrId, filename) {
        downloadMutation.mutate({ urlOrId, filename })
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Your Admit Cards</h3>
            </header>

            <div className="card">
                {(list || []).length === 0 ? <div className="p-6 text-muted">No admit cards yet.</div> : (
                    <div className="overflow-x-auto">
                        <table className="student-table w-full">
                            <thead>
                                <tr>
                                    <th>Exam</th>
                                    <th>Class</th>
                                    <th>Section</th>
                                    <th>Date</th>
                                    <th>Exam Roll</th>
                                    <th>File</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map(l => (
                                    <tr key={l._id}>
                                        <td className="font-medium text-main">{l.examName}</td>
                                        <td>{l.className}</td>
                                        <td>{l.section}</td>
                                        <td>{l.dateOfExam ? new Date(l.dateOfExam).toLocaleDateString() : '—'}</td>
                                        <td className="font-mono bg-surface rounded px-2">{l.examRollNumber || '—'}</td>
                                        <td>
                                            {l.filePath ? (
                                                <button
                                                    className="btn primary sm"
                                                    type="button"
                                                    onClick={() => downloadFile(l.filePath, `${l.examName || 'admit'}_${l.recipientName || l.className}.pdf`)}
                                                    disabled={downloadMutation.isLoading}
                                                >
                                                    {downloadingId === l.filePath ? '...' : 'Download'}
                                                </button>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
