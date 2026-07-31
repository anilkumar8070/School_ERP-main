# School ERP — Full-Stack Management System

School ERP is a comprehensive, full-stack school management system designed to streamline institutional administration, academic tracking, student lifecycle records, fee collection, document generation, and parental communication. The platform consists of a Node.js Express REST API backend backed by PostgreSQL via Prisma ORM, and a single-page web application frontend built with React 19 and Vite.

---

## Tech Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (v4.18.2)
- **Database & ORM**: PostgreSQL (v14+) with Prisma ORM (`@prisma/client` v5.22.0)
- **Authentication**: JWT (`jsonwebtoken`) and password hashing via `bcryptjs`
- **Middleware & Security**: Helmet (`helmet`), CORS (`cors`), Morgan (`morgan`), Rate Limiting (`express-rate-limit`)
- **Document Engine**: PDFKit (`pdfkit`), jsPDF (`jspdf`)
- **File Handling**: Multer (`multer`)
- **Integrations**: Nodemailer (`nodemailer`), Resend (`resend`), SendGrid (`@sendgrid/mail`), Razorpay (`razorpay`), Twilio (`twilio`)

### Frontend
- **Framework**: React 19 (`react`, `react-dom` v19.2.0)
- **Build Tool**: Vite (`vite` v7.2.4)
- **Routing**: React Router DOM (`react-router-dom` v6.30.2)
- **Styling**: Tailwind CSS (`tailwindcss` v4.1.17, `@tailwindcss/vite`)
- **State Management & Data Fetching**: TanStack React Query (`@tanstack/react-query` v5.90.12), Axios (`axios` v1.18.1)
- **Animations**: Framer Motion (`framer-motion` v12.23.26)
- **UI Utilities**: React Icons (`react-icons`), React Toastify (`react-toastify`), HTML2Canvas (`html2canvas`), jsPDF (`jspdf`)

### Infrastructure & Tooling
- **Containerization**: Docker, `docker-compose.yaml` (PostgreSQL 16 Alpine, Express Backend, Nginx Frontend)
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`)
- **Deployment Descriptor**: Render (`render.yaml`)

---

## Folder Structure

```text
School_ERP/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI pipeline configuration
├── backend/
│   ├── middleware/            # JWT verification & RBAC authorization middleware
│   ├── prisma/
│   │   ├── schema.prisma      # Prisma database schema definition (53 models)
│   │   └── seed.js            # Initial database seed script
│   ├── routes/                # 57 modular API route controllers
│   ├── scripts/               # Maintenance, migration, and utility scripts
│   ├── uploads/               # Local file storage for uploads and documents
│   ├── utils/                 # Email, caching, and text similarity utilities
│   ├── index.js               # Backend Express application entry point
│   ├── mongoose_to_prisma.js  # Prisma compatibility adapter layer
│   ├── package.json           # Backend dependency manifest
│   └── Dockerfile             # Container definition for backend service
├── docs/
│   ├── BACKEND.md             # Backend component documentation
│   ├── BACKEND_BUGS.md        # Technical log of database migration bug fixes
│   ├── CI.md                  # Continuous integration architecture guide
│   ├── FRONTEND.md            # Frontend component documentation
│   └── PROJECT_AUDIT.md       # End-to-end system audit and verification report
├── frontend/
│   ├── public/                # Static public web assets
│   ├── src/
│   │   ├── api/               # Axios client instance and API call services
│   │   ├── components/        # Reusable UI components, navbars, sidebars, modals
│   │   ├── context/           # AuthContext and query client providers
│   │   ├── pages/             # Admin, Faculty, Student, and Parent dashboard views
│   │   ├── App.jsx            # React application route table
│   │   ├── index.css        # Global styles and Tailwind CSS directives
│   │   └── main.jsx           # React application mounting point
│   ├── package.json           # Frontend dependency manifest
│   ├── vite.config.js         # Vite build configuration
│   ├── nginx.conf             # Nginx web server configuration for Docker
│   └── Dockerfile             # Multi-stage Dockerfile for frontend service
├── docker-compose.yaml        # Local multi-container deployment stack
├── render.yaml                # Render platform deployment configuration
└── README.md                  # Project documentation entry point
```

---

## Backend Architecture

The backend API is implemented as an Express application in [backend/index.js](file:///d:/Projects/School_ERP-main/backend/index.js).

1. **Security & Middleware**:
   - HTTP security headers provided by `helmet`.
   - Request logging via `morgan`.
   - Rate limiting applied via `express-rate-limit` (30 requests/15m for `/api/login`, 300 requests/15m for general API endpoints).
   - Dynamic CORS handling supporting strict domain whitelists (`ALLOWED_ORIGINS`) and permissive development access (`ALLOW_ALL_ORIGINS`).
2. **Compatibility Adapter Layer**:
   - Outgoing JSON responses pass through a middleware layer that maps Prisma `id` fields to `_id` to maintain backwards compatibility with legacy frontend data structures.
3. **Modular Controller Routing**:
   - Endpoint logic is divided into 57 individual route controllers inside `backend/routes/`.
   - Shared dependencies (Prisma client instance, mailer utilities, notification handlers) are injected into route factories at initialization.
4. **Document Generation Engine**:
   - On-demand PDF rendering utilizing `pdfkit` for Admit Cards, Receipts, Report Cards, Certificates, and Student ID Cards.
5. **Static File Delivery**:
   - Uploaded student assignments, documents, and generated PDFs are stored in `backend/uploads/` and served under the `/uploads` static route.

---

## Frontend Architecture

The frontend is a single-page application built on React 19, structured around role-based workflows and client-side data caching.

1. **Authentication Context**:
   - `AuthContext` manages token storage in `localStorage`, decodes role privileges (`admin`, `faculty`, `student`, `parent`, `office`), and maintains authentication state across page reloads.
2. **Routing & Guarding**:
   - `App.jsx` defines application routes, wrapping protected views in role authorization checks. Unauthenticated users are redirected to `/login`.
3. **Data Fetching & Cache Management**:
   - TanStack React Query manages network request caching, background refetching, and query invalidation.
   - Axios client in `src/api` injects the `Authorization: Bearer <token>` header into outgoing API requests automatically.
4. **Dashboard Views**:
   - Role-specific dashboard views located in `src/pages/` provide interfaces for managing students, faculty, fee structures, notices, attendance, marks, homework, and reports.

---

## API Flow

The typical request-response cycle follows this workflow:

```text
[Client Web App] 
       │
       ▼  HTTP Request with 'Authorization: Bearer <JWT>'
