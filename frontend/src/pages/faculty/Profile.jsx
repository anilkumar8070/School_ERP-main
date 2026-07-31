import React, { useState, useEffect } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import '../../styles/ProfilePage.css'
import { toast } from 'react-toastify'
import { getMyFaculty, updateProfile } from '../../api'
import { getAuth } from '../../utils/session'

export default function FacultyProfile() {
    const [profile, setProfile] = useState({ name: '', email: '', contact: '', address: '', avatar: '' })

    useEffect(() => {
        async function load() {
            try {
                const v = localStorage.getItem('faculty_profile')
                if (v) setProfile(JSON.parse(v))
            } catch (e) { }
            try {
                const { token } = getAuth()
                if (!token) return
                const f = await getMyFaculty(token)
                if (f) {
                    setProfile(p => ({
                        ...p,
                        name: f.name || p.name,
                        email: f.email || p.email || f.username,
                        contact: f.contact || p.contact,
                        address: f.address || p.address,
                        avatar: f.avatar || p.avatar,
                        assignments: f.assignments || [],
                        houses: f.houses || [],
                        role: f.role || ''
                    }))
                }
            } catch (e) { console.warn('Failed to load faculty profile', e && e.message) }
        }
        load()
    }, [])

    function onFile(e) {
        const f = e.target.files && e.target.files[0]
        if (!f) return
        const r = new FileReader()
        r.onload = () => setProfile(p => ({ ...p, avatar: r.result }))
        r.readAsDataURL(f)
    }

    async function save(e) {
        e && e.preventDefault()
        try {
            const { token } = getAuth()
            if (token) {
                const payload = { name: profile.name, contact: profile.contact, address: profile.address, avatar: profile.avatar, email: profile.email }
                await updateProfile(payload, token)
            }
            localStorage.setItem('faculty_profile', JSON.stringify(profile))
            toast.success('Profile saved')
            try { window.dispatchEvent(new CustomEvent('erp_profile_updated', { detail: { role: 'faculty' } })) } catch (e) { }
        } catch (err) { toast.error(err && err.message ? err.message : 'Failed to save') }
    }

    return (
        <FacultyLayout title="Profile">
            <div className="profile-vertical">
                <div className="profile-card-vertical">
                    <div className="profile-header">
                        {profile.avatar ? (
                            <img className="profile-avatar-large" src={profile.avatar} alt="avatar" />
                        ) : (
                            <div className="profile-initial">F</div>
                        )}

                        <div className="profile-info">
                            <h2>{profile.name || 'Faculty'}</h2>
                            <p>{profile.email || '—'}</p>
                            <div style={{ marginTop: 8 }}>
                                <strong>Role:</strong> {profile.role || '-'}
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <strong>Assignments:</strong>
                                <div style={{ marginTop: 6 }}>
                                    {(profile.assignments || []).map((a, i) => (
                                        <div key={i} style={{ fontSize: 13 }}>{a.class || ''}{a.section ? (' / ' + a.section) : ''}{a.subjects && a.subjects.length ? ` — ${a.subjects.join(', ')}` : ''}{a.isClassTeacher ? ' (Class Teacher)' : ''}</div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <strong>Houses:</strong> {(profile.houses || []).map(h => `${h.house || ''}${h.role ? ' (' + h.role + ')' : ''}`).join(', ') || '-'}
                            </div>
                        </div>
                    </div>

                    <form className="profile-form" onSubmit={save}>
                        <label>Photo
                            <input type="file" accept="image/*" onChange={onFile} />
                        </label>
                        <label>Name
                            <input type="text" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
                        </label>
                        <label>Email
                            <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                        </label>
                        <label>Contact
                            <input type="text" value={profile.contact} onChange={e => setProfile(p => ({ ...p, contact: e.target.value }))} />
                        </label>
                        <label>Address
                            <input type="text" value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} />
                        </label>
                        <div className="profile-actions">
                            <button className="btn-cancel" type="button" onClick={() => { try { const v = localStorage.getItem('faculty_profile'); if (v) setProfile(JSON.parse(v)); } catch (e) { } try { window.history.back() } catch (e) { } }}>Cancel</button>
                            <button className="btn-primary" type="submit">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </FacultyLayout>
    )
}
