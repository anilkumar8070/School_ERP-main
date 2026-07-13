const fs = require('fs')
const path = require('path')
const file = path.join(__dirname, 'src', 'App.jsx')
let code = fs.readFileSync(file, 'utf8')

const imports = `
import FrontOffice from './pages/admin/FrontOffice'
import AdmissionEnquiry from './pages/admin/AdmissionEnquiry'
import OnlineAdmissions from './pages/admin/OnlineAdmissions'
import OnlineAdmission from './pages/OnlineAdmission'
import DiscountManagement from './pages/admin/DiscountManagement'
`
code = code.replace("import AdminNotifications from './pages/admin/Notifications'", "import AdminNotifications from './pages/admin/Notifications'\n" + imports)

const publicRoute = `
        <Route path="/online-admission" element={<OnlineAdmission />} />
`
code = code.replace('<Route path="/parent/link-student" element={<Protected role="parent"><ParentLinkStudent /></Protected>} />', '<Route path="/parent/link-student" element={<Protected role="parent"><ParentLinkStudent /></Protected>} />' + publicRoute)

const adminRoutes = `
        <Route path="/admin/front-office" element={<Protected role="admin"><FrontOffice /></Protected>} />
        <Route path="/admin/admission-enquiry" element={<Protected role="admin"><AdmissionEnquiry /></Protected>} />
        <Route path="/admin/online-admissions" element={<Protected role="admin"><OnlineAdmissions /></Protected>} />
        <Route path="/admin/discount-management" element={<Protected role="admin"><DiscountManagement /></Protected>} />
`
code = code.replace('<Route path="/admin/notifications" element={<Protected role="admin"><AdminNotifications /></Protected>} />', '<Route path="/admin/notifications" element={<Protected role="admin"><AdminNotifications /></Protected>} />\n' + adminRoutes)

fs.writeFileSync(file, code)
console.log('App.jsx patched successfully')
