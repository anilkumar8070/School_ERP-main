import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getResources, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'

export default function Resources() {
    const [classFilter, setClassFilter] = useState('')
    const [subjectFilter, setSubjectFilter] = useState('')
    const [viewerUrl, setViewerUrl] = useState('')
    const [viewerType, setViewerType] = useState('pdf')

    // appliedFilters are the filters actually used for the query (updated when user clicks Search)
    const [appliedFilters, setAppliedFilters] = useState({})

    const { token } = getAuth()

    const { data: items = [], isLoading, isError, error, refetch } = useQuery({
        queryKey: ['resources', appliedFilters, token],
        queryFn: () => getResources(appliedFilters, token),
        keepPreviousData: true,
        staleTime: 1000 * 60 * 2,
    })

    function applyFilters() {
        const q = {}
        if (classFilter) q.class = classFilter
        if (subjectFilter) q.subject = subjectFilter
        setAppliedFilters(q)
    }

    function clearFilters() {
        setClassFilter('')
        setSubjectFilter('')
        setAppliedFilters({})
    }

    return (
        <div className="student-page">
            <div className="resources-header">
                <h3>Library — Student Resources</h3>
                <div className="filters flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="filter-item">Class
                        <select value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                            <option value="">All</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>Class {n}</option>)}
                        </select>
                    </label>
                    <label className="filter-item">Subject
                        <input placeholder="Subject (e.g. Mathematics)" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} />
                    </label>
                    <div className="filter-actions flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <button className="btn py-2 px-3 sm:py-1 sm:px-2 rounded-md text-sm sm:text-base" onClick={applyFilters} disabled={isLoading}>Search</button>
                        <button className="btn outline py-2 px-3 sm:py-1 sm:px-2 rounded-md text-sm sm:text-base" onClick={clearFilters} disabled={isLoading}>Clear</button>
                        <button className="btn tertiary py-2 px-3 sm:py-1 sm:px-2 rounded-md text-sm sm:text-base" onClick={() => refetch()} disabled={isLoading}>Refresh</button>
                    </div>
                </div>
            </div>

            {isLoading ? <p>Loading resources...</p> : null}
            {isError ? <p style={{ color: '#b91c1c' }}>{error && error.message ? error.message : 'Failed to load resources'}</p> : null}

            {!isLoading && !isError && items.length === 0 ? <p>No resources available yet.</p> : null}

            <div className="resources-grid">
                {items.map(it => (
                    <div key={it._id} className="resource-card">
                        <div className="rc-top">
                            <div className="title">{it.title || it.originalname}</div>
                            <div className="meta">{it.subject ? it.subject + ' • ' : ''}{it.class ? `Class ${it.class}` : ''}</div>
                        </div>
                        <div className="rc-bottom">
                            <div className="uploaded">{it.createdAt ? new Date(it.createdAt).toLocaleString() : ''}</div>
                            <div className="actions">
                                <button className="btn py-2 px-3 sm:py-1 sm:px-2 rounded-md text-sm sm:text-base" onClick={() => {
                                    const url = `${API_BASE}${it.url}`
                                    // determine type from filename/URL
                                    const ext = (it.filename || it.originalname || url).split('.').pop().toLowerCase()
                                    const videoExts = ['mp4', 'webm', 'mov', 'ogg', 'mkv']
                                    if (videoExts.indexOf(ext) !== -1) {
                                        setViewerType('video')
                                    } else {
                                        setViewerType('pdf')
                                    }
                                    setViewerUrl(url)
                                }}>Open</button>
                                <a className="btn outline py-2 px-3 sm:py-1 sm:px-2 rounded-md text-sm sm:text-base" href={`${API_BASE}${it.url}`} target="_blank" rel="noopener noreferrer" download>Download</a>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {viewerUrl ? (
                <div className="pdf-viewer-overlay" onClick={() => { setViewerUrl(''); setViewerType('pdf') }}>
                    <div className="pdf-viewer" onClick={(e) => e.stopPropagation()}>
                        <div className="pv-header">
                            <button className="btn py-2 px-3 sm:py-1 sm:px-2 rounded-md text-sm sm:text-base" onClick={() => { setViewerUrl(''); setViewerType('pdf') }}>Close</button>
                        </div>
                        {viewerType === 'video' ? (
                            <video src={viewerUrl} controls style={{ width: '100%', height: 'calc(100% - 44px)' }} />
                        ) : (
                            <iframe src={viewerUrl} title="Resource Preview" frameBorder="0" style={{ width: '100%', height: 'calc(100% - 44px)' }} />
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    )
}
