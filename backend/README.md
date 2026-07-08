# ERP Backend (Minimal)

This is a minimal Express backend for the ERP frontend. It demonstrates JWT authentication and role-based access control.

Features:
- POST `/api/login` — returns a JWT and suggested redirect path based on role
- GET `/api/profile` — returns the authenticated user's token payload
- GET `/api/admin/dashboard` — example admin-only endpoint
- Serves frontend static `dist` from `../vite-project/dist` if present

Quick start

1. Copy `.env.example` to `.env` and set `JWT_SECRET`.
2. Install dependencies and start the server:

```powershell
cd backend
npm install
npm run dev
```

Default demo users (for development only):
- admin / set `DEMO_ADMIN_PASSWORD` in `.env` (role: admin)
- faculty / set `DEMO_FACULTY_PASSWORD` in `.env` (role: faculty)
- student / set `DEMO_STUDENT_PASSWORD` in `.env` (role: student)
- parent / set `DEMO_PARENT_PASSWORD` in `.env` (role: parent)

API usage

- Login: POST `/api/login` with JSON body `{ "username": "admin", "password": "admin123" }`.
  Response: `{ token, role, redirect }`.
- Use `Authorization: Bearer <token>` header to call protected endpoints.

# ERP Backend (Minimal)

This is a minimal Express backend for the ERP frontend. It demonstrates JWT authentication and role-based access control.

Features:
- POST `/api/login` — returns a JWT and suggested redirect path based on role
- GET `/api/profile` — returns the authenticated user's token payload
- GET `/api/admin/dashboard` — example admin-only endpoint (admin-only)
- Connects to MongoDB if `MONGODB_URI` is configured; seeds demo users when DB empty
- Serves frontend static files from the directory configured in `FRONTEND_DIST` (see `.env`)

Quick start

1. Copy `.env.example` to `.env` and set `JWT_SECRET` and `MONGODB_URI` (if using MongoDB).
2. Install dependencies and start the server:

```powershell
cd backend
npm install
npm run dev
```

Default demo users (for development only):
- admin / admin123 (role: admin)
- faculty / faculty123 (role: faculty)
- student / student123 (role: student)
- parent / parent123 (role: parent)

If you set `MONGODB_URI`, the server will attempt to connect and will seed these demo users if the `users` collection is empty.

API usage

- Login: POST `/api/login` with JSON body `{ "username": "admin", "password": "admin123" }`.
  Response: `{ token, role, redirect }`.
- Use `Authorization: Bearer <token>` header to call protected endpoints.

Frontend configuration

- Set `VITE_API_BASE` in your frontend environment to point at the backend base URL (for example `http://localhost:4000`). See `frontend/.env.example`.

Cors / Allowed Origins

- To restrict browser access to the backend, set `ALLOWED_ORIGINS` in `backend/.env` (comma-separated list of allowed origins). Example:

  `ALLOWED_ORIGINS=https://my-frontend.example.com,http://localhost:5173`

- When deploying to platforms like Render, set `ALLOWED_ORIGINS` in the service's environment variables to the deployed frontend URL(s). The backend will use `ALLOWED_ORIGINS` (preferred) or `FRONTEND_URL` for CORS checks.

- Notes:
  - If `ALLOWED_ORIGINS`/`FRONTEND_URL` is not provided, the server will not allow arbitrary browser origins (requests with no origin such as curl or server-to-server still work).
  - We log the configured allowed origins at startup so you can verify the setting in logs.

Security notes

- This is a demo. Do NOT use demo passwords or the inline secret in production.
- Replace the in-memory user store with a real database and use strong secrets in production.