[CORS & Helmet Middleware]
       │
       ▼
[Rate Limiter (express-rate-limit)]
       │
       ▼
[Authentication Guard (verifyToken)]
       │
       ▼
[Role Guard (requireRole)]
       │
       ▼
[Route Controller (backend/routes/*)]
       │
       ▼  Prisma Query
[PostgreSQL Database (school_erp)]
       │
       ▼  Result Set
[JSON Interceptor (_id compatibility mapping)]
       │
       ▼  HTTP 200 Response JSON
[Client UI Rendering / TanStack Query Cache]
```

---

## Database and ORM Details

- **Database Engine**: PostgreSQL (v14+ local / v16 Alpine in Docker and CI)
- **Database Name**: `school_erp`
- **ORM Engine**: Prisma ORM (`@prisma/client` v5.22.0)
- **Schema Definition**: [backend/prisma/schema.prisma](file:///d:/Projects/School_ERP-main/backend/prisma/schema.prisma)
- **Database Models**: 53 Prisma models defining users, students, faculty, classes, subjects, attendance, fee schedules, payments, notices, events, hostel allocations, transport routes, and test marks.

### Database Commands

Execute commands from the `backend/` directory:

- Generate Prisma Client:
  ```bash
  npx prisma generate
  ```
- Apply Schema Migrations to Database:
  ```bash
  npx prisma db push
  ```
- Seed Initial Database Records:
  ```bash
  node prisma/seed.js
  ```
- Launch Prisma Studio Visual Database Browser:
  ```bash
  npx prisma studio
  ```

---

## Authentication and Authorization

### Authentication Mechanism
- User login is handled via `POST /api/login`.
- Upon successful authentication with `username` (or `email`) and `password`, the server returns a signed JSON Web Token (JWT).
- Passwords are verified against stored hashes generated with `bcryptjs`.

### Authorization Roles
The system enforces Role-Based Access Control (RBAC) across five roles:

| Role | Permitted Actions |
| :--- | :--- |
| **Admin** | Full system control: user management, fee structures, class definitions, system settings. |
| **Faculty / Teacher** | Academic management: gradebooks, student attendance, homework assignments, test creation. |
| **Student** | Self-service portal: view attendance, submit assignments, pay fees, download documents. |
| **Parent** | Guardian access: track student progress, inspect payment receipts, read school notices. |
| **Office Staff** | Front-office tasks: admission enquiries, visitor logs, basic directory lookups. |

Role access is enforced via `verifyToken` and `requireRole` middleware located in [backend/middleware/auth.js](file:///d:/Projects/School_ERP-main/backend/middleware/auth.js).

---

## Email Integration

- **Mail Engine**: Nodemailer (`nodemailer`) configured with SMTP transport.
- **Mailer Location**: [backend/utils/mailer.js](file:///d:/Projects/School_ERP-main/backend/utils/mailer.js).
- **Supported Providers**: Resend SMTP (`smtp.resend.com`), Resend API (`resend`), SendGrid (`@sendgrid/mail`), or standard SMTP servers.
- **Operational Use Cases**: Password resets, admission enquiry receipts, notice distribution, and payment receipts.
- **Configuration Variables**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `RESEND_API_KEY`, `FROM_EMAIL`, `REPLY_TO`.

---

## Environment Variables

### Backend Configuration (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and update values.

| Variable | Required | Description | Default / Example |
| :--- | :---: | :--- | :--- |
| `PORT` | No | Express server HTTP listening port | `4000` |
| `NODE_ENV` | No | Application environment (`development`, `production`, `test`) | `development` |
| `DATABASE_URL` | Yes | PostgreSQL connection URL | `postgresql://postgres:postgres@localhost:5432/school_erp?schema=public` |
| `JWT_SECRET` | Yes | Secret key for signing JWT tokens | `your-super-secret-jwt-key-here` |
| `JWT_EXPIRES` | No | Token expiration duration | `24h` |
| `ALLOW_ALL_ORIGINS` | No | Allow all origins in CORS (development mode) | `true` |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed origins for CORS | `http://localhost:5173,http://localhost:3000` |
| `FRONTEND_URL` | No | Primary frontend URL used in email templates | `http://localhost:5173` |
| `FRONTEND_DIST` | No | Path to compiled frontend assets for production Express serving | `../frontend/dist` |
| `JSON_BODY_LIMIT` | No | Maximum allowed JSON request payload size | `10mb` |
| `MAX_UPLOAD_BYTES` | No | Maximum allowed file upload size in bytes | `1073741824` (1GB) |
| `SMTP_HOST` | No | SMTP server hostname | `smtp.resend.com` |
| `SMTP_PORT` | No | SMTP server port | `465` |
| `SMTP_SECURE` | No | Enable SSL/TLS for SMTP connection (`true`/`false`) | `true` |
| `SMTP_USER` | No | SMTP authentication username | `resend` |
| `SMTP_PASS` | No | SMTP authentication password or API key | `re_your_resend_api_key` |
| `RESEND_API_KEY` | No | Resend API key | `re_your_resend_api_key` |
| `RAZORPAY_KEY_ID` | No | Razorpay payment gateway key ID | `your_razorpay_key_id` |
| `RAZORPAY_KEY_SECRET` | No | Razorpay payment gateway secret key | `your_razorpay_key_secret` |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID for SMS integration | `your_twilio_account_sid` |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token for SMS integration | `your_twilio_auth_token` |
| `TWILIO_PHONE_NUMBER` | No | Twilio originating phone number | `+15005550006` |

### Frontend Configuration (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env`.

| Variable | Required | Description | Default / Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE` | Yes | Express backend API base URL | `http://localhost:4000` |
| `VITE_RAZORPAY_KEY_ID` | No | Public Razorpay key ID for client checkout | `rzp_test_xxxxxx` |

---

## Setup Instructions

### Prerequisites
- Node.js (v18.0.0 or higher)
- PostgreSQL Server (v14 or higher running on port `5432` locally or accessible remotely)
- Git

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the environment file template:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and set `DATABASE_URL` and `JWT_SECRET`.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Apply database schema to PostgreSQL:
   ```bash
   npx prisma db push
   ```
6. Seed database with initial users and records:
   ```bash
   node prisma/seed.js
   ```

### Frontend Setup
1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Copy the environment file template:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

---

## Development Commands

### Backend Commands (`backend/`)
- `npm run dev`: Launch Express backend with Nodemon hot reload on port `4000`.
- `npm run start`: Launch Express backend in standard Node mode.
- `npm run prisma:generate`: Re-generate Prisma Client bindings.
- `npm run prisma:db-push`: Push Prisma schema definitions directly to PostgreSQL.
- `npm run prisma:seed`: Execute initial database seed script.
- `npm test`: Run backend test suite with Jest.
- `npm run migrate:set-medium`: Execute student medium field migration script.

### Frontend Commands (`frontend/`)
- `npm run dev`: Launch Vite local development server on port `5173`.
- `npm run build`: Compile production static assets into `frontend/dist/`.
- `npm run lint`: Execute ESLint code quality verification.
- `npm run preview`: Preview compiled production assets locally.

---

## Development Accounts

| Role | Username | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Complete administrative system control |
| **Faculty / Teacher** | `teacher1` | `teacher123` | Class management, attendance, grading, homework |
| **Student** | `student1` | `student123` | Attendance viewing, submission uploads, fee payments |
| **Parent** | `parent1` | `parent123` | Child progress tracking, receipts, notices |

---

## Build and Run Instructions

### Manual Execution (Development)

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

- Access Frontend Application: `http://localhost:5173`
- Access Backend API Health Endpoint: `http://localhost:4000/api/health`

### Containerized Execution (Docker Compose)

To build and run all services (PostgreSQL 16 Alpine, Backend, Nginx Frontend) in Docker:

```bash
docker-compose up --build
```

- Frontend Web Application: `http://localhost:3000`
- Backend API Service: `http://localhost:4000`
- PostgreSQL Database: `localhost:5432`

To stop container stack:
```bash
docker-compose down
```

---

## Testing Instructions

### Backend Unit and Integration Testing
Run Jest test runner inside `backend/`:

```bash
cd backend
npm test
```

### Frontend Verification and Code Quality
Run ESLint check and build verification inside `frontend/`:

```bash
cd frontend
npm run lint
npm run build
```

### End-to-End Module Verification
Run the complete CRUD verification test suite script:

```bash
cd backend
node scratch/test_all_crud_modules.js
```

---

## Deployment Notes

### Container Deployment
- Production Dockerfiles provided in `backend/Dockerfile` and `frontend/Dockerfile`.
- `frontend/Dockerfile` utilizes multi-stage building to package static Vite assets into an `nginx:alpine` runtime image using `frontend/nginx.conf`.

### Render Deployment
- Services configured via `render.yaml`.
- The root build command compiles frontend assets into `frontend/dist/` and installs backend dependencies, allowing Express to serve static frontend assets directly when `FRONTEND_DIST` is configured.
- Ensure environment variables `DATABASE_URL` and `JWT_SECRET` are configured in the Render service settings dashboard.

---

## CI/CD Notes

- **Workflow File**: [.github/workflows/ci.yml](file:///d:/Projects/School_ERP-main/.github/workflows/ci.yml)
- **Detailed Documentation**: [docs/CI.md](file:///d:/Projects/School_ERP-main/docs/CI.md)
- **Triggers**: Automated pipeline runs on push to `main` or `develop` branches, and on all pull requests.
- **Concurrency Control**: Automatically cancels older in-progress pipeline runs on the same reference.
- **Pipeline Jobs**:
  1. `backend-ci`: Spins up PostgreSQL 16 Alpine container, installs dependencies via `npm ci`, generates Prisma client, applies migrations (`prisma db push`), runs seeds, executes Jest test suite with coverage collection, runs high-severity security audit (`npm audit`), and uploads test coverage artifacts.
  2. `frontend-ci`: Installs dependencies via `npm ci`, runs ESLint checks (`npm run lint`), verifies Vite build (`npm run build`), executes security audit, and uploads `dist/` build artifacts.

---

## Troubleshooting

### 1. Database Connection Error (`P1001: Can't reach database server`)
- **Cause**: PostgreSQL service is stopped or `DATABASE_URL` connection parameters in `backend/.env` are incorrect.
- **Solution**: Confirm PostgreSQL service is active on port `5432` and check credentials in `DATABASE_URL`.

### 2. JWT Authentication Error (401 Unauthorized / 403 Forbidden)
- **Cause**: Missing `JWT_SECRET` or expired session token.
- **Solution**: Ensure `JWT_SECRET` is populated in `backend/.env` and re-authenticate at `POST /api/login` to obtain a new token.

### 3. CORS Network Block
- **Cause**: Frontend origin is not listed in `ALLOWED_ORIGINS`.
- **Solution**: Set `ALLOW_ALL_ORIGINS=true` in `backend/.env` for local development, or add frontend URL to `ALLOWED_ORIGINS`.

### 4. Frontend API Connection Failure
- **Cause**: `VITE_API_BASE` in `frontend/.env` is incorrect or missing.
- **Solution**: Set `VITE_API_BASE=http://localhost:4000` in `frontend/.env` and restart Vite server (`npm run dev`).

### 5. Prisma Client Out of Sync Error
- **Cause**: Changes made to `backend/prisma/schema.prisma` without client regeneration.
- **Solution**: Run `npx prisma generate` inside `backend/`.

---

## Contribution Guidelines

- **Code Quality**: Ensure all code follows clean ES6+ JavaScript standards. Run `npm run lint` in `frontend/` prior to submitting changes.
- **Secrets Management**: Never commit `.env` files, production tokens, JWT secrets, or database credentials to version control.
- **Git Branching**: Branch off `develop` for feature work. Create pull requests targeting `develop` or `main`.
- **Pre-Merge Verification Checklist**:
  - Backend tests pass: `npm test` inside `backend/`.
  - Frontend linting passes: `npm run lint` inside `frontend/`.
  - Frontend build completes cleanly: `npm run build` inside `frontend/`.
  - Prisma schema changes include corresponding seed updates or migration scripts.
