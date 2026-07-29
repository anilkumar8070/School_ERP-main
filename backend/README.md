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
# Backend Migration Issues

This document outlines the remaining issues and bugs in the backend following the initial Mongoose to Prisma migration attempt. The codebase is currently in a broken state because the Mongoose models have been removed, but many route handlers still attempt to invoke Mongoose-specific APIs on the Prisma delegates.

## Remaining Bugs

### 1. Unsupported Methods (.populate())
Prisma uses the include: { ... } syntax to eagerly load related records, while Mongoose uses .populate('relation'). Several route files (e.g., 
outes/contact-queryRoutes.js, 
outes/facultyRoutes.js) still contain .populate().
- **Error:** TypeError: [...].populate is not a function

### 2. Document Creation (
ew Model())
Routes often create new database entries using Mongoose instantiation:
`js
const user = new User(req.body);
await user.save();
`
In Prisma, this must be refactored to:
`js
const user = await prisma.user.create({ data: req.body });
`
Many route files still use the 
ew Model() pattern.

### 3. Update Methods
Mongoose has methods like indByIdAndUpdate() or fetching a document, modifying it, and calling .save().
In Prisma, these must become:
`js
prisma.model.update({ where: { id: ... }, data: { ... } });
`
Current routes still attempt to call .save() on plain Javascript objects returned by Prisma, which will throw errors.

### 4. Incorrect Queries
Mongoose supports indById(id). The initial transpilation attempted to convert this, but there are still nested queries, conditional queries, and $or / $in operators from Mongoose that don't translate 1:1 to Prisma syntax.

### 5. indByIdAndDelete
Some routes still use indByIdAndDelete(id) which does not exist on Prisma delegates. They must use prisma.model.delete({ where: { id } }).

## Next Steps
To resolve the above bugs, the following actions must be taken on the backend routes:
1. Manually review all 60+ route handlers.
2. Replace all instances of 
ew [ModelName] and .save() with prisma.[model].create().
3. Replace all instances of .populate(...) with the include parameter in Prisma indUnique/indMany queries.
4. Replace all occurrences of Mongoose-style updates with Prisma's update and updateMany.
5. Remove any leftover .exec() or Mongoose specific syntax that wasn't caught by the regex transpiler.

These steps are critical as the backend will systematically crash when these endpoints are hit until the Prisma syntax is correctly implemented.
