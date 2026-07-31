import React, { useEffect, useRef, useState } from 'react'
import IDCard from '../../components/common/IDCard'
import { getMyStudent, getStudentCard } from '../../api'
import { getAuth } from '../../utils/session'
import html2canvas from 'html2canvas'

export default function StudentCardPage() {
    const { token } = getAuth()
    const [card, setCard] = useState(null)
    const [schoolName, setSchoolName] = useState('SCHOOL NAME')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const cardRef = useRef(null)

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const me = await getMyStudent(token)
                const c = await getStudentCard(me._id, token)
                setCard(c)
                setSchoolName(c.schoolName || 'SCHOOL NAME')
                setError('')
            } catch (e) {
                setError(e.message || 'No card available')
            }
            setLoading(false)
        }
        load()
    }, [])

    async function downloadCard() {
        try {
            if (!cardRef.current) return
            const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
            const url = canvas.toDataURL('image/png')
            const a = document.createElement('a')
            a.href = url
            a.download = `IDCard_${card && card.idCode ? card.idCode : 'student'}.png`
            a.click()
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div className="student-page">
            <header className="page-header mb-6">
                <h3>Student ID Card</h3>
            </header>

            {loading && <div className="text-muted">Loading...</div>}
            {!loading && error && <div className="text-red-500">{error}</div>}

            {!loading && card && (
                <div className="card p-6 flex flex-col items-center gap-6">
                    <div ref={cardRef} className="shadow-xl rounded-xl overflow-hidden">
                        <IDCard card={{ ...card, schoolName }} />
                    </div>
                    <button className="btn primary big" onClick={downloadCard}>Download ID Card</button>
                </div>
            )}
        </div>
    )
}
