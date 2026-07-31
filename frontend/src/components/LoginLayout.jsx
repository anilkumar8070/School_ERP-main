import { FaChalkboardTeacher, FaUserFriends, FaUserGraduate, FaUserShield, FaUserTie } from 'react-icons/fa'
import './LoginLayout.css'

const ROLE_META = {
    admin: {
        icon: FaUserShield,
        eyebrow: 'Command Center',
        stat: 'Full Access',
        items: ['Admissions', 'Finance', 'Approvals'],
    },
    student: {
        icon: FaUserGraduate,
        eyebrow: 'Learning Desk',
        stat: 'Daily Focus',
        items: ['Tests', 'Attendance', 'Resources'],
    },
    teacher: {
        icon: FaChalkboardTeacher,
        eyebrow: 'Faculty Studio',
        stat: 'Class Flow',
        items: ['Marks', 'Assignments', 'Timetable'],
    },
    parent: {
        icon: FaUserFriends,
        eyebrow: 'Family View',
        stat: 'Live Updates',
        items: ['Progress', 'Notices', 'Meetings'],
    },
    staff: {
        icon: FaUserTie,
        eyebrow: 'Operations Hub',
        stat: 'Fast Desk',
        items: ['Receipts', 'Cards', 'Records'],
    },
}

function resolveRole(title = '') {
    const lower = title.toLowerCase()
    if (lower.includes('admin')) return 'admin'
    if (lower.includes('student')) return 'student'
    if (lower.includes('teacher') || lower.includes('faculty')) return 'teacher'
    if (lower.includes('parent')) return 'parent'
    if (lower.includes('staff')) return 'staff'
    return 'student'
}

const LoginLayout = ({
    title,
    description = 'Enter your portal credentials to continue.',
    username,
    setUsername,
    password,
    setPassword,
    onSubmit,
    loading,
    error,
    signupLink,
    forgotPasswordLink = '/forgot-password',
    usernameLabel = 'Username or email',
    passwordLabel = 'Password'
}) => {
    const role = resolveRole(title)
    const meta = ROLE_META[role]
    const RoleIcon = meta.icon

    return (
        <div className={`login-container login-${role}`}>
            <Link to="/start" className="login-back"><FaArrowLeft /> Back to portal</Link>

            <section className="login-stage">
                <div className="login-showcase">
                    <div className="login-brand">
                        <span><FaSchool /></span>
                        <strong>ERP-School</strong>
                    </div>

                    <div className="showcase-copy">
                        <span className="showcase-eyebrow">{meta.eyebrow}</span>
                        <h1>{title.replace(' Login', '')}<br />Portal</h1>
                        <p>Designed for focused school work, clean permissions, and quick movement from login to action.</p>
                    </div>

                    <div className="showcase-board" aria-hidden="true">
                        <div className="role-medallion"><RoleIcon /></div>
                        <div className="board-row top">
                            <span>Today</span>
                            <b>{meta.stat}</b>
                        </div>
                        <div className="board-meter"><i /></div>
                        <div className="board-grid">
                            {meta.items.map(item => <span key={item}>{item}</span>)}
                        </div>
                    </div>
                </div>

                <div className="login-form-section">
                    <div className="login-form-wrapper">
                        <div className="form-badge"><FaIdBadge /> Secure role login</div>
                        <h2 className="login-title">{title}</h2>
                        <p className="login-desc">{description}</p>

                        <form onSubmit={onSubmit} className="login-form">
                            <label className="input-group">
                                <span><FaUser /> Identity</span>
                                <input
                                    type="text"
                                    placeholder={usernameLabel}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </label>
                            <label className="input-group">
                                <span><FaLock /> Password</span>
                                <input
                                    type="password"
                                    placeholder={passwordLabel}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </label>

                            {error && <div className="login-error">{error}</div>}

                            <div className="form-info">
                                <Link to={forgotPasswordLink}>Forgot password?</Link>
                            </div>

                            <button type="submit" className="login-btn" disabled={loading}>
                                {loading ? 'Logging In...' : <>Login <FaArrowRight /></>}
                            </button>

                            {signupLink && (
                                <div className="signup-link">
                                    Need access? <Link to={signupLink}>Signup Now</Link>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default LoginLayout
