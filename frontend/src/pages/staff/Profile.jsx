import React, { useState, useEffect } from 'react'
import StaffLayout from '../../components/staff/StaffLayout'
import '../../styles/ProfilePage.css'
import { toast } from 'react-toastify'
import { getProfile, updateProfile } from '../../api'
import { getAuth } from '../../utils/session'

export default function StaffProfile() {
    const [profile, setProfile] = useState({ name: '', email: '', contact: '', address: '', avatar: '' })

    useEffect(() => {
        async function load() {
            try {
                const v = localStorage.getItem('staff_profile')
                if (v) setProfile(JSON.parse(v))
            } catch (e) { }
            try {
                const { token } = getAuth()
                if (!token) return
                const me = await getProfile(token)
                const u = me && me.user ? me.user : me
                if (u) {
                    setProfile(p => ({
                        ...p,
                        name: u.name || p.name,
                        email: u.email || p.email || u.username,
                        contact: u.contact || p.contact,
                        address: u.address || p.address,
                        avatar: u.avatar || p.avatar
                    }))
                }
            } catch (e) { console.warn('Failed to load staff profile', e && e.message) }
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
            localStorage.setItem('staff_profile', JSON.stringify(profile))
            toast.success('Profile saved')
            try { window.dispatchEvent(new CustomEvent('erp_profile_updated', { detail: { role: 'staff' } })) } catch (e) { }
        } catch (err) { toast.error(err && err.message ? err.message : 'Failed to save') }
    }

    return (
        <StaffLayout title="Profile">
            <div className="profile-vertical">
                <div className="profile-card-vertical">
                    <div className="profile-header">
                        {profile.avatar ? (
                            <img className="profile-avatar-large" src={profile.avatar} alt="avatar" />
                        ) : (
                            <div className="profile-initial">S</div>
                        )}

                        <div className="profile-info">
                            <h2>{profile.name || 'Staff'}</h2>
                            <p>{profile.email || '—'}</p>
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
                            <button className="btn-cancel" type="button" onClick={() => { try { const v = localStorage.getItem('staff_profile'); if (v) setProfile(JSON.parse(v)); } catch (e) { } try { window.history.back() } catch (e) { } }}>Cancel</button>
                            <button className="btn-primary" type="submit">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </StaffLayout>
    )
}
