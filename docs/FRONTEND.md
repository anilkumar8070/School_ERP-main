# School ERP — Frontend Component Documentation

Single-page web application built with React 19, Vite, and Tailwind CSS. Provides role-tailored dashboards and management workflows for Administrators, Teachers, Students, and Parents.

---

## Tech Stack

- **Core Framework**: React 19 and React DOM 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (v4) with utility components
- **Routing**: React Router DOM (v6)
- **State Management & Data Fetching**: TanStack React Query (v5) and Axios
- **Animations**: Framer Motion
- **UI Utilities**: React Icons, React Toastify, HTML2Canvas, jsPDF

---

## Environment Configuration

Copy `.env.example` to create the local `.env` file inside `frontend/`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Required | Description | Default / Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE` | Yes | Backend Express API base URL | `http://localhost:4000` |
| `VITE_RAZORPAY_KEY_ID` | No | Public Razorpay Checkout Key ID | `rzp_test_xxxxxx` |

---

## Getting Started

### 1. Installation
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

The application launches locally at `http://localhost:5173`.

### 3. Production Build
Compile static production assets into `dist/`:

```bash
npm run build
```

### 4. Preview Production Build
```bash
npm run preview
```

---

## Project Structure

```text
frontend/
├── public/              # Static assets and public files
├── src/
│   ├── api/             # API client services and Axios configuration
│   ├── components/      # Shared UI components, modals, navbars, sidebars
│   ├── context/         # AuthContext and React Query providers
│   ├── pages/           # Application views and dashboard pages
│   │   ├── admin/       # Administrator management views
│   │   ├── faculty/     # Teacher/Faculty dashboard and grading views
│   │   ├── student/     # Student portal, assignments, and fee views
│   │   └── parent/      # Parent monitoring dashboard and payments
│   ├── App.jsx          # Main application router definition
│   ├── index.css        # Global CSS and Tailwind imports
│   └── main.jsx         # Application entry point
├── package.json
└── vite.config.js       # Vite build and plugin settings
```

---

## Default Credentials (Development)

- **Admin**: `admin` / `admin123`
- **Teacher / Faculty**: `teacher1` / `teacher123`
- **Student**: `student1` / `student123`
- **Parent**: `parent1` / `parent123`
