# School ERP — Full-Stack Management System

A comprehensive, full-stack school management system featuring a **React 19 + Vite** frontend and a **Node.js + Express + Prisma PostgreSQL** backend.

---

## 🌟 Overview

The School ERP platform streamlines school administration, academic tracking, student performance, fee collection, notices, document generation, and parental oversight.

### Key Capabilities

- 🔐 **Multi-Role Authentication**: Role-based access control for Admins, Teachers, Students, Parents, and Office Staff.
- 👨‍🎓 **Student Management**: Admissions, enquiries, student directory, class/section assignments, and profile records.
- 👩‍🏫 **Faculty Management**: Teacher directory, subject allocations, experience tracking, and class assignment.
- 🏫 **Academic Management**: Class & subject configuration, timetables, syllabus uploading, assignments, and test series.
- 💳 **Finance & Fees**: Term-based fee structure configuration, Razorpay integration, online fee payments, and automated PDF receipt generation.
- 📜 **Documents & Certificates**: Generate official ID Cards, Admit Cards, Report Cards, and Leaving Certificates with PDF preview/download.
- 📢 **Communication**: Announcements, notice broadcasting, parent-teacher messaging, and event scheduling.

---

## 🏗 Repository Layout

- `backend/` — Express API server, Prisma PostgreSQL schema, JWT auth, routes, and PDF utilities.
- `frontend/` — React 19 single-page app with Vite, Tailwind CSS, React Query, and Framer Motion.
- `docker-compose.yaml` — Docker composition for local containerized deployment.
- `render.yaml` — Deployment settings for hosting on Render platform.

---

## 🚀 Quick Start Guide

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL Server (v14+ running on port `5432` locally or remote connection URL)

---

### 1. Backend Setup

```powershell
cd backend

# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Push database schema to PostgreSQL
npx prisma db push

# Seed initial test accounts and records
node prisma/seed.js

# Start backend server
npm run dev
```

The backend server runs at `http://localhost:4000`.

---

### 2. Frontend Setup

In a new terminal window:

```powershell
cd frontend

# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The frontend web application runs at `http://localhost:5173`.

---

## 🧪 Default Test Accounts (Development)

| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Full system administration & configuration |
| **Faculty / Teacher** | `teacher1` | `teacher123` | Gradebooks, attendance, assignments, test series |
| **Student** | `student1` | `student123` | View attendance, submit assignments, pay fees |
| **Parent** | `parent1` | `parent123` | Child progress tracking, fee receipts, notices |

---

## 🔒 Security & Environment Guidelines

- **No Secrets in Source Control**: All sensitive database connection strings, JWT secrets, and API keys reside strictly in `.env` files.
- `.env` files are ignored by `.gitignore` in both root and package subdirectories.
- Safe templates with placeholder values are provided in `.env.example`.
