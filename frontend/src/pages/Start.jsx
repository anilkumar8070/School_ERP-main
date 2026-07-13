import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaSchool, FaUserShield, FaChalkboardTeacher, FaUserGraduate, FaUserFriends, FaUserTie, FaIdCard } from 'react-icons/fa'
import { getIdCardByCode, API_BASE, postContactQuery } from '../api'
import { toast } from 'react-toastify'
import './Start.css'
import './Auth.css'

// Placeholder background images
const BACKGROUND_IMAGES = [
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=2071&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=2070&auto=format&fit=crop',
]

// Login Roles Data
const LOGIN_ROLES = [
    { id: 'admin', title: 'Admin', desc: 'Create and manage your school ecosystem with full administrative privileges', icon: FaUserShield, link: '/admin-login', className: 'admin' },
    { id: 'student', title: 'Student', desc: 'Access assignments, timetables, and academic resources', icon: FaUserGraduate, link: '/student-login', className: 'student' },
    { id: 'faculty', title: 'Teacher', desc: 'Manage classes, assignments, and student progress', icon: FaChalkboardTeacher, link: '/faculty-login', className: 'teacher' },
    { id: 'parent', title: 'Parent', desc: 'View student progress, notices and communication tools', icon: FaUserFriends, link: '/parents-login', className: 'parent' },
    { id: 'staff', title: 'Staff', desc: 'Manage receipts, notices and administrative records', icon: FaUserTie, link: '/staff-login', className: 'staff' }
]

