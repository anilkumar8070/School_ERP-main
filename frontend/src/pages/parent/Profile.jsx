import React, { useState, useEffect } from 'react'
import ParentLayout from '../../components/parent/ParentLayout'
import '../../styles/ProfilePage.css'
import { toast } from 'react-toastify'

export default function ParentProfile() {
    const [profile, setProfile] = useState({ name: '', email: '', contact: '', address: '', avatar: '' })
    useEffect(() => {
        try {
            // load saved profile first
            const v = localStorage.getItem('parent_profile')
            if (v) {
                setProfile(JSON.parse(v))
                return
            }
        } catch (e) { }

        // fallback: try to hydrate from JWT token payload (if any)
        try {
            const token = sessionStorage.getItem('erp_token') || localStorage.getItem('erp_token')
            if (token) {
                const payload = (() => {
                    try {
                        const p = token.split('.')[1]
                        const json = atob(p.replace(/-/g, '+').replace(/_/g, '/'))
                        return JSON.parse(decodeURIComponent(escape(json)))
                    } catch (err) { return null }
                })()
                if (payload) {
                    setProfile(p => ({
                        ...p,
                        name: payload.name || payload.fullname || p.name,
                        email: payload.email || p.email,
                    }))
                }
            }
        } catch (e) { }
    }, [])
    function onFile(e) { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setProfile(p => ({ ...p, avatar: r.result })); r.readAsDataURL(f) }
    function save(e) { e && e.preventDefault(); try { localStorage.setItem('parent_profile', JSON.stringify(profile)); toast.success('Profile saved'); try { window.dispatchEvent(new CustomEvent('erp_profile_updated', { detail: { role: 'parent' } })) } catch (err) { } } catch (err) { toast.error('Failed to save') } }
    return (
        <ParentLayout>
            <div className="profile-vertical">
                <div className="profile-card-vertical">
                    <div className="profile-header">
                        {profile.avatar ? (
                            <img className="profile-avatar-large" src={profile.avatar} alt="avatar" />
                        ) : (
                            <div className="profile-initial">P</div>
                        )}

                        <div className="profile-info">
                            <h2>{profile.name || 'Parent'}</h2>
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
                            <button className="btn-cancel" type="button" onClick={() => { try { const v = localStorage.getItem('parent_profile'); if (v) setProfile(JSON.parse(v)); } catch (e) { } try { window.history.back() } catch (e) { } }}>Cancel</button>
                            <button className="btn-primary" type="submit">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </ParentLayout>
    )
}
