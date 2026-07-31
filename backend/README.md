# School ERP — Backend API Service

A robust, enterprise-ready **Node.js + Express** REST API server powering the School ERP platform. It features full **PostgreSQL data persistence via Prisma ORM**, JWT authentication, role-based access control (RBAC), PDF document generation, file uploads, and comprehensive administrative, academic, and financial modules.

---

## 🚀 System Architecture

- **Runtime Environment**: Node.js (v18+)
- **Framework**: Express.js
- **Database & ORM**: PostgreSQL via Prisma ORM (`@prisma/client`)
- **Authentication**: JWT (JSON Web Tokens) with `bcryptjs` password hashing
- **File Storage**: Local uploads directory via `Multer`
- **Document Engine**: PDFKit / jsPDF for automated receipt & report card generation
- **Logging & Security**: Morgan HTTP logging, Helmet security headers, Express Rate Limiting

---

## ⚙️ Environment Configuration

Copy `.env.example` to create your local `.env` file:

```powershell
cp .env.example .env
```

### Essential Environment Variables

| Variable | Required | Description | Default / Example |
| :--- | :---: | :--- | :--- |
| `PORT` | No | Server HTTP listening port | `4000` |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/school_erp?schema=public` |
| `JWT_SECRET` | **Yes** | Secret key for signing JWT tokens | `your-secure-jwt-secret-key` |
| `JWT_EXPIRES` | No | Token expiration timeframe | `24h` |
| `ALLOW_ALL_ORIGINS` | No | Permissive CORS mode for development | `true` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS allowed domains | `http://localhost:5173,http://localhost:3000` |
| `FRONTEND_URL` | No | Application URL used in email templates | `http://localhost:5173` |

*(Optional integrations for SMTP email, SendGrid, Razorpay, and Twilio can be configured in `.env` as needed).*

---

## 🗄️ Database Setup & Migrations

1. Ensure PostgreSQL service is running locally on port `5432` (or configured host).
2. Push Prisma database schema to create/sync tables:

```powershell
npx prisma db push
```

3. Seed initial admin users and test data into PostgreSQL:

```powershell
node prisma/seed.js
```

4. *(Optional)* Launch Prisma Studio visual database browser:

```powershell
npx prisma studio
```

---

## 💻 Running the Server

### Installation
```powershell
npm install
```

### Development Mode (Nodemon Hot Reload)
```powershell
npm run dev
```

### Production Mode
```powershell
npm start
```

---

## 🔑 Core API Modules & Endpoints

| Category | Route | Auth / Role | Operations |
| :--- | :--- | :---: | :--- |
| **Auth** | `/api/login` | Public | User authentication & JWT issuance |
| **Auth** | `/api/profile` | Authenticated | Token verification & user profile fetch |
| **Students** | `/api/students` | Admin / Faculty | CRUD operations for student records |
| **Faculty** | `/api/faculty` | Admin | CRUD operations for faculty/staff records |
| **Classes** | `/api/classes` | Admin | Manage classes and subject assignments |
| **Finance** | `/api/finance/fee-structure` | Admin | Define term fee structures by class |
| **Notices** | `/api/notices` | Authenticated | School announcements & broadcast notices |
| **Events** | `/api/events` | Authenticated | Calendar events & school activities |
| **Admissions** | `/api/admission-enquiry` | Admin | Manage incoming admission enquiries |
| **Certificates** | `/api/certificates` | Admin | Generate and retrieve student certificates |
| **ID Cards** | `/api/idcards` | Admin | Issue & verify student/faculty ID cards |

---

## 🛡️ Security & Best Practices

- **Never commit `.env` files**: All secrets, credentials, and connection strings belong strictly in `.env`.
- **Role-Based Guards**: Protected endpoints use `verifyToken` and `requireRole(['admin', 'faculty', 'student', 'parent'])`.
- **Prepared Statements**: All database operations leverage Prisma ORM's parameterized queries to prevent SQL injection.
