import React, { useEffect, useRef, useState } from 'react'
import FacultyLayout from '../../components/faculty/FacultyLayout'
import { getAuth } from '../../utils/session'
import { getMyFaculty, getFacultyCard } from '../../api'
import IDCard from '../../components/common/IDCard'
import html2canvas from 'html2canvas'

export default function FacultyCard() {
    const { token } = getAuth()
    const [faculty, setFaculty] = useState(null)
    const [card, setCard] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const cardRef = useRef()

    useEffect(() => {
        async function load() {
            setLoading(true)
            setError('')
            try {
                const me = await getMyFaculty(token)
                setFaculty(me)
                const c = await getFacultyCard(me._id, token)
                setCard(c)
            } catch (e) {
                setError(e.message || 'Unable to load card')
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
        a.download = `faculty_id_${faculty && faculty.name ? faculty.name.replace(/\s+/g, '_') : 'card'}.png`
        a.click()
    }

    return (
        <FacultyLayout>
            <div className="faculty-page" style={{ maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 8 }}>
                <h2>My ID Card</h2>
                {loading && <p>Loading...</p>}
                {error && !loading && <p style={{ color: '#b91c1c' }}>{error}</p>}
                {!loading && !error && !card && (
                    <p>No ID card found. Please contact admin to generate your ID card.</p>
                )}
                {!loading && card && (
                    <div>
                        <div ref={cardRef} style={{ display: 'inline-block' }}>
                            <IDCard card={card} />
                        </div>
                        <div style={{ marginTop: 12 }}>
                            <button className="btn-primary" onClick={downloadPng}>Download Card</button>
                        </div>
                    </div>
                )}
            </div>
        </FacultyLayout>
    )
}
