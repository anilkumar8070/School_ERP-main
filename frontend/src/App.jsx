import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { getAuth } from './utils/session'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Dashboard from './pages/Dashboard'
import Start from './pages/Start'
import AdminLogin from './pages/AdminLogin'
import StaffLogin from './pages/StaffLogin'
import AdminRegister from './pages/AdminRegister'
import FacultyLogin from './pages/FacultyLogin'
import FacultyRegister from './pages/FacultyRegister'
import StudentLogin from './pages/StudentLogin'
import StudentRegister from './pages/StudentRegister'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ParentsLogin from './pages/ParentsLogin'
import ParentsRegister from './pages/ParentsRegister'
import FacultyDashboard from './pages/FacultyDashboard'
import StudentDashboard from './pages/StudentDashboard'
import StudentMeeting from './pages/student/Meeting'
import AddMarks from './pages/faculty/AddMarks'
import Attendance from './pages/faculty/Attendance'
import Students from './pages/faculty/Students'
import Assignments from './pages/faculty/Assignments'
import Leaves from './pages/faculty/Leaves'
import Resources from './pages/faculty/Resources'
import FacultyMeeting from './pages/faculty/Meeting'
import StudentAttendance from './pages/student/Attendance'
import StudentSyllabus from './pages/student/Syllabus'
import StudentAssignments from './pages/student/Assignments'
import StudentTimetable from './pages/student/Timetable'
import StudentResults from './pages/student/Results'
import StudentTests from './pages/student/Tests'
import TakeTest from './pages/student/TakeTest'
import StartTestScreen from './pages/student/StartTestScreen'
import StudentResources from './pages/student/Resources'
import StudentNotices from './pages/student/Notices'
import StudentCalendar from './pages/student/Calendar'
import StudentComplaint from './pages/student/ComplaintFixed'
import StudentFees from './pages/student/Fees'
import StudentParents from './pages/student/Parents'
import StudentLayout from './components/student/StudentLayout'
import AdminPanel from './pages/AdminPanel'
import AdminMessages from './pages/AdminMessages'
import Academics from './pages/Academics'
import AcademicsSyllabus from './pages/AcademicsSyllabus'
import AcademicsTimetable from './pages/AcademicsTimetable'
import AcademicsResults from './pages/AcademicsResults'
import Finance from './pages/admin/Finance'
import Meeting from './pages/Meeting'
import Complaints from './pages/Complaints'
import Events from './pages/Events'
import AdminProfile from './pages/AdminProfile'
import AdminStudents from './pages/admin/Students'
import AdminFaculty from './pages/admin/Faculty'
import AdminAdmins from './pages/admin/Admins'
import AdminParents from './pages/admin/Parents'
import AdminApprovals from './pages/admin/Approvals'
import AdminDeleteRequests from './pages/admin/DeleteRequests'
import AdminStudentApprovals from './pages/admin/StudentApprovals'
import StudentLeaves from './pages/admin/StudentLeaves'
import FacultyLeavesAdmin from './pages/admin/FacultyLeaves'
import AdminTests from './pages/admin/Tests'
import ViewTestSeries from './pages/admin/ViewTestSeries'
import AdminTestResults from './pages/admin/TestResults'
import AdminStudentAttendance from './pages/admin/StudentAttendance'
import AdminFacultyAttendance from './pages/admin/FacultyAttendance'
import AdminStaffAttendance from './pages/admin/StaffAttendance'
import StaffLeavesAdmin from './pages/admin/StaffLeaves'
import ParentDashboard from './pages/ParentDashboard'
import ParentProgress from './pages/parent/Progress'
import ParentAttendance from './pages/parent/Attendance'
import ParentNotices from './pages/parent/Notices'
import ParentMessages from './pages/parent/Messages'
import ParentProfile from './pages/parent/Profile'
import ParentLinkStudent from './pages/parent/LinkStudent'
import FacultyProfile from './pages/faculty/Profile'
import StudentProfile from './pages/student/Profile'
import ParentMeeting from './pages/parent/Meeting'
import AdminNotices from './pages/admin/Notices'
import AdminNotifications from './pages/admin/Notifications'
import AdminNotificationSettings from './pages/admin/NotificationSettings'
import FrontOffice from './pages/admin/FrontOffice'
import AdmissionEnquiry from './pages/admin/AdmissionEnquiry'
import OnlineAdmissions from './pages/admin/OnlineAdmissions'
import OnlineAdmission from './pages/OnlineAdmission'
import DiscountManagement from './pages/admin/DiscountManagement'
import AdminForm from './pages/admin/Form'
import AdminFormQueries from './pages/admin/FormQueries'
import LibraryManagement from './pages/admin/LibraryManagement'
import BehaviorRecordsAdmin from './pages/admin/BehaviorRecords'
import ContactQueries from './pages/admin/ContactQueries'
import AnalyticsStudentRank from './pages/admin/AnalyticsStudentRank'
import Forms from './pages/Forms'
import FacultyNotices from './pages/faculty/Notices'
import FacultyTests from './pages/faculty/Tests'
import FacultyTestResults from './pages/faculty/TestResults'
import FacultyAttendanceSelf from './pages/faculty/AttendanceSelf'
import AdminFacultyTimetable from './pages/admin/FacultyTimetable'
import FacultyTimetable from './pages/faculty/FacultyTimetable'
import AdminCertificates from './pages/admin/Certificates'
import AdminAdmitCards from './pages/admin/AdmitCards'
import AdminReportCard from './pages/admin/ReportCard'
import FacultyCertificates from './pages/faculty/Certificates'
import FacultyAdmitCards from './pages/faculty/AdmitCards'
import FacultyReportCard from './pages/faculty/ReportCard'
import GalleryAdmin from './pages/admin/Gallery'
import StudentTransport from './pages/student/Transport'
import StudentCertificates from './pages/student/Certificates'
import StudentAdmitCards from './pages/student/AdmitCards'
import StudentReportCard from './pages/student/ReportCard'
import StudentMarks from './pages/student/Marks'
import AdminSalary from './pages/AdminSalary'
import AdminStaffSalary from './pages/AdminStaffSalary'
import StaffSalary from './pages/StaffSalary'
import FacultySalary from './pages/FacultySalary'
import AdminCardManagement from './pages/admin/CardManagement'
import StudentCard from './pages/student/Card'
import StudentHostel from './pages/student/Hostel'
import AdminStaff from './pages/admin/Staff'
import AdminHr from './pages/admin/Hr'
import AdminHostelManagement from './pages/admin/HostelManagement'
import AdminHouseManagement from './pages/admin/HouseManagement'
import AdminTransportManagement from './pages/admin/TransportManagement'
import FacultyCard from './pages/faculty/Card'
import FacultyHouseManagement from './pages/faculty/HouseManagement'
import StaffLayout from './components/staff/StaffLayout'
import StaffDashboard from './pages/staff/Dashboard'
import StaffNotices from './pages/staff/Notices'
import StaffMeeting from './pages/staff/Meeting'
import StaffCard from './pages/staff/Card'
import StaffProfile from './pages/staff/Profile'
import StaffCalendar from './pages/StaffCalendar'
import StaffAttendance from './pages/StaffAttendance'
import StaffCertificates from './pages/staff/Certificates'
import BehaviorRecordsFaculty from './pages/faculty/BehaviorRecords'
import LessonPlan from './pages/faculty/LessonPlan'

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
      <Routes>
        <Route path="/start" element={<Start />} />
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

        <Route path="/" element={<Dashboard />} />
        <Route path="/faculty/notices" element={<Protected role="faculty"><FacultyNotices /></Protected>} />
        <Route path="/faculty/behavior-records" element={<Protected role="faculty"><BehaviorRecordsFaculty /></Protected>} />
        <Route path="/faculty/lesson-plan" element={<Protected role="faculty"><LessonPlan /></Protected>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
