import React, { useEffect, useState } from 'react'
import AdminLayout from '../../components/admin/AdminLayout'
import '../../pages/AdminPanel.css'
import { getNotificationSettings, updateNotificationSettings } from '../../api'
import { getAuth } from '../../utils/session'

const DEFAULT_EVENTS = [
  { key: 'fee_due', label: 'Fee Due' },
  { key: 'attendance_marked', label: 'Attendance Marked' },
  { key: 'leave_approved', label: 'Leave Approved' },
  { key: 'exam_result', label: 'Exam Result' },
  { key: 'new_notice', label: 'New Notice' }
]

export default function NotificationSettingsAdmin() {
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { token } = getAuth()
        const data = await getNotificationSettings(token)
        
        // Merge with default events to ensure all rows are present
        const merged = DEFAULT_EVENTS.map(def => {
          const existing = data.find(d => d.event === def.key) || {}
          return {
            event: def.key,
            label: def.label,
            email: existing.email !== undefined ? existing.email : true,
            sms: existing.sms || false,
            whatsapp: existing.whatsapp || false
          }
        })
        setSettings(merged)
      } catch (e) {
        setMessage('Failed to load settings: ' + e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleToggle = (index, field) => {
    const updated = [...settings]
    updated[index][field] = !updated[index][field]
    setSettings(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const { token } = getAuth()
      await updateNotificationSettings(settings, token)
      setMessage('Settings saved successfully.')
    } catch (e) {
      setMessage('Failed to save settings: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout title="Notification Settings">
      <div className="admin-page">
        <header className="admin-page-header">
          <h2>Notification Settings</h2>
        </header>

        <div className="admin-card">
          <p className="text-muted" style={{ marginBottom: '20px' }}>
            Configure which communication channels are used for each automated event.
          </p>
          
          {message && (
            <div style={{ marginBottom: 16, padding: '10px', borderRadius: 'var(--radius-md)', background: message.includes('Failed') ? 'var(--danger-color)' : 'var(--primary-color)', color: '#fff', opacity: 0.9 }}>
              {message}
            </div>
          )}

          {loading ? (
            <div className="info">Loading...</div>
          ) : (
            <>
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Event Type</th>
                      <th style={{ textAlign: 'center' }}>Email</th>
                      <th style={{ textAlign: 'center' }}>SMS</th>
                      <th style={{ textAlign: 'center' }}>WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.map((item, index) => (
                      <tr key={item.event}>
                        <td style={{ fontWeight: '500' }}>{item.label}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={item.email} 
                            onChange={() => handleToggle(index, 'email')} 
                            style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={item.sms} 
                            onChange={() => handleToggle(index, 'sms')} 
                            style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={item.whatsapp} 
                            onChange={() => handleToggle(index, 'whatsapp')} 
                            style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="btn-group" style={{ marginTop: '20px', justifyContent: 'flex-start' }}>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
