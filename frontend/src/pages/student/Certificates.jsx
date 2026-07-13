import React, { useEffect, useState } from 'react'
import { getMyCertificates, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'

export default function StudentCertificates() {
    const { token } = getAuth()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [selected, setSelected] = useState(null)

    async function load() {
        setLoading(true)
        try {
            const list = await getMyCertificates(token)
            setItems(Array.isArray(list) ? list : [])
        } catch (e) { setItems([]) }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>My Certificates</h3>
            </header>

            {loading && <div className="text-muted">Loading...</div>}
            {!loading && items.length === 0 && <div className="text-muted">No certificates uploaded yet.</div>}

            <div className="flex flex-col gap-4">
                {items.map(c => (
                    <div key={c._id} className="card p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="text-lg font-bold text-main">{c.title || 'Certificate'}</div>
                            <div className="text-sm text-muted mt-1">Issued: {new Date(c.uploadedAt || c.createdAt).toLocaleDateString()}</div>
                            <div className="text-sm text-muted">For: <span className="text-main">{c.certificationFor}</span></div>
                        </div>
                        <div>
                            {c.filePath && (
                                <a
                                    className="btn outline sm"
                                    href={(API_BASE || '') + c.filePath}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Open
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-subtle flex justify-between items-center">
                            <h4 className="text-lg font-bold text-main m-0">Preview — {selected.title}</h4>
                            <button onClick={() => setSelected(null)} className="text-muted hover:text-main text-2xl">&times;</button>
                        </div>
                        <div className="flex-1 overflow-hidden bg-gray-100 p-1">
                            <iframe
                                title="certificate-preview"
                                src={(API_BASE || '') + (selected.filePath || '')}
                                className="w-full h-full border-0"
                            />
                        </div>
                        <div className="p-4 border-t border-subtle flex justify-end">
                            <button className="btn outline" onClick={() => setSelected(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
