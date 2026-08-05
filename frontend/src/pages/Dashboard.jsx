import React from 'react';
import { Link } from 'react-router-dom';
import {
    FaArrowRight,
    FaBell,
    FaBookOpen,
    FaCalendarAlt,
    FaChartLine,
    FaCheckCircle,
    FaClipboardCheck,
    FaCreditCard,
    FaFileAlt,
    FaGraduationCap,
    FaLock,
    FaSchool,
    FaShieldAlt,
    FaUserFriends,
    FaUserGraduate,
    FaUserTie,
    FaUsersCog,
} from 'react-icons/fa';

const roles = [
    { title: 'Admin', icon: FaUsersCog, href: '/admin-login', description: 'Control admissions, staff, fees, reports, notices, and approvals from one command center.' },
    { title: 'Faculty', icon: FaUserTie, href: '/faculty-login', description: 'Manage attendance, marks, assignments, tests, lesson plans, and class communication.' },
    { title: 'Student', icon: FaUserGraduate, href: '/student-login', description: 'Access timetable, attendance, assignments, results, notices, fees, certificates, and resources.' },
    { title: 'Parent', icon: FaUserFriends, href: '/parents-login', description: 'Track progress, attendance, notices, meetings, messages, and linked student updates.' },
];

const features = [
    { icon: FaClipboardCheck, title: 'Attendance', text: 'Daily student, faculty, and staff attendance tracking.' },
    { icon: FaBookOpen, title: 'Academics', text: 'Syllabus, timetable, tests, marks, report cards, and resources.' },
    { icon: FaCreditCard, title: 'Fees & Salary', text: 'Fee records, payment workflows, discounts, and staff salary tools.' },
    { icon: FaBell, title: 'Communication', text: 'Notices, meetings, complaints, parent messages, and notifications.' },
    { icon: FaFileAlt, title: 'Documents', text: 'Certificates, admit cards, ID cards, uploads, forms, and queries.' },
    { icon: FaChartLine, title: 'Analytics', text: 'Performance visibility for admissions, attendance, rank, and operations.' },
];

const stats = [
    ['1,248', 'Students'],
    ['96%', 'Attendance'],
    ['38', 'Open notices'],
    ['12', 'Pending approvals'],
];

const workflow = [
    'Register students, staff, faculty, and parents',
    'Run attendance, academics, fees, notices, and meetings',
    'Track performance with reports and role-based dashboards',
];

