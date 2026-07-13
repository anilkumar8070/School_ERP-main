import React from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getAuth } from '../../utils/session'
import { getMyReportCards } from '../../api/reportCards'
import { API_BASE } from '../../api'

export default function StudentReportCard() {
    const { token } = getAuth()
    const { data: list = [], isLoading, error } = useQuery({
        queryKey: ['myReportCards', token],
        queryFn: () => getMyReportCards(token),
        enabled: !!token,
    })

    const downloadMutation = useMutation({
        mutationFn: async ({ id }) => {
            const base = API_BASE || (window && window.location && window.location.origin) || ''
            const url = `${base}/api/reportcards/${id}/download`
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
            if (!res.ok) {
                const txt = await res.text().catch(() => 'Download failed')
                throw new Error(txt || 'Download failed')
            }
            const blob = await res.blob()
            const cd = res.headers.get('Content-Disposition') || res.headers.get('content-disposition') || ''
            let filename = ''
            try {
                const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^\";]+)"?/) || []
                filename = decodeURIComponent(m[1] || m[2] || '')
            } catch (e) { filename = '' }
            return { blob, filename }
        },
        onSuccess: ({ blob, filename }, variables) => {
            try {
                const fname = variables.filename || filename || 'report-card.pdf'
                const link = document.createElement('a')
                const url = window.URL.createObjectURL(blob)
                link.href = url
                link.download = fname
                document.body.appendChild(link)
                link.click()
                link.remove()
                window.URL.revokeObjectURL(url)
            } catch (e) { console.error(e) }
        }
    })

    function download(id, filename) {
        downloadMutation.mutate({ id, filename })
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Your Report Cards</h3>
            </header>

            <div className="card">
                {isLoading && <div className="p-6 text-muted">Loading report cards...</div>}
                {!isLoading && list.length === 0 ? <div className="p-6 text-muted">No report cards available.</div> : (
                    <div className="overflow-x-auto">
                        <table className="student-table w-full">
                            <thead>
                                <tr>
                                    <th>Exam</th>
                                    <th>Class</th>
                                    <th>Section</th>
                                    <th>Date</th>
                                    <th>File</th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map(r => (
                                    <tr key={r._id}>
                                        <td className="font-medium text-main">{r.examName}</td>
                                        <td>{r.className}</td>
                                        <td>{r.section}</td>
                                        <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            {r.filePath ? (
                                                <button
                                                    className="btn primary sm"
                                                    onClick={() => download(r._id, `${r.examName || 'report'}_${r.recipientName || r.className}.pdf`)}
                                                    disabled={downloadMutation.isLoading}
                                                >
                                                    {downloadMutation.isLoading ? 'Downloading...' : 'Download'}
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
