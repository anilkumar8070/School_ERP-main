import { useRef, useState } from 'react'
import { FaBell, FaChalkboardTeacher, FaChartLine, FaFileAlt, FaUserFriends, FaUserGraduate, FaUserShield, FaUserTie } from 'react-icons/fa'
import { getIdCardByCode, API_BASE, postContactQuery } from '../api'
import { toast } from 'react-toastify'
import './Start.css'
import './Auth.css'

const LOGIN_ROLES = [
    { id: 'admin', title: 'Admin', desc: 'Create and manage your school ecosystem with full administrative privileges.', icon: FaUserShield, link: '/admin-login', className: 'admin' },
    { id: 'student', title: 'Student', desc: 'Access assignments, timetables, tests, fees, resources, and academic progress.', icon: FaUserGraduate, link: '/student-login', className: 'student' },
    { id: 'faculty', title: 'Teacher', desc: 'Manage classes, assignments, attendance, marks, notices, and student growth.', icon: FaChalkboardTeacher, link: '/faculty-login', className: 'teacher' },
    { id: 'parent', title: 'Parent', desc: 'Follow attendance, results, notices, meetings, and communication in one place.', icon: FaUserFriends, link: '/parents-login', className: 'parent' },
    { id: 'staff', title: 'Staff', desc: 'Handle receipts, salary, notices, cards, certificates, and daily operations.', icon: FaUserTie, link: '/staff-login', className: 'staff' },
]

const FEATURES = [
    { icon: FaChartLine, title: 'Academic command center', text: 'Attendance, results, timetables, assignments, and report cards in one focused workspace.' },
    { icon: FaBell, title: 'Instant communication', text: 'Notices, meetings, complaints, resources, and messages move cleanly between every role.' },
    { icon: FaFileAlt, title: 'Document automation', text: 'Generate receipts, ID cards, certificates, admit cards, and transport records without friction.' },
]

const SECURITY_POINTS = ['Role-based dashboards', 'JWT protected sessions', 'Verified ID-card lookup', 'Secure uploads and records']

