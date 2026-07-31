import React from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getOnlineAdmissions, API_BASE } from '../../api'
import { getAuth } from '../../utils/session'
import { useQuery } from '@tanstack/react-query'

export default function OnlineAdmissions() {
    const { token } = getAuth()

    const { data: submissions = [], isLoading } = useQuery({
        queryKey: ['onlineAdmissions', token],
        queryFn: () => getOnlineAdmissions(token),
        enabled: !!token
    })

    return (
        <AdminLayout title="Online Admissions">
            <div className="admin-page">
                <header className="admin-page-header">
                    <h2>Online Admissions (Submissions)</h2>
                </header>

                <div className="admin-card">
                    <div className="table-container">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Student</th>
                                    <th>Parent details</th>
                                    <th>Class</th>
                                    <th>Document</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>}
                                {!isLoading && submissions.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }} className="empty-state">No submissions found</td></tr>
                                )}
                                {!isLoading && submissions.map(sub => (
                                    <tr key={sub._id}>
                                        <td>{new Date(sub.submittedAt).toLocaleDateString()}</td>
                                        <td>
                                            <div>{sub.studentName}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DOB: {new Date(sub.dob).toLocaleDateString()} • {sub.gender}</div>
                                        </td>
                                        <td>
                                            <div>{sub.parentName}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sub.parentPhone}</div>
                                        </td>
                                        <td>{sub.classApplying}</td>
                                        <td>
                                            {sub.documentPath ? (
                                                <a 
                                                    href={`${API_BASE}${sub.documentPath}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="btn-secondary"
                                                    style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'inline-block', textDecoration: 'none' }}
                                                >
                                                    View Doc
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <span className={`badge ${sub.status === 'Pending' ? 'yellow' : 'green'}`}>
                                                {sub.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
