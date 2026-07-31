import React from 'react'
import StudentLayout from '../../components/student/StudentLayout'

export default function StudentTestResults() {
    return (
        <StudentLayout title="Test Results">
            <div style={{ padding: 20 }}>
                <h2>Test Results</h2>
                <p style={{ color: '#374151' }}>View your individual test results here.</p>

                <section style={{ marginTop: 12 }}>
                    <div style={{ padding: 12, borderRadius: 8, background: '#fff' }}>
                        <p style={{ color: '#6b7280' }}>No results available yet. Implement fetching and display logic as needed.</p>
                    </div>
                </section>
            </div>
        </StudentLayout>
    )
}