export default function Start() {
    const [verifyOpen, setVerifyOpen] = useState(false)
    const [verifyCode, setVerifyCode] = useState('')
    const [verifyResult, setVerifyResult] = useState(null)
    const [verifyError, setVerifyError] = useState('')
    const [contactOpen, setContactOpen] = useState(false)
    const [contactForm, setContactForm] = useState({ name: '', email: '', contact: '', description: '', file: null })
    const [contactSubmitting, setContactSubmitting] = useState(false)
    const contactFileRef = useRef(null)

    async function verifyIdCard(e) {
        e.preventDefault()
        setVerifyError('')
        setVerifyResult(null)
        if (!verifyCode.trim()) {
            setVerifyError('Enter ID card code')
            return
        }
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

    const submitContact = async (e) => {
        try {
            e.preventDefault()
            setContactSubmitting(true)
            if (!contactForm.name || !contactForm.email || !contactForm.contact || !contactForm.description) throw new Error('Please fill all required fields')
            if ((contactForm.description || '').length > 1000) throw new Error('Description must be 1000 characters or less')
            if (contactForm.file) {
                const max = 500 * 1024 * 1024
                if (contactForm.file.size > max) throw new Error('Attachment must be 500MB or smaller')
                if (contactForm.file.type !== 'application/pdf') throw new Error('Only PDF attachments allowed')
            }

            const fd = new FormData()
            fd.append('name', contactForm.name)
            fd.append('email', contactForm.email)
            fd.append('contact', contactForm.contact)
            fd.append('description', contactForm.description)
            if (contactForm.file) fd.append('attachment', contactForm.file)

            await postContactQuery(fd)
            toast.success('Query submitted. Admin will review it.')
            setContactOpen(false)
            setContactForm({ name: '', email: '', contact: '', description: '', file: null })
            if (contactFileRef.current) contactFileRef.current.value = null
        } catch (err) {
            toast.error(err?.message || 'Submission failed')
        } finally {
            setContactSubmitting(false)
        }
    }

    return (
        <div className="start-page">
            <header className="start-nav">
                <a className="brand-lockup" href="/start" onClick={(e) => handleNav(e, '/start')}>
                    <span className="brand-mark"><FaSchool /></span>
                    <span>
                        <strong>ERP-School</strong>
                        <small>Smart Campus Portal</small>
                    </span>
                </a>
                <nav className="nav-links" aria-label="Landing navigation">
                    <a href="#roles">Roles</a>
                    <a href="#features">Features</a>
                    <a href="#security">Security</a>
                </nav>
                <div className="nav-actions">
                    <button className="ghost-link" onClick={() => setContactOpen(true)}>Contact</button>
                    <a className="login-pill" href="#roles">Login <FaArrowRight /></a>
                </div>
            </header>

            <main>
                <section className="hero-shell">
                    <div className="hero-copy">
                        <div className="eyebrow"><FaCheckCircle /> Complete school management system</div>
                        <h1>ERP-School</h1>
                        <p>Manage academics, attendance, fees, staff, students, parents, documents, and communication from one secure school portal.</p>
                        <div className="hero-cta">
                            <a className="primary-cta" href="#roles">Login to Portal <FaArrowRight /></a>
                            <a className="secondary-cta" href="#features">View Features</a>
                        </div>
                    </div>

                    <div className="hero-art" aria-hidden="true">
                        <div className="student-orbit">
                            <div className="student-illustration">
                                <div className="head" />
                                <div className="hair" />
                                <div className="body" />
                                <div className="laptop" />
                                <div className="book book-one" />
                                <div className="book book-two" />
                            </div>
                        </div>
                        <div className="ops-card">
                            <div className="ops-head">
                                <div>
                                    <strong>Live Operations</strong>
                                    <span>Today at a glance</span>
                                </div>
                                <em>Online</em>
                            </div>
                            <div className="metrics-grid">
                                <div><b>1,248</b><span>Students</span></div>
                                <div><b>96%</b><span>Attendance</span></div>
                                <div><b>38</b><span>Open notices</span></div>
                                <div><b>12</b><span>Pending approvals</span></div>
                            </div>
                            <div className="performance-card">
                                <span>Class X-A<br />Performance</span>
                                <b>+8.4%</b>
                                <i />
                            </div>
                            <div className="quick-chips">
                                <span>Exams</span>
                                <span>Fees</span>
                                <span>Notices</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="role-section" id="roles">
                    <div className="section-heading">
                        <span>Choose Your Workspace</span>
                        <h2>One portal, five focused experiences.</h2>
                    </div>
                    <div className="role-cards">
                        {LOGIN_ROLES.map(role => (
                            <a key={role.id} href={role.link} className={`role-card ${role.className}`} onClick={(e) => handleNav(e, role.link)}>
                                <div className="card-icon"><role.icon /></div>
                                <h3>{role.title}</h3>
                                <p>{role.desc}</p>
                                <strong>Continue <FaArrowRight /></strong>
                            </a>
                        ))}
                    </div>
                </section>

                <section className="feature-section" id="features">
                    <div className="section-heading">
                        <span>Features</span>
                        <h2>Built for busy schools that need clarity fast.</h2>
                    </div>
                    <div className="feature-grid">
                        {FEATURES.map(feature => (
                            <article className="feature-tile" key={feature.title}>
                                <feature.icon />
                                <h3>{feature.title}</h3>
                                <p>{feature.text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="security-band" id="security">
                    <div>
                        <span className="security-kicker"><FaShieldAlt /> Security</span>
                        <h2>Access is organized by role, identity, and session.</h2>
                    </div>
                    <div className="security-list">
                        {SECURITY_POINTS.map(point => <span key={point}><FaLock /> {point}</span>)}
                    </div>
                </section>

                <section className="forms-banner">
                    <div>
                        <h3>ERP School Management</h3>
                        <p>Reliable, secure, and easy-to-use school management platform for students, staff, finances, and communication.</p>
                        <span>Contact: <a href="tel:6378452145">6378452145</a> | Email: <a href="mailto:erp@creator">erp@creator</a></span>
                    </div>
                    <a href="/forms" onClick={(e) => handleNav(e, '/forms')}>View Forms <FaArrowRight /></a>
                </section>
            </main>

            <footer className="start-footer">
                <span>ERP-School</span>
                <span>Smart Campus Portal</span>
            </footer>

            <button onClick={() => setVerifyOpen(true)} className="verify-fab">
                <FaIdCard />
                Verify ID
            </button>

            {verifyOpen && (
                <div className="start-modal-backdrop">
                    <div className="start-modal">
                        <button onClick={() => setVerifyOpen(false)} className="modal-close">&times;</button>
                        <div className="text-center">
                            <h3 className="text-2xl font-bold text-gray-800 mb-6">Verify ID Card</h3>
                            <form onSubmit={verifyIdCard} className="flex gap-4 justify-center mb-6">
                                <input className="bg-gray-100 border border-gray-300 text-gray-800 rounded-lg px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter ID Code (e.g., IDC_XXXX)" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} />
                                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors" type="submit">Verify</button>
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
                                            {resolvedType === 'student' && verifyResult.class && <div className="text-sm text-gray-600">Class {verifyResult.class} {verifyResult.section}</div>}
                                            <div className="text-xs text-gray-400 mt-2">Valid Upto: {verifyResult.validUpto ? new Date(verifyResult.validUpto).toLocaleDateString() : '-'}</div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {contactOpen && (
                <div className="start-modal-backdrop">
                    <div className="start-modal start-contact-modal">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Contact Us</h3>
                                <p className="text-sm text-gray-500">Send your query and attach a PDF, if needed.</p>
                            </div>
                            <button onClick={() => setContactOpen(false)} className="modal-close inline-close">&times;</button>
                        </div>

                        <form onSubmit={submitContact} className="space-y-4">
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (PDF, optional, max 500MB)</label>
                                <input name="attachment" ref={contactFileRef} onChange={e => setContactForm({ ...contactForm, file: e.target.files && e.target.files[0] })} type="file" accept="application/pdf,.pdf" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description * (max 1000 chars)</label>
                                <textarea name="description" value={contactForm.description} onChange={e => setContactForm({ ...contactForm, description: e.target.value })} rows={4} maxLength={1000} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setContactOpen(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">Cancel</button>
                                <button type="submit" disabled={contactSubmitting} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50">{contactSubmitting ? 'Submitting...' : 'Submit'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