export default function Start() {
    const [bgIndex, setBgIndex] = useState(0)
    const [verifyOpen, setVerifyOpen] = useState(false)
    const [verifyCode, setVerifyCode] = useState('')
    const [verifyResult, setVerifyResult] = useState(null)
    const [verifyError, setVerifyError] = useState('')
    const [contactOpen, setContactOpen] = useState(false)
    const [contactForm, setContactForm] = useState({ name: '', email: '', contact: '', description: '', file: null })
    const [contactSubmitting, setContactSubmitting] = useState(false)
    const contactFileRef = React.createRef()

    // Auto-scroll background
    useEffect(() => {
        const interval = setInterval(() => {
            setBgIndex(prev => (prev + 1) % BACKGROUND_IMAGES.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    async function verifyIdCard(e) {
        e.preventDefault()
        setVerifyError(''); setVerifyResult(null)
        if (!verifyCode.trim()) { setVerifyError('Enter ID card code'); return }
        try {
            const card = await getIdCardByCode(verifyCode.trim())
            setVerifyResult(card || null)
        } catch (err) {
            setVerifyError(err.message || 'Invalid code')
        }
    }

    const handleNav = (e, link) => {
        e.preventDefault()
        window.history.pushState({}, '', link)
        window.dispatchEvent(new PopStateEvent('popstate'))
    }

    return (
        <div className="flex flex-col font-sans min-h-screen text-gray-800 bg-gray-50">
            {/* Header (from Dashboard) */}
            <header className="bg-white text-gray-800 py-4 px-6 md:px-12 flex justify-between items-center shadow-md relative z-50">
                <div className="flex items-center gap-2">
                    <FaSchool className="text-3xl text-black" />
                    <span className="text-xl font-bold tracking-tight">ERP-School</span>
                </div>
                <nav>
                    <button
                        onClick={() => setContactOpen(true)}
                        className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-full transition-colors duration-200 cursor-pointer border-none"
                    >
                        Contact
                    </button>
                </nav>
            </header>

            {/* Hero Section */}
            <div className="relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4">
                {/* Background Slider */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                    {BACKGROUND_IMAGES.map((img, idx) => (
                        <div
                            key={idx}
                            className={`bg-slide ${idx === bgIndex ? 'active' : ''}`}
                            style={{ backgroundImage: `url(${img})` }}
                        />
                    ))}
                    <div className="absolute inset-0 bg-black/60 z-10" />
                </div>

                {/* Hero Content */}
                <div className="relative z-20 text-center w-full max-w-7xl mx-auto">
                    <div className="start-title mb-12">
                        <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-4 drop-shadow-md">
                            School Management System
                        </h1>
                        <p className="text-lg md:text-xl text-gray-200">
                            Connect to your educational journey with a single click
                        </p>
                    </div>

                    <div className="role-cards justify-center">
                        {LOGIN_ROLES.map(role => (
                            <div key={role.id} className={`role-card ${role.className}`}>
                                <div className="card-icon">
                                    <role.icon />
                                </div>
                                <h3>{role.title}</h3>
                                <p>{role.desc}</p>
                                <a href={role.link} className="card-btn" onClick={(e) => handleNav(e, role.link)}>Continue</a>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Floating Verify ID Button */}
            <button
                onClick={() => setVerifyOpen(true)}
                className="fixed bottom-6 left-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
            >
                <FaIdCard className="text-xl" />
                Verify ID
            </button>


            {/* Forms Banner */}
            <div className="bg-gray-900 text-white py-12 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <h3 className="text-2xl font-bold mb-2">ERP — School Management</h3>
                        <p className="text-gray-400 mb-4 max-w-2xl">Reliable, secure, and easy-to-use school management platform — manage students, staff, finances and communications.</p>
                        <div className="text-sm text-gray-500">Contact: <a href="tel:6378452145" className="hover:text-blue-400">6378452145</a> • Email: <a href="mailto:erp@creator" className="hover:text-blue-400">erp@creator</a></div>
                    </div>
                    <a className="bg-white text-gray-900 hover:bg-gray-100 font-bold py-3 px-8 rounded-lg transition-transform hover:scale-105 inline-block" href="/forms" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/forms'); window.dispatchEvent(new PopStateEvent('popstate')) }}>
                        View Forms
                    </a>
                </div>
            </div>


            {/* Footer (Original) */}
            <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-500">
                ©2025 ERP
            </footer>

            {/* Verify Modal */}
            {verifyOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
                        <button onClick={() => setVerifyOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        <div className="text-center">
                            <h3 className="text-2xl font-bold text-gray-800 mb-6">Verify ID Card</h3>
                            <form onSubmit={verifyIdCard} className="flex gap-4 justify-center mb-6">
                                <input
                                    className="bg-gray-100 border border-gray-300 text-gray-800 rounded-lg px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter ID Code (e.g., IDC_XXXX)"
                                    value={verifyCode}
                                    onChange={e => setVerifyCode(e.target.value)}
                                />
                                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors" type="submit">
                                    Verify
                                </button>
                            </form>

                            {verifyError && <div className="text-red-500 font-medium mb-4">{verifyError}</div>}

                            {verifyResult && (() => {
                                const prefixType = verifyResult?.idCode?.startsWith('IDF_') ? 'faculty' : (verifyResult?.idCode?.startsWith('IDS_') ? 'staff' : 'student')
                                const resolvedType = (verifyResult.type || prefixType)
                                const label = resolvedType ? (resolvedType.charAt(0).toUpperCase() + resolvedType.slice(1)) : '-'

                                let rawUrl = verifyResult && verifyResult.photoUrl ? String(verifyResult.photoUrl) : ''
                                if (rawUrl && !rawUrl.startsWith('http') && !rawUrl.startsWith('/')) rawUrl = '/' + rawUrl
                                const absoluteUrl = rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `${API_BASE || ''}${rawUrl}`) : ''
                                const imgSrc = absoluteUrl || '/default-avatar.svg'

                                return (
                                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 flex items-start gap-6 text-left shadow-sm">
                                        <img src={imgSrc} alt="Photo" className="w-24 h-32 object-cover rounded-lg border border-gray-300" />
                                        <div>
                                            <div className="text-sm font-semibold text-green-600 uppercase tracking-wider mb-1">Verified Member</div>
                                            <div className="text-2xl font-bold text-gray-900 mb-2">{verifyResult.name}</div>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <span className="bg-gray-800 text-white px-2 py-1 rounded text-xs font-bold uppercase">{label}</span>
                                                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-mono">{verifyResult.idCode}</span>
                                            </div>
                                            {resolvedType === 'student' && verifyResult.class && (
                                                <div className="text-sm text-gray-600">
                                                    Class {verifyResult.class} {verifyResult.section}
                                                </div>
                                            )}
                                            <div className="text-xs text-gray-400 mt-2">Valid Upto: {verifyResult.validUpto ? new Date(verifyResult.validUpto).toLocaleDateString() : '-'}</div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Modal */}
            {contactOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Contact Us</h3>
                                <p className="text-sm text-gray-500">Send your query and attach a PDF (optional)</p>
                            </div>
                            <button onClick={() => setContactOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <form onSubmit={async (e) => {
                            try {
                                e.preventDefault()
                                setContactSubmitting(true)
                                // validation
                                if (!contactForm.name || !contactForm.email || !contactForm.contact || !contactForm.description) throw new Error('Please fill all required fields')
                                if ((contactForm.description || '').length > 1000) throw new Error('Description must be 1000 characters or less')
                                if (contactForm.file) {
                                    const f = contactForm.file
                                    const max = 500 * 1024 * 1024
                                    if (f.size > max) throw new Error('Attachment must be 500MB or smaller')
                                    if (f.type !== 'application/pdf') throw new Error('Only PDF attachments allowed')
                                }

                                const fd = new FormData()
                                fd.append('name', contactForm.name)
                                fd.append('email', contactForm.email)
                                fd.append('contact', contactForm.contact)
                                fd.append('description', contactForm.description)
                                if (contactForm.file) fd.append('attachment', contactForm.file)

                                await postContactQuery(fd)
                                toast.success('Query submitted — admin will review it')
                                setContactOpen(false)
                                setContactForm({ name: '', email: '', contact: '', description: '', file: null })
                                if (contactFileRef && contactFileRef.current) contactFileRef.current.value = null
                            } catch (err) {
                                console.error(err)
                                toast.error(err?.message || 'Submission failed')
                            } finally { setContactSubmitting(false) }
                        }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                <input name="name" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <input name="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} type="email" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No *</label>
                                <input name="contact" value={contactForm.contact} onChange={e => setContactForm({ ...contactForm, contact: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (PDF, optional — max 500MB)</label>
                                <input name="attachment" ref={contactFileRef} onChange={e => setContactForm({ ...contactForm, file: e.target.files && e.target.files[0] })} type="file" accept="application/pdf,.pdf" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description * (max 1000 chars)</label>
                                <textarea name="description" value={contactForm.description} onChange={e => setContactForm({ ...contactForm, description: e.target.value })} rows={4} maxLength={1000} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setContactOpen(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">Cancel</button>
                                <button type="submit" disabled={contactSubmitting} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50">{contactSubmitting ? 'Submitting…' : 'Submit'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
