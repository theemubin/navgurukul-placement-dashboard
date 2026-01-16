# Antigravity Instructions

This file serves as a comprehensive guide for the AI assistant (Antigravity) working on the Placement Management Dashboard. It includes project context, architectural decisions, and coding standards.

## 1. Project Overview
**Placement Management Dashboard** is a full-stack MERN application simplifying the campus placement process.
- **Goal**: Connect Students, Campus POCs, Coordinators, and Managers.
- **Repository**: `Codespace/Placemend Dashboard`

## 2. Tech Stack & Architecture
### Frontend
- **Framework**: React 18 (Vite)
- **Styling**: TailwindCSS
- **State**: React Context API
- **Routing**: React Router DOM
- **HTTP**: Axios

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Authentication**: JWT (JSON Web Tokens)

## 3. Coding Standards & Conventions
### General
- **Naming**: camelCase for variables/functions, PascalCase for Components/Classes.
- **Imports**: Group imports (Built-in -> Third-party -> Internal).
- **Comments**: Explain "Why", not "What" (unless complex logic).

### Frontend Guidelines
- **Structure**: Components should be functional and use Hooks.
- **Styles**: collaborative use of Tailwind utility classes. Avoid inline styles.
- **Role-Based Views**: dedicated directories for each user role (`student/`, `campus-poc/`, `manager/`).

### Backend Guidelines
- **MVC Pattern**: Keep Models, Routes, and Controllers (logic) separated.
- **Error Handling**: Use `try/catch` in async routes and pass errors to middleware.
- **Validation**: Validate inputs at the route/controller level before querying DB.

## 4. Operational Context
- **Running Locally**:
  - `npm run dev` in the root starts both servers concurrently.
  - Backend: Port 5000 (default)
  - Frontend: Port 3000 (default) / Vite default

## 5. Artifacts & Documentation
- **Task List**: `brain/task.md` (Track progress)
- **Context**: `brain/context.md` (High-level summary)

---
*Note: This file should be updated as the project evolves or new patterns are adopted.*
