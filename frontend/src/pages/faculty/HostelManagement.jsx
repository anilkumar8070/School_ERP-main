import React from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'

export default function HostelManagement() {
    return (
        <FacultyLayout title="Hostel Management">
            <div style={{ padding: 20, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                        <h2 style={{ margin: 0 }}>Hostel Management</h2>
                        <p style={{ margin: '6px 0 0', color: '#6b7280' }}>This feature is coming soon. We'll add hostel allocation, rooms and student assignments here.</p>
                    </div>
                    <div style={{ position: 'sticky', top: 16, alignSelf: 'flex-start' }}>
                        <button type="button" className="btn" style={{ background: 'linear-gradient(90deg,#06b6d4,#0ea5a4)', color: '#fff', border: 'none' }} onClick={() => { /* placeholder - no navigation to prevent scroll jump */ }}>
                            Coming Soon
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 20, border: '2px dashed #c7f9f1', padding: 28, borderRadius: 8, background: '#f8fdfc', textAlign: 'center' }}>
                    <h3 style={{ marginTop: 0, color: '#0f172a' }}>Feature Coming Soon</h3>
                    <p style={{ color: '#475569' }}>Hostel management tools (room allocation, bed assignment, hostel fees and reports) will be available here soon. For now, this page is a placeholder.</p>
                    <div style={{ marginTop: 12 }}>
                        <button type="button" className="btn outline" onClick={() => alert('Hostel management coming soon')}>Notify me</button>
                    </div>
                </div>
            </div>
        </FacultyLayout>
    )
}
