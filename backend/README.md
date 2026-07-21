# School ERP Backend

A Node.js + Express API server for the School ERP application. The backend manages school data, authentication, authorization, file uploads, PDF generation, and integrations with MongoDB, email, SMS, and payment services.

## Technology Stack

- Node.js
- Express
- MongoDB + Mongoose
- JWT authentication
- Helmet security headers
- CORS and rate limiting
- File upload support with Multer
- PDF generation with PDFKit
- Email delivery with SendGrid / Nodemailer
- Payment integration with Razorpay
- Frontend support via static `dist` serving

## Features

- Secure login and role-based access control
- Student, faculty, and office staff management
- Attendance, assignments, marks, and academics
- Fee structures, receipts, and finance workflows
- Admission enquiries, online admission forms, and enquiries
- Notices, events, messages, and notifications
- Transport, hostel allocation, and ID cards
- Report cards, certificates, and document generation

## Environment Setup

Copy the example environment file:

```powershell
cd backend
copy .env.example .env
```

Update the `.env` values for your environment. Key variables:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — secret for signing JWT tokens
- `PORT` — server port (default: `4000`)
- `FRONTEND_DIST` — path to built frontend static assets
- `ALLOW_ALL_ORIGINS` — `true` to allow all origins in development
- `ALLOWED_ORIGINS` — comma-separated allowed browser origins
- `AUTO_SEED` — `true` to seed demo data when the database is empty
- `JSON_BODY_LIMIT` — request body size limit (default: `10mb`)
- `MAX_UPLOAD_BYTES` — maximum file upload size

Optional service integrations:

- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
- `SENDGRID_API_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`

## Installation

```powershell
cd backend
npm install
```

## Local Development

```powershell
npm run dev
```

The server listens on `http://localhost:4000` by default.

## Production Start

```powershell
npm start
```

## Testing

```powershell
npm test
```

## API Overview

The backend exposes REST endpoints under `/api/*`. Example endpoints include:

- `POST /api/login` — authenticate users and receive a JWT token
- `GET /api/profile` — return authenticated user details
- `GET /api/classes`, `POST /api/attendance`, `GET /api/fees`, etc.

> The backend loads many route modules, including admission, attendance, faculty, finance, forms, hostel, notices, reports, transport, and more.

## CORS and Frontend Integration

- Use `ALLOWED_ORIGINS` or `FRONTEND_URL` to restrict browser access.
- For local development, `ALLOW_ALL_ORIGINS=true` enables permissive mode.
- Set `FRONTEND_DIST` when serving a built frontend from the backend.

## Docker

This backend is designed to run with `docker-compose.yaml` in the repository root. It can also be deployed independently using the provided `Dockerfile`.

## Deployment Notes

- Ensure `NODE_ENV=production` in production.
- Set a strong `JWT_SECRET` and production-ready `MONGODB_URI`.
- Disable `ALLOW_ALL_ORIGINS` for production and configure `ALLOWED_ORIGINS` with your frontend URL(s).
- Keep demo credentials and seeded accounts out of production.

## Notes

This README documents the backend service. For full project context, see the repository root README at `../README.md`.
