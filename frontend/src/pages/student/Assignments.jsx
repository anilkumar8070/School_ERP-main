import React, { useEffect, useState } from 'react'
import StudentLayout from '../../components/student/StudentLayout'
import { getMyStudent, getAssignmentsApi, submitAssignmentApi, getSubmissionsApi, API_BASE } from '../../api'
import useSubmitAssignment from '../../hooks/useSubmitAssignment'
import { getAuth } from '../../utils/session'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export default function Assignments() {
    const [student, setStudent] = useState(null)
    const [assignments, setAssignments] = useState([])
    const [answers, setAnswers] = useState({})
    const [files, setFiles] = useState({})
    const [mySubs, setMySubs] = useState({}) // map assignmentId -> submission
    const [editing, setEditing] = useState({})
    const [query, setQuery] = useState('')

    useEffect(() => {
        async function load() {
            try {
                const { token } = getAuth()
                const stu = await getMyStudent(token)
                setStudent(stu)
                const cls = stu.class
                const sec = stu.section || 'ALL'
                const items = await getAssignmentsApi({ class: cls, section: sec }, token)
                setAssignments(items || [])
                // load existing submissions for this student for each assignment
                try {
                    const subsArr = await Promise.all((items || []).map(a => getSubmissionsApi(a._id, token).catch(() => [])))
                    const map = {}
                    subsArr.forEach((arr, i) => {
                        const a = items[i]
                        if (!a) return
                        const found = (arr || []).find(s => s.studentEmail === (stu.email || ''))
                        if (found) map[a._id] = found
                    })
                    setMySubs(map)
                } catch (e) {
                    console.warn('Failed to load submissions for student', e)
                }
            } catch (e) { console.error(e) }
        }
        load()
    }, [])

    const submitMutation = useSubmitAssignment()

    async function handleSubmit(a) {
        try {
            const { token } = getAuth()
            const fd = new FormData()
            fd.append('answerText', answers[a._id] || '')
            if (files[a._id]) fd.append('file', files[a._id])
            const submission = await submitMutation.mutateAsync({ assignmentId: a._id, formData: fd, token })
            // reflect in local UI
            setMySubs(s => ({ ...s, [a._id]: submission }))
            setEditing(e => ({ ...e, [a._id]: false }))
        } catch (e) { /* errors handled in hook */ }
    }

    function isClosed(a) {
        if (!a.dueDate) return false
        return new Date() > new Date(a.dueDate)
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Assignments</h3>
            </header>

            <div className="flex flex-col gap-6">
                <div className="card p-3 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input
                        className="bg-transparent border-none outline-none flex-1 text-main"
                        placeholder="Search assignments..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>

                {assignments.length === 0 && <div className="text-muted">No assignments found.</div>}

                <div className="grid gap-6">
                    {assignments
                        .filter(a => {
                            if (!query) return true
                            const hay = ((a.title || '') + ' ' + (a.description || '') + ' ' + (a.subject || '')).toLowerCase()
                            return hay.includes(query.toLowerCase())
                        })
                        .map(a => (
                            <div key={a._id} className="card p-6">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            {a.subject && <span className="badge blue">{a.subject}</span>}
                                            <h4 className="font-bold text-lg text-main m-0">{a.title}</h4>
                                        </div>
                                        <div className="text-muted text-sm mb-3">
                                            Due: {a.dueDate ? new Date(a.dueDate).toLocaleString() : 'No due date'}
                                        </div>
                                        <div className="text-main mb-4">{a.description}</div>

                                        {a.filePath && (
                                            <a href={(a.filePath.startsWith('http')) ? a.filePath : `${API_BASE}${a.filePath}`} target="_blank" rel="noreferrer" className="btn outline sm inline-flex items-center gap-2">
                                                Download Attachment
                                            </a>
                                        )}
                                    </div>

                                    <div className="md:w-80 flex-shrink-0 bg-surface p-4 rounded-lg border border-subtle">
                                        {mySubs[a._id] ? (
                                            <div>
                                                <div className="flex items-center gap-2 mb-2 text-green-600 font-bold">
                                                    <span>✓ Submitted</span>
                                                </div>
                                                <div className="text-xs text-muted mb-3">
                                                    Submitted: {new Date(mySubs[a._id].submittedAt || mySubs[a._id].createdAt).toLocaleString()}
                                                </div>
                                                {mySubs[a._id].filePath && (
                                                    <div className="mb-3">
                                                        <a href={(mySubs[a._id].filePath.startsWith('http')) ? mySubs[a._id].filePath : `${API_BASE}${mySubs[a._id].filePath}`} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline">
                                                            View Submission
                                                        </a>
                                                    </div>
                                                )}
                                                {!isClosed(a) && (
                                                    <button className="btn outline sm w-full" onClick={() => setEditing(e => ({ ...e, [a._id]: true }))}>Resubmit</button>
                                                )}
                                            </div>
                                        ) : null}

                                        {(!isClosed(a) && (!mySubs[a._id] || editing[a._id])) && (
                                            <div className="flex flex-col gap-3">
                                                <label className="text-sm font-bold text-main">Your Answer</label>
                                                <textarea
                                                    className="w-full p-2 rounded border border border-subtle bg-main text-main text-sm min-h-[80px]"
                                                    value={answers[a._id] || ''}
                                                    onChange={e => setAnswers(s => ({ ...s, [a._id]: e.target.value }))}
                                                    placeholder="Type your answer here..."
                                                />
                                                <div className="text-sm">
                                                    <label className="block text-muted mb-1">Attach File (optional)</label>
                                                    <input type="file" className="text-sm text-muted w-full" onChange={e => setFiles(s => ({ ...s, [a._id]: e.target.files[0] }))} />
                                                </div>
                                                <button className="btn primary w-full mt-2" onClick={() => handleSubmit(a)}>
                                                    {mySubs[a._id] ? 'Resubmit' : 'Submit Assignment'}
                                                </button>
                                            </div>
                                        )}

                                        {isClosed(a) && !mySubs[a._id] && (
                                            <div className="text-red-500 font-bold text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                                Submission Closed
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    )
}
