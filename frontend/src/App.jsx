import React, { useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import './index.css'

import { getAuth } from './utils/session'
import 'react-toastify/dist/ReactToastify.css'

const AdminPanel = React.lazy(() => import('./pages/AdminPanel'))
const AdminMessages = React.lazy(() => import('./pages/AdminMessages'))
const Academics = React.lazy(() => import('./pages/Academics'))
const AcademicsSyllabus = React.lazy(() => import('./pages/AcademicsSyllabus'))
const AcademicsTimetable = React.lazy(() => import('./pages/AcademicsTimetable'))
const AcademicsResults = React.lazy(() => import('./pages/AcademicsResults'))
const Finance = React.lazy(() => import('./pages/admin/Finance'))
const Meeting = React.lazy(() => import('./pages/Meeting'))
const Complaints = React.lazy(() => import('./pages/Complaints'))
const Events = React.lazy(() => import('./pages/Events'))
const AdminProfile = React.lazy(() => import('./pages/AdminProfile'))
const AdminStudents = React.lazy(() => import('./pages/admin/Students'))
const AdminFaculty = React.lazy(() => import('./pages/admin/Faculty'))
const AdminAdmins = React.lazy(() => import('./pages/admin/Admins'))
const AdminParents = React.lazy(() => import('./pages/admin/Parents'))
const AdminApprovals = React.lazy(() => import('./pages/admin/Approvals'))
const AdminDeleteRequests = React.lazy(() => import('./pages/admin/DeleteRequests'))
const AdminStudentApprovals = React.lazy(() => import('./pages/admin/StudentApprovals'))
const StudentLeaves = React.lazy(() => import('./pages/admin/StudentLeaves'))
const FacultyLeavesAdmin = React.lazy(() => import('./pages/admin/FacultyLeaves'))
const AdminTests = React.lazy(() => import('./pages/admin/Tests'))
const ViewTestSeries = React.lazy(() => import('./pages/admin/ViewTestSeries'))
const AdminTestResults = React.lazy(() => import('./pages/admin/TestResults'))
const AdminStudentAttendance = React.lazy(() => import('./pages/admin/StudentAttendance'))
const AdminFacultyAttendance = React.lazy(() => import('./pages/admin/FacultyAttendance'))
const AdminStaffAttendance = React.lazy(() => import('./pages/admin/StaffAttendance'))
const StaffLeavesAdmin = React.lazy(() => import('./pages/admin/StaffLeaves'))
const ParentDashboard = React.lazy(() => import('./pages/ParentDashboard'))
const ParentProgress = React.lazy(() => import('./pages/parent/Progress'))
const ParentAttendance = React.lazy(() => import('./pages/parent/Attendance'))
const ParentNotices = React.lazy(() => import('./pages/parent/Notices'))
const ParentMessages = React.lazy(() => import('./pages/parent/Messages'))
const ParentProfile = React.lazy(() => import('./pages/parent/Profile'))
const ParentLinkStudent = React.lazy(() => import('./pages/parent/LinkStudent'))
const FacultyProfile = React.lazy(() => import('./pages/faculty/Profile'))
const StudentProfile = React.lazy(() => import('./pages/student/Profile'))
const ParentMeeting = React.lazy(() => import('./pages/parent/Meeting'))
const AdminNotices = React.lazy(() => import('./pages/admin/Notices'))
const AdminNotifications = React.lazy(() => import('./pages/admin/Notifications'))
const AdminNotificationSettings = React.lazy(() => import('./pages/admin/NotificationSettings'))
const FrontOffice = React.lazy(() => import('./pages/admin/FrontOffice'))
const AdmissionEnquiry = React.lazy(() => import('./pages/admin/AdmissionEnquiry'))
const OnlineAdmissions = React.lazy(() => import('./pages/admin/OnlineAdmissions'))
const OnlineAdmission = React.lazy(() => import('./pages/OnlineAdmission'))
const DiscountManagement = React.lazy(() => import('./pages/admin/DiscountManagement'))
const AdminForm = React.lazy(() => import('./pages/admin/Form'))
const AdminFormQueries = React.lazy(() => import('./pages/admin/FormQueries'))
const LibraryManagement = React.lazy(() => import('./pages/admin/LibraryManagement'))
const BehaviorRecordsAdmin = React.lazy(() => import('./pages/admin/BehaviorRecords'))
const ContactQueries = React.lazy(() => import('./pages/admin/ContactQueries'))
const AnalyticsStudentRank = React.lazy(() => import('./pages/admin/AnalyticsStudentRank'))
const Forms = React.lazy(() => import('./pages/Forms'))
const FacultyNotices = React.lazy(() => import('./pages/faculty/Notices'))
const FacultyTests = React.lazy(() => import('./pages/faculty/Tests'))
const FacultyTestResults = React.lazy(() => import('./pages/faculty/TestResults'))
const FacultyAttendanceSelf = React.lazy(() => import('./pages/faculty/AttendanceSelf'))
const AdminFacultyTimetable = React.lazy(() => import('./pages/admin/FacultyTimetable'))
const FacultyTimetable = React.lazy(() => import('./pages/faculty/FacultyTimetable'))
const AdminCertificates = React.lazy(() => import('./pages/admin/Certificates'))
const AdminAdmitCards = React.lazy(() => import('./pages/admin/AdmitCards'))
const AdminReportCard = React.lazy(() => import('./pages/admin/ReportCard'))
const FacultyCertificates = React.lazy(() => import('./pages/faculty/Certificates'))
const FacultyAdmitCards = React.lazy(() => import('./pages/faculty/AdmitCards'))
const FacultyReportCard = React.lazy(() => import('./pages/faculty/ReportCard'))
const GalleryAdmin = React.lazy(() => import('./pages/admin/Gallery'))
const StudentTransport = React.lazy(() => import('./pages/student/Transport'))
const StudentCertificates = React.lazy(() => import('./pages/student/Certificates'))
const StudentAdmitCards = React.lazy(() => import('./pages/student/AdmitCards'))
const StudentReportCard = React.lazy(() => import('./pages/student/ReportCard'))
const StudentMarks = React.lazy(() => import('./pages/student/Marks'))
const AdminSalary = React.lazy(() => import('./pages/AdminSalary'))
const AdminStaffSalary = React.lazy(() => import('./pages/AdminStaffSalary'))
const StaffSalary = React.lazy(() => import('./pages/StaffSalary'))
const FacultySalary = React.lazy(() => import('./pages/FacultySalary'))
const AdminCardManagement = React.lazy(() => import('./pages/admin/CardManagement'))
const StudentCard = React.lazy(() => import('./pages/student/Card'))
const StudentHostel = React.lazy(() => import('./pages/student/Hostel'))
const AdminStaff = React.lazy(() => import('./pages/admin/Staff'))
const AdminHr = React.lazy(() => import('./pages/admin/Hr'))
const AdminHostelManagement = React.lazy(() => import('./pages/admin/HostelManagement'))
const AdminHouseManagement = React.lazy(() => import('./pages/admin/HouseManagement'))
const AdminTransportManagement = React.lazy(() => import('./pages/admin/TransportManagement'))
const FacultyCard = React.lazy(() => import('./pages/faculty/Card'))
const FacultyHouseManagement = React.lazy(() => import('./pages/faculty/HouseManagement'))
const StaffLayout = React.lazy(() => import('./components/staff/StaffLayout'))
const StaffDashboard = React.lazy(() => import('./pages/staff/Dashboard'))
const StaffNotices = React.lazy(() => import('./pages/staff/Notices'))
const StaffMeeting = React.lazy(() => import('./pages/staff/Meeting'))
const StaffCard = React.lazy(() => import('./pages/staff/Card'))
const StaffProfile = React.lazy(() => import('./pages/staff/Profile'))
const StaffCalendar = React.lazy(() => import('./pages/StaffCalendar'))
const StaffAttendance = React.lazy(() => import('./pages/StaffAttendance'))
const StaffCertificates = React.lazy(() => import('./pages/staff/Certificates'))
const BehaviorRecordsFaculty = React.lazy(() => import('./pages/faculty/BehaviorRecords'))
const LessonPlan = React.lazy(() => import('./pages/faculty/LessonPlan'))

const AdminLogin = React.lazy(() => import('./pages/AdminLogin'))
const StaffLogin = React.lazy(() => import('./pages/StaffLogin'))
const AdminRegister = React.lazy(() => import('./pages/AdminRegister'))
const FacultyLogin = React.lazy(() => import('./pages/FacultyLogin'))
const FacultyRegister = React.lazy(() => import('./pages/FacultyRegister'))
const FacultyDashboard = React.lazy(() => import('./pages/FacultyDashboard'))
const AddMarks = React.lazy(() => import('./pages/faculty/AddMarks'))
const Attendance = React.lazy(() => import('./pages/faculty/Attendance'))
const Students = React.lazy(() => import('./pages/faculty/Students'))
const Assignments = React.lazy(() => import('./pages/faculty/Assignments'))
const Leaves = React.lazy(() => import('./pages/faculty/Leaves'))
const Resources = React.lazy(() => import('./pages/faculty/Resources'))
const FacultyMeeting = React.lazy(() => import('./pages/faculty/Meeting'))
const StudentLayout = React.lazy(() => import('./components/student/StudentLayout'))
const StudentDashboard = React.lazy(() => import('./pages/StudentDashboard'))
const StudentAttendance = React.lazy(() => import('./pages/student/Attendance'))
const StudentMeeting = React.lazy(() => import('./pages/student/Meeting'))
const StudentSyllabus = React.lazy(() => import('./pages/student/Syllabus'))
const StudentAssignments = React.lazy(() => import('./pages/student/Assignments'))
const StudentResources = React.lazy(() => import('./pages/student/Resources'))
const StudentTimetable = React.lazy(() => import('./pages/student/Timetable'))
const StudentResults = React.lazy(() => import('./pages/student/Results'))
const StudentTests = React.lazy(() => import('./pages/student/Tests'))
const StartTestScreen = React.lazy(() => import('./pages/student/StartTestScreen'))
const TakeTest = React.lazy(() => import('./pages/student/TakeTest'))
const StudentNotices = React.lazy(() => import('./pages/student/Notices'))
const StudentCalendar = React.lazy(() => import('./pages/student/Calendar'))
const StudentComplaint = React.lazy(() => import('./pages/student/Complaint'))
const StudentFees = React.lazy(() => import('./pages/student/Fees'))
const StudentParents = React.lazy(() => import('./pages/student/Parents'))
const StudentLogin = React.lazy(() => import('./pages/StudentLogin'))
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'))
const StudentRegister = React.lazy(() => import('./pages/StudentRegister'))
const ParentsLogin = React.lazy(() => import('./pages/ParentsLogin'))
const ParentsRegister = React.lazy(() => import('./pages/ParentsRegister'))
const Start = React.lazy(() => import('./pages/Start'))

function App() {
  // Listen for global logout events from other tabs
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'erp_logout') {
        window.location.href = '/start'
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Simple protected route helper inside App
  function Protected({ children, role }) {
    const { token, role: userRole } = getAuth()
    if (!token) return <Navigate to="/start" replace />
    if (role && userRole !== role) return <Navigate to="/start" replace />
    return children
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastContainer position="top-right" autoClose={3000} />
      <Suspense fallback={<div className="p-6 text-center text-gray-600">Loading...</div>}>
        <Routes>
        <Route path="/start" element={<Navigate to="/" replace />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        {/* Staff login */}
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/admin-register" element={<AdminRegister />} />
        <Route path="/faculty-login" element={<FacultyLogin />} />
        <Route path="/faculty-register" element={<FacultyRegister />} />

        <Route path="/faculty-dashboard" element={<Protected role="faculty"><FacultyDashboard /></Protected>} />
        <Route path="/faculty/add-marks" element={<Protected role="faculty"><AddMarks /></Protected>} />
        <Route path="/faculty/attendance" element={<Protected role="faculty"><Attendance /></Protected>} />
        <Route path="/faculty/attendance-self" element={<Protected role="faculty"><FacultyAttendanceSelf /></Protected>} />
        <Route path="/faculty/students" element={<Protected role="faculty"><Students /></Protected>} />
        <Route path="/faculty/assignments" element={<Protected role="faculty"><Assignments /></Protected>} />
        <Route path="/faculty/leaves" element={<Protected role="faculty"><Leaves /></Protected>} />
        <Route path="/faculty/resources" element={<Protected role="faculty"><Resources /></Protected>} />
        <Route path="/faculty/library" element={<Protected role="faculty"><Resources /></Protected>} />
        <Route path="/faculty/meeting" element={<Protected role="faculty"><FacultyMeeting /></Protected>} />
        <Route path="/faculty/salary" element={<Protected role="faculty"><FacultySalary /></Protected>} />
        <Route path="/faculty/card-management" element={<Protected role="faculty"><FacultyCard /></Protected>} />
        <Route path="/faculty/house-management" element={<Protected role="faculty"><FacultyHouseManagement /></Protected>} />

        <Route path="/faculty/faculty-timetable" element={<Protected role="faculty"><FacultyTimetable /></Protected>} />
        <Route path="/faculty/certificates" element={<Protected role="faculty"><FacultyCertificates /></Protected>} />
        <Route path="/faculty/admit-cards" element={<Protected role="faculty"><FacultyAdmitCards /></Protected>} />
        <Route path="/faculty/report-card" element={<Protected role="faculty"><FacultyReportCard /></Protected>} />
        {/* <Route path="/faculty/report-card" element={<Protected role="faculty"><FacultyReportCard /></Protected>} /> */}

        <Route path="/student-dashboard" element={<Protected role="student"><StudentLayout><StudentDashboard /></StudentLayout></Protected>} />
        <Route path="/student/attendance" element={<Protected role="student"><StudentLayout><StudentAttendance /></StudentLayout></Protected>} />
        <Route path="/student/meeting" element={<Protected role="student"><StudentLayout><StudentMeeting /></StudentLayout></Protected>} />
        <Route path="/student/syllabus" element={<Protected role="student"><StudentLayout><StudentSyllabus /></StudentLayout></Protected>} />
        <Route path="/student/assignments" element={<Protected role="student"><StudentLayout><StudentAssignments /></StudentLayout></Protected>} />
        <Route path="/student/resources" element={<Protected role="student"><StudentLayout><StudentResources /></StudentLayout></Protected>} />
        <Route path="/student/timetable" element={<Protected role="student"><StudentLayout><StudentTimetable /></StudentLayout></Protected>} />
        <Route path="/student/transport" element={<Protected role="student"><StudentLayout><StudentTransport /></StudentLayout></Protected>} />
        <Route path="/student/marks" element={<Protected role="student"><StudentLayout><StudentMarks /></StudentLayout></Protected>} />
        <Route path="/student/certificates" element={<Protected role="student"><StudentLayout><StudentCertificates /></StudentLayout></Protected>} />
        <Route path="/student/admit-cards" element={<Protected role="student"><StudentLayout><StudentAdmitCards /></StudentLayout></Protected>} />
        <Route path="/student/report-card" element={<Protected role="student"><StudentLayout><StudentReportCard /></StudentLayout></Protected>} />
        <Route path="/student/results" element={<Protected role="student"><StudentLayout><StudentResults /></StudentLayout></Protected>} />
        <Route path="/student/tests" element={<Protected role="student"><StudentLayout><StudentTests /></StudentLayout></Protected>} />
        <Route path="/student/test-results" element={<Navigate to="/student/results" replace />} />
        <Route path="/student/tests/:id/start" element={<Protected role="student"><StartTestScreen /></Protected>} />
        <Route path="/student/tests/:id" element={<Protected role="student"><StudentLayout><TakeTest /></StudentLayout></Protected>} />
        <Route path="/student/notices" element={<Protected role="student"><StudentLayout><StudentNotices /></StudentLayout></Protected>} />
        <Route path="/student/calendar" element={<Protected role="student"><StudentLayout><StudentCalendar /></StudentLayout></Protected>} />
        <Route path="/student/complaint" element={<Protected role="student"><StudentLayout><StudentComplaint /></StudentLayout></Protected>} />
        <Route path="/student/fees" element={<Protected role="student"><StudentLayout><StudentFees /></StudentLayout></Protected>} />
        <Route path="/student/hostel" element={<Protected role="student"><StudentLayout><StudentHostel /></StudentLayout></Protected>} />
        <Route path="/student/parents" element={<Protected role="student"><StudentLayout><StudentParents /></StudentLayout></Protected>} />
        <Route path="/student/card" element={<Protected role="student"><StudentLayout><StudentCard /></StudentLayout></Protected>} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/student-register" element={<StudentRegister />} />
        <Route path="/parents-login" element={<ParentsLogin />} />
        <Route path="/parents-register" element={<ParentsRegister />} />
        <Route path="/parent-dashboard" element={<Protected role="parent"><ParentDashboard /></Protected>} />
        <Route path="/parent/progress" element={<Protected role="parent"><ParentProgress /></Protected>} />
        <Route path="/parent/attendance" element={<Protected role="parent"><ParentAttendance /></Protected>} />
        <Route path="/parent/notices" element={<Protected role="parent"><ParentNotices /></Protected>} />
        <Route path="/parent/meeting" element={<Protected role="parent"><ParentMeeting /></Protected>} />
        <Route path="/parent/messages" element={<Protected role="parent"><ParentMessages /></Protected>} />
        <Route path="/parent/profile" element={<Protected role="parent"><ParentProfile /></Protected>} />
        <Route path="/parent/link-student" element={<Protected role="parent"><ParentLinkStudent /></Protected>} />
        {/* support plural legacy path */}
        <Route path="/parents-dashboard" element={<Navigate to="/parent-dashboard" replace />} />

        <Route path="/admin-dashboard" element={<Protected role="admin"><AdminPanel /></Protected>} />
        {/* legacy route support: redirect older /admin/dashboard to the new /admin-dashboard */}
        <Route path="/admin/dashboard" element={<Navigate to="/admin-dashboard" replace />} />
        <Route path="/admin/messages" element={<Protected role="admin"><AdminMessages /></Protected>} />
        {/* Staff routes - staff-only layout */}
        <Route path="/staff-dashboard" element={<Protected role="staff"><StaffDashboard /></Protected>} />
        <Route path="/staff/notices" element={<Protected role="staff"><StaffNotices /></Protected>} />
        <Route path="/staff/meeting" element={<Protected role="staff"><StaffMeeting /></Protected>} />
        <Route path="/staff/card" element={<Protected role="staff"><StaffCard /></Protected>} />
        <Route path="/staff/profile" element={<Protected role="staff"><StaffLayout><StaffProfile /></StaffLayout></Protected>} />
        <Route path="/staff/calendar" element={<Protected role="staff"><StaffCalendar /></Protected>} />
        <Route path="/staff/salary" element={<Protected role="staff"><StaffSalary /></Protected>} />
        <Route path="/staff/attendance" element={<Protected role="staff"><StaffAttendance /></Protected>} />
        <Route path="/staff/certificates" element={<Protected role="staff"><StaffLayout><StaffCertificates /></StaffLayout></Protected>} />
        <Route path="/admin/academics" element={<Protected role="admin"><Academics /></Protected>} />
        <Route path="/admin/notices" element={<Protected role="admin"><AdminNotices /></Protected>} />
        <Route path="/admin/form" element={<Protected role="admin"><AdminForm /></Protected>} />
        <Route path="/admin/form-queries" element={<Protected role="admin"><AdminFormQueries /></Protected>} />
        <Route path="/admin/contact-queries" element={<Protected role="admin"><ContactQueries /></Protected>} />
        <Route path="/admin/analytics-student-rank" element={<Protected role="admin"><AnalyticsStudentRank /></Protected>} />
        <Route path="/forms" element={<Forms />} />
        <Route path="/admin/faculty-timetable" element={<Protected role="admin"><AdminFacultyTimetable /></Protected>} />
        <Route path="/admin/certificates" element={<Protected role="admin"><AdminCertificates /></Protected>} />
        <Route path="/admin/admit-cards" element={<Protected role="admin"><AdminAdmitCards /></Protected>} />
        <Route path="/admin/report-card" element={<Protected role="admin"><AdminReportCard /></Protected>} />
        <Route path="/admin/gallery" element={<Protected role="admin"><GalleryAdmin /></Protected>} />
        <Route path="/admin/leaves/student" element={<Protected role="admin"><StudentLeaves /></Protected>} />
        <Route path="/admin/leaves/faculty" element={<Protected role="admin"><FacultyLeavesAdmin /></Protected>} />
        <Route path="/admin/leaves/staff" element={<Protected role="admin"><StaffLeavesAdmin /></Protected>} />
        <Route path="/admin/academics/syllabus" element={<Protected role="admin"><AcademicsSyllabus /></Protected>} />
        <Route path="/admin/academics/timetable" element={<Protected role="admin"><AcademicsTimetable /></Protected>} />
        <Route path="/admin/academics/results" element={<Protected role="admin"><AcademicsResults /></Protected>} />
        <Route path="/admin/finance" element={<Protected role="admin"><Finance /></Protected>} />
        <Route path="/admin/salary" element={<Protected role="admin"><AdminSalary /></Protected>} />
        <Route path="/admin/staff-salary" element={<Protected role="admin"><AdminStaffSalary /></Protected>} />
        <Route path="/admin/card-management" element={<Protected role="admin"><AdminCardManagement /></Protected>} />
        <Route path="/admin/meeting" element={<Protected role="admin"><Meeting /></Protected>} />
        <Route path="/admin/attendance/students" element={<Protected role="admin"><AdminStudentAttendance /></Protected>} />
        <Route path="/admin/attendance/faculty" element={<Protected role="admin"><AdminFacultyAttendance /></Protected>} />
        <Route path="/admin/attendance/staff" element={<Protected role="admin"><AdminStaffAttendance /></Protected>} />
        <Route path="/admin/tests" element={<Protected role="admin"><AdminTests /></Protected>} />
        <Route path="/admin/view-test-series" element={<Protected role="admin"><ViewTestSeries /></Protected>} />
        <Route path="/admin/test-results" element={<Protected role="admin"><AdminTestResults /></Protected>} />
        <Route path="/admin/complaints" element={<Protected role="admin"><Complaints /></Protected>} />
        <Route path="/admin/events" element={<Protected role="admin"><Events /></Protected>} />
        <Route path="/admin/profile" element={<Protected role="admin"><AdminProfile /></Protected>} />
        <Route path="/admin/students" element={<Protected role="admin"><AdminStudents /></Protected>} />
        {/* House/Hostel management */}
        <Route path="/admin/hostel-management" element={<Protected role="admin"><AdminHostelManagement /></Protected>} />
        <Route path="/admin/house-management" element={<Protected role="admin"><AdminHouseManagement /></Protected>} />
        <Route path="/admin/transport-management" element={<Protected role="admin"><AdminTransportManagement /></Protected>} />
        <Route path="/admin/staff" element={<Protected role="admin"><AdminStaff /></Protected>} />
        <Route path="/admin/hr" element={<Protected role="admin"><AdminHr /></Protected>} />
        <Route path="/admin/student-approvals" element={<Protected role="admin"><AdminStudentApprovals /></Protected>} />
        <Route path="/admin/faculty" element={<Protected role="admin"><AdminFaculty /></Protected>} />
        <Route path="/admin/parents" element={<Protected role="admin"><AdminParents /></Protected>} />
        <Route path="/admin/admins" element={<Protected role="admin"><AdminAdmins /></Protected>} />
        <Route path="/admin/approvals" element={<Protected role="admin"><AdminApprovals /></Protected>} />
        <Route path="/admin/requests" element={<Protected role="admin"><AdminDeleteRequests /></Protected>} />
        <Route path="/admin/library-management" element={<Protected role="admin"><LibraryManagement /></Protected>} />
        <Route path="/admin/behavior-records" element={<Protected role="admin"><BehaviorRecordsAdmin /></Protected>} />
        <Route path="/admin/notification-settings" element={<Protected role="admin"><AdminNotificationSettings /></Protected>} />

        <Route path="/faculty/profile" element={<Protected role="faculty"><FacultyProfile /></Protected>} />
        <Route path="/faculty/tests" element={<Protected role="faculty"><FacultyTests /></Protected>} />
        <Route path="/faculty/test-results" element={<Protected role="faculty"><FacultyTestResults /></Protected>} />


        <Route path="/student/profile" element={<Protected role="student"><StudentLayout><StudentProfile /></StudentLayout></Protected>} />

        <Route path="/" element={<Start />} />
        <Route path="/faculty/notices" element={<Protected role="faculty"><FacultyNotices /></Protected>} />
        <Route path="/faculty/behavior-records" element={<Protected role="faculty"><BehaviorRecordsFaculty /></Protected>} />
        <Route path="/faculty/lesson-plan" element={<Protected role="faculty"><LessonPlan /></Protected>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
