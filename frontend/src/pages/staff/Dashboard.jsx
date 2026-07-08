import React from 'react'
import StaffLayout from '../../components/staff/StaffLayout'
import { Link } from 'react-router-dom'

export default function StaffDashboard() {
    // Minimal attendance card on dashboard; details available on the attendance page
    return (
        <StaffLayout title="Dashboard">
            <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: '100%', maxWidth: 640 }}>
                    <div className="staff-dashboard-card">
                        <h3>Attendance</h3>
                        <p>Quick summary — view detailed attendance and history on the attendance page.</p>
                        <div style={{ marginTop: 12 }}>
                            <Link to="/staff/attendance"><button className="btn-primary">Open Attendance</button></Link>
                        </div>
                    </div>
                </div>
            </div>
        </StaffLayout>
    )
}
