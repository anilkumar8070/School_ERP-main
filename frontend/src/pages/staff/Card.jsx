import React, { useEffect, useRef, useState } from 'react'
import StaffLayout from '../../components/staff/StaffLayout'
import { getAuth } from '../../utils/session'
import { getProfile, getStaffCard } from '../../api'
import IDCard from '../../components/common/IDCard'
import html2canvas from 'html2canvas'

export default function StaffCard() {
    const { token } = getAuth()
    const [user, setUser] = useState(null)
    const [card, setCard] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const cardRef = useRef()

    useEffect(() => {
        async function load() {
            setLoading(true)
            setError('')
            try {
                const me = await getProfile(token)
                const currentUser = me && me.user ? me.user : me
                setUser(currentUser)
                // Resolve user id from common possible fields: _id, id or sub (token payload)
                let userId = ''
                if (currentUser) {
                    userId = currentUser._id || currentUser.id || currentUser.sub || ''
                }
                if (userId) {
                    try {
                        const c = await getStaffCard(userId, token)
                        setCard(c)
                    } catch (cardErr) {
                        // If API returns 404 (no card) don't treat as fatal; leave card null so UI shows coming soon
                        const msg = cardErr && cardErr.message ? cardErr.message : ''
                        if (msg && !String(msg).toLowerCase().includes('not found')) setError(msg || 'Unable to load staff card')
                    }
                } else {
                    // no user id available — show coming soon
                    setCard(null)
                }
            } catch (e) {
                setError(e.message || 'Unable to load staff card')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [token])

    async function downloadPng() {
        if (!cardRef.current) return
        const node = cardRef.current
        const canvas = await html2canvas(node, { useCORS: true, backgroundColor: '#ffffff' })
        const dataUrl = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = dataUrl
        const displayName = user && (user.name || user.username) ? (user.name || user.username) : 'card'
        a.download = `staff_id_${displayName.replace(/\s+/g, '_')}.png`
        a.click()
    }

    return (
        <StaffLayout>
            <div className="parent-page" style={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 8 }}>
                <h2>My Staff ID Card</h2>
                {loading && <p>Loading...</p>}
                {error && !loading && <p style={{ color: '#b91c1c' }}>{error}</p>}
                {!loading && !error && !card && (
                    <p>Coming soon — ID card not yet generated.</p>
                )}
                {!loading && card && (
                    <div>
                        <div ref={cardRef} style={{ display: 'inline-block' }}>
                            <IDCard card={card} />
                        </div>
                        <div style={{ marginTop: 12 }}>
                            <button className="btn" onClick={downloadPng}>Download Card</button>
                        </div>
                    </div>
                )}
            </div>
        </StaffLayout>
    )
}
