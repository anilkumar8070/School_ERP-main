import React, { useState, useEffect } from 'react'
import StudentLayout from '../../components/student/StudentLayout'
import '../../styles/ProfilePage.css'
import { toast } from 'react-toastify'
import { getMyStudent, updateProfile } from '../../api'
import { getAuth } from '../../utils/session'

export default function StudentProfile() {
    const [profile, setProfile] = useState({ name: '', email: '', contact: '', address: '', avatar: '' })
    useEffect(() => {
        async function load() {
            try {
                const v = localStorage.getItem('student_profile')
                if (v) { setProfile(JSON.parse(v)) }
            } catch (e) { }
            try {
                const { token } = getAuth()
                if (!token) return
                const s = await getMyStudent(token)
                if (s) {
                    setProfile(p => ({
                        ...p,
                        name: s.name || p.name,
                        email: s.email || p.email,
                        contact: s.contact || p.contact || s.phone || p.contact,
                        address: s.address || p.address
                    }))
                }
            } catch (e) { console.warn('Failed to load student profile', e && e.message) }
        }
        load()
    }, [])
    function onFile(e) { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setProfile(p => ({ ...p, avatar: r.result })); r.readAsDataURL(f) }
    async function save(e) {
        e && e.preventDefault()
        try {
            const { token } = getAuth()
            if (token) {
                const payload = { name: profile.name, contact: profile.contact, address: profile.address, avatar: profile.avatar, email: profile.email }
                await updateProfile(payload, token)
            }
            localStorage.setItem('student_profile', JSON.stringify(profile)); toast.success('Profile saved')
            try { window.dispatchEvent(new CustomEvent('erp_profile_updated', { detail: { role: 'student' } })) } catch (err) { }
        } catch (err) { toast.error(err && err.message ? err.message : 'Failed to save') }
    }
    // dispatch update event so header/avatar refreshes
    const _origSave = save
    function saveWithEvent(e) {
        _origSave(e)
        try { window.dispatchEvent(new CustomEvent('erp_profile_updated', { detail: { role: 'student' } })) } catch (err) { }
    }
    return (
        <div className="profile-vertical">
            <div className="profile-card-vertical">
                <div className="profile-header">
                    {profile.avatar ? (
                        <img className="profile-avatar-large" src={profile.avatar} alt="avatar" />
                    ) : (
                        <div className="profile-initial">S</div>
                    )}

                    <div className="profile-info">
                        <h2>{profile.name || 'Student'}</h2>
                        <p>{profile.email || '—'}</p>
                    </div>
                </div>

                <form className="profile-form" onSubmit={saveWithEvent}>
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
                        <button className="btn-cancel" type="button" onClick={() => { try { const v = localStorage.getItem('student_profile'); if (v) setProfile(JSON.parse(v)); } catch (e) { } try { window.history.back() } catch (e) { } }}>Cancel</button>
                        <button className="btn-primary" type="submit">Save</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
