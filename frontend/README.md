# School ERP — Frontend Web Application

A modern, responsive single-page web application built with **React 19, Vite, and Tailwind CSS**. Provides role-tailored dashboards and management workflows for Administrators, Teachers, Students, and Parents.

---

## 🎨 Tech Stack

- **Core Framework**: React 19 + React DOM 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (v4) with custom utility components
- **Routing**: React Router DOM (v6)
- **State Management & Data Fetching**: TanStack React Query (v5) + Axios
- **Animations**: Framer Motion
- **Icons & UI Utilities**: React Icons, React Toastify, HTML2Canvas, jsPDF

---

## ⚙️ Environment Configuration

Copy `.env.example` to create your local `.env` file:

```powershell
cp .env.example .env
```

### Environment Variables

| Variable | Required | Description | Default / Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE` | **Yes** | Backend Express API base URL | `http://localhost:4000` |
| `VITE_RAZORPAY_KEY_ID` | No | Public Razorpay Checkout Key ID | `rzp_test_xxxxxx` |

---

## 💻 Getting Started

### 1. Installation
```powershell
npm install
```

### 2. Run Development Server
```powershell
npm run dev
```

The application will launch locally at `http://localhost:5173`.

### 3. Production Build
To compile static production assets into `dist/`:

```powershell
npm run build
```

### 4. Preview Production Build
```powershell
npm run preview
```

---

## 📁 Project Structure

```text
frontend/
├── public/              # Static assets & public images
├── src/
│   ├── api/             # API client services & Axios configuration
│   ├── components/      # Shared UI components, Modals, Navbars, Sidebars
│   ├── context/         # AuthContext & React Query providers
│   ├── pages/           # Application views & Dashboard pages
│   │   ├── admin/       # Administrator management views
│   │   ├── faculty/     # Teacher/Faculty dashboard & grading views
│   │   ├── student/     # Student portal, assignments, & fee views
│   │   └── parent/      # Parent monitoring dashboard & payments
│   ├── App.jsx          # Main application router definition
│   ├── index.css        # Global CSS & Tailwind imports
│   └── main.jsx         # Application entry point
├── package.json
└── vite.config.js       # Vite build & plugin settings
```

---

## 🔑 Default Credentials (Development)

- **Admin**: `admin` / `admin123`
- **Teacher / Faculty**: `teacher1` / `teacher123`
- **Student**: `student1` / `student123`
- **Parent**: `parent1` / `parent123`