export default function Dashboard() {
    return (
        <div className="landing-page min-h-screen bg-[#fffdf4] text-slate-950">
            <header className="sticky top-0 z-30 border-b border-amber-100 bg-white/90 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
                    <Link to="/" className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#f6c445] text-[#47330b] shadow-md shadow-amber-100 transition-transform duration-300 hover:-translate-y-0.5 hover:rotate-3">
                            <FaSchool className="text-xl" />
                        </span>
                        <span>
                            <span className="block text-lg font-bold leading-none text-[#47330b]">ERP-School</span>
                            <span className="text-xs font-medium uppercase tracking-widest text-[#8a6b24]">Smart campus portal</span>
                        </span>
                    </Link>

                    <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
                        <a href="#roles" className="nav-hover hover:text-[#9a6a00]">Roles</a>
                        <a href="#features" className="nav-hover hover:text-[#9a6a00]">Features</a>
                        <a href="#security" className="nav-hover hover:text-[#9a6a00]">Security</a>
                    </nav>

                    <Link to="/start" className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold">
                        Login <FaArrowRight className="text-xs" />
                    </Link>
                </div>
            </header>

            <main>
                <section className="relative overflow-hidden bg-[#fffdf4]">
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-[0.05]"
                        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2200&auto=format&fit=crop')" }}
                    />
                    <div className="absolute left-[-9rem] top-16 h-72 w-72 rounded-full bg-amber-100/80 blur-3xl" />
                    <div className="absolute bottom-[-7rem] right-10 h-80 w-80 rounded-full bg-yellow-100/80 blur-3xl" />

                    <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-20">
                        <div className="animate-fade-up flex flex-col justify-center">
                            <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm">
                                <FaCheckCircle /> Complete school management system
                            </p>
                            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-[#3f2d08] md:text-6xl">ERP-School</h1>
                            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#6f551f]">
                                Manage academics, attendance, fees, staff, students, parents, documents, and communication from one secure school portal.
                            </p>
                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <Link to="/start" className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-bold">
                                    Login to Portal <FaArrowRight className="text-xs" />
                                </Link>
                                <a href="#features" className="btn-soft inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold">
                                    View Features
                                </a>
                            </div>
                        </div>

                        <div className="animate-fade-up-delay relative min-h-[520px]">
                            <div className="floating-illustration pointer-events-none absolute -right-2 top-0 hidden aspect-square w-[58%] max-w-md overflow-hidden rounded-full border border-amber-100 bg-white shadow-2xl shadow-amber-100/80 md:block">
                                <img src="/learning-illustration.png" alt="Student learning illustration" className="h-full w-full select-none object-cover object-center" />
                            </div>
                            <div className="dashboard-card absolute bottom-0 left-0 right-0 z-10 rounded-lg border border-amber-100 bg-white/92 p-4 shadow-2xl shadow-amber-100/80 backdrop-blur md:left-4 md:right-auto md:w-[58%]">
                                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                                    <div>
                                        <p className="text-sm font-bold text-slate-950">Live Operations</p>
                                        <p className="text-xs text-slate-500">Today at a glance</p>
                                    </div>
                                    <span className="rounded-md bg-yellow-50 px-3 py-1 text-xs font-bold text-yellow-800">Online</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {stats.map(([value, label]) => (
                                        <div key={label} className="stat-tile rounded-lg border border-amber-100 bg-amber-50/45 p-4">
                                            <p className="text-2xl font-bold text-[#3f2d08]">{value}</p>
                                            <p className="text-sm text-slate-500">{label}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 grid gap-3">
                                    <div className="rounded-lg border border-amber-100 p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="font-semibold text-slate-900">Class X-A Performance</span>
                                            <span className="text-sm font-bold text-emerald-700">+8.4%</span>
                                        </div>
                                        <div className="h-3 rounded-full bg-slate-100">
                                            <div className="progress-fill h-3 rounded-full bg-emerald-500" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                                        <div className="rounded-lg bg-yellow-50 p-3 font-semibold text-yellow-800">Exams</div>
                                        <div className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-800">Fees</div>
                                        <div className="rounded-lg bg-rose-50 p-3 font-semibold text-rose-800">Notices</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="roles" className="mx-auto max-w-7xl px-5 py-14 md:px-8">
                    <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-[#b77900]">Role-based access</p>
                            <h2 className="mt-2 text-3xl font-bold text-[#3f2d08]">One portal for every school user</h2>
                        </div>
                        <p className="max-w-xl text-[#6f551f]">Each user lands in the right dashboard with tools designed for their daily work.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {roles.map((role) => {
                            const Icon = role.icon;
                            return (
                                <Link key={role.title} to={role.href} className="lift-card group rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-200">
                                    <Icon className="mb-4 text-3xl text-[#d99a15] transition-transform duration-300 group-hover:scale-110" />
                                    <h3 className="text-lg font-bold text-slate-950">{role.title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{role.description}</p>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                <section id="features" className="bg-white py-14">
                    <div className="mx-auto max-w-7xl px-5 md:px-8">
                        <div className="mb-8 max-w-2xl">
                            <p className="text-sm font-bold uppercase tracking-widest text-[#b77900]">Core modules</p>
                            <h2 className="mt-2 text-3xl font-bold text-[#3f2d08]">Everything a school runs on</h2>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {features.map((feature) => {
                                const Icon = feature.icon;
                                return (
                                    <div key={feature.title} className="lift-card group rounded-lg border border-slate-200 bg-white p-5">
                                        <Icon className="mb-4 text-2xl text-[#d99a15] transition-transform duration-300 group-hover:-translate-y-1" />
                                        <h3 className="text-lg font-bold">{feature.title}</h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-2 md:px-8">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-widest text-[#b77900]">Workflow</p>
                        <h2 className="mt-2 text-3xl font-bold text-[#3f2d08]">From admission to report card</h2>
                        <p className="mt-4 text-[#6f551f]">ERP-School keeps academic and administrative work connected, so updates do not get lost between offices, teachers, students, and parents.</p>
                    </div>
                    <div className="grid gap-3">
                        {workflow.map((item, index) => (
                            <div key={item} className="lift-card flex gap-4 rounded-lg border border-slate-200 bg-white p-5">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f6c445] text-sm font-bold text-[#47330b]">{index + 1}</span>
                                <p className="self-center font-semibold text-slate-800">{item}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="security" className="bg-[#fff4bf] py-14 text-[#47330b]">
                    <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[0.8fr_1.2fr] md:px-8">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-[#b77900]">Trust & security</p>
                            <h2 className="mt-2 text-3xl font-bold">Built for protected school records</h2>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            {[
                                [FaLock, 'Secure login', 'Protected access for every account type.'],
                                [FaShieldAlt, 'Role permissions', 'Dashboards and data stay scoped by role.'],
                                [FaCalendarAlt, 'Operational history', 'Daily activity remains organized and visible.'],
                            ].map(([Icon, title, text]) => (
                                <div key={title} className="lift-card rounded-lg border border-amber-200 bg-white/70 p-5">
                                    <Icon className="mb-4 text-2xl text-[#d99a15]" />
                                    <h3 className="font-bold">{title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-[#6f551f]">{text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-5 py-14 md:px-8">
                    <div className="rounded-lg bg-white p-6 shadow-lg shadow-amber-100 md:flex md:items-center md:justify-between md:p-8">
                        <div>
                            <FaGraduationCap className="mb-4 text-3xl text-[#d99a15]" />
                            <h2 className="text-2xl font-bold text-[#3f2d08]">Start managing your school smarter</h2>
                            <p className="mt-2 text-[#6f551f]">Open the portal and choose the dashboard that matches your role.</p>
                        </div>
                        <Link to="/start" className="btn-primary mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-bold md:mt-0">
                            Login to Portal <FaArrowRight className="text-xs" />
                        </Link>
                    </div>
                </section>
            </main>

            <style>{`
                .landing-page .nav-hover { position: relative; }
                .landing-page .nav-hover::after {
                    background: #f6c445;
                    border-radius: 999px;
                    bottom: -8px;
                    content: '';
                    height: 2px;
                    left: 0;
                    position: absolute;
                    transform: scaleX(0);
                    transform-origin: left;
                    transition: transform 220ms ease;
                    width: 100%;
                }
                .landing-page .nav-hover:hover::after { transform: scaleX(1); }
                .landing-page .btn-primary,
                .landing-page .btn-soft,
                .landing-page .lift-card,
                .landing-page .dashboard-card,
                .landing-page .stat-tile {
                    transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease, background-color 240ms ease;
                }
                .landing-page .btn-primary {
                    background: #f6c445 !important;
                    border: 1px solid #f0ba2b !important;
                    color: #47330b !important;
                    box-shadow: 0 14px 28px rgba(180, 125, 0, 0.16) !important;
                }
                .landing-page .btn-primary:hover {
                    background: #eab532 !important;
                    color: #47330b !important;
                    transform: translateY(-2px);
                }
                .landing-page .btn-soft {
                    background: rgba(255, 255, 255, 0.86) !important;
                    border: 1px solid #f0d58a !important;
                    color: #9a6a00 !important;
                }
                .landing-page .btn-soft:hover { transform: translateY(-2px); }
                .landing-page .lift-card:hover,
                .landing-page .dashboard-card:hover,
                .landing-page .stat-tile:hover {
                    box-shadow: 0 18px 45px rgba(180, 125, 0, 0.14);
                }
                .landing-page .floating-illustration {
                    animation: landingFloat 6s ease-in-out infinite;
                    filter: drop-shadow(0 24px 28px rgba(180, 125, 0, 0.15));
                }
                .landing-page .animate-fade-up { animation: fadeUp 700ms ease both; }
                .landing-page .animate-fade-up-delay { animation: fadeUp 850ms ease 120ms both; }
                .landing-page .progress-fill { animation: growProgress 1100ms ease 450ms both; }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes landingFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-12px); }
                }
                @keyframes growProgress {
                    from { width: 0; }
                    to { width: 78%; }
                }
                @media (max-width: 767px) {
                    .landing-page .dashboard-card { position: relative; width: 100%; }
                }
            `}</style>
        </div>
    );
}
