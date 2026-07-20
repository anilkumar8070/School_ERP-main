# School ERP

A full-stack school management system built with a React + Vite frontend and a Node.js + Express backend.

This repository contains:

- `frontend/` — React application built with Vite, Tailwind CSS, React Router, and React Query.
- `backend/` — Express API server with MongoDB data persistence, JWT authentication, role-based access control, file upload support, PDF generation, notifications, and school management modules.
- `docker-compose.yaml` — local development composition for frontend, backend, and MongoDB.
- `render.yaml` — deployment configuration for Render.

## Key Features

- User authentication and role-based access control
- Student, faculty, and parent dashboards
- Attendance tracking and academic reports
- Fee management, receipts, and finance workflows
- Admissions, enquiries, and online admission forms
- Events, notices, messaging, and document generation
- File upload support for assignments, reports, and media

## Architecture

- Frontend: React + Vite + Tailwind
- Backend: Node.js + Express + MongoDB + Mongoose
- Local development: Docker Compose

## Getting Started

### Backend

1. Copy `backend/.env.example` to `backend/.env`.
2. Update the environment variables and provide a real `MONGODB_URI` and `JWT_SECRET`.
3. Install dependencies:

```powershell
cd backend
npm install
```

4. Start the backend server:

```powershell
npm run dev
```

### Frontend

1. Install dependencies:

```powershell
cd frontend
npm install
```

2. Start the frontend development server:

```powershell
npm run dev
```

### Full Local Stack with Docker

```powershell
docker-compose up --build
```

This starts the React frontend, backend API, and MongoDB container.

## Deployment

The repository includes `render.yaml` for deployment to Render. The backend is configured to serve a built frontend from a static `dist` directory when `FRONTEND_DIST` is provided.

## Project Layout

- `backend/` — API server, MongoDB models, routes, middleware, and utilities.
- `frontend/` — React application with app routes, UI components, and Tailwind styling.

## Notes

- Always replace demo credentials and secrets before production.
- For backend-specific documentation, see `backend/README.md`.
