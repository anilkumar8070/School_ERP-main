# School ERP — Backend Component Documentation

Node.js and Express REST API server powering the School ERP platform. Features PostgreSQL data persistence via Prisma ORM, JWT authentication, role-based access control (RBAC), PDF document generation, file uploads, and administrative, academic, and financial modules.

---

## System Architecture

- **Runtime Environment**: Node.js (v18+)
- **Framework**: Express.js
- **Database & ORM**: PostgreSQL via Prisma ORM (`@prisma/client`)
- **Authentication**: JWT (JSON Web Tokens) with `bcryptjs` password hashing
- **File Storage**: Local uploads directory via `Multer`
- **Document Engine**: PDFKit / jsPDF for receipt, report card, certificate, and ID card generation
- **Logging & Security**: Morgan HTTP logging, Helmet security headers, Express Rate Limiting

---

## Environment Configuration

Copy `.env.example` to create the local `.env` file inside `backend/`:

```bash
cp .env.example .env
```

### Essential Environment Variables

| Variable | Required | Description | Default / Example |
| :--- | :---: | :--- | :--- |
| `PORT` | No | Server HTTP listening port | `4000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/school_erp?schema=public` |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens | `your-secure-jwt-secret-key` |
| `JWT_EXPIRES` | No | Token expiration timeframe | `24h` |
| `ALLOW_ALL_ORIGINS` | No | Permissive CORS mode for development | `true` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS allowed domains | `http://localhost:5173,http://localhost:3000` |
| `FRONTEND_URL` | No | Application URL used in email templates | `http://localhost:5173` |

Optional integrations for SMTP email, SendGrid, Resend, Razorpay, and Twilio can be configured in `.env` as needed.

---

## Database Setup & Migrations

1. Ensure PostgreSQL service is running locally on port `5432` (or configured host).
2. Push Prisma database schema to create or sync tables:

```bash
npx prisma db push
```

3. Seed initial admin users and test data into PostgreSQL:

```bash
node prisma/seed.js
```

4. Launch Prisma Studio visual database browser (optional):

```bash
npx prisma studio
```

---

## Running the Server

### Installation
```bash
npm install
```

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

---

## Core API Modules & Endpoints

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

## Security & Best Practices

- **Environment File Exclusions**: All secrets, credentials, and connection strings belong strictly in `.env`.
- **Role-Based Access Control**: Protected endpoints use `verifyToken` and `requireRole(['admin', 'faculty', 'student', 'parent'])`.
- **Prepared Statements**: All database operations leverage Prisma ORM parameterized queries to prevent SQL injection.
