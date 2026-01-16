# Placement Management Dashboard - Context

## Overview
A full-stack web application for managing campus placements. It connects Students, Campus POCs, Placement Coordinators, and Managers to streamline the recruitment process.

## Tech Stack
- **Frontend**: React 18 (Vite), TailwindCSS, React Router, Axios, Context API.
- **Backend**: Node.js, Express.js.
- **Database**: MongoDB (Mongoose ODM).
- **Authentication**: JWT-based auth with role management.

## Project Structure

### Backend (`/backend`)
Follows a standard MVC-like pattern (without Views):
- **Models** (`/models`): Mongoose schemas defining the data layer.
  - Core entities: `User`, `Job`, `Application`, `PlacementCycle`, `Campus`.
  - specialized entities: `JobReadiness`, `SelfApplication`, `InterestRequest`, `Skill`.
- **Routes** (`/routes`): API endpoints organizing business logic.
  - Matches models (e.g., `jobs.js`, `users.js`) plus `auth.js`, `stats.js`, and `bulkUpload.js`.
- **Scripts**: Seed scripts (`seed.js`, `seed-job-readiness.js`) for initializing data.

### Frontend (`/frontend`)
Built with Vite, organized by features and roles:
- **Pages** (`/src/pages`): Segregated by user role to ensure separation of concerns.
  - `auth/`: Login, Register, Forgot Password.
  - `student/`: Student-specific dashboard and application tracking.
  - `campus-poc/`: Campus-level management.
  - `coordinator/`: Job creation and application processing.
  - `manager/`: High-level stats and reporting.
- **Components** (`/src/components`): Reusable UI elements.
- **Context** (`/src/context`): State management (likely AuthContext).

## Key Features & modules
1.  **User Management**: Role-based access control (Student, POC, Coordinator, Manager).
2.  **Job Management**: Creating, updating, and tracking job postings.
3.  **Application System**: 
    - Standard applications via platform.
    - `SelfApplication` for off-campus offers.
    - `InterestRequest` for expressing interest in roles.
4.  **Placement Readiness**: Tracking `JobReadiness` metrics for students.
5.  **Data Processing**: `bulkUpload` capabilities for managing large datasets.
6.  **Analytics**: `stats.js` endpoints powering dashboard visualizations.

## Development info
- **Start**: `npm run dev` in root (concurrently starts frontend and backend).
- **Env**: Requires `.env` in both `backend` and `frontend` (see `README.md`).
- **Deployment**: Configured for Render (`render.yaml`).
- **Standardization**: Prefer using centralized API clients (`services/api.js`) over native `fetch` to ensure auth headers are included.

## Recent Bug Fixes & Lessons Learned

| Issue | Reason | Resolution |
| :--- | :--- | :--- |
| **401 Unauthorized** (JobForm) | Raw `fetch()` was used for `/api/settings`, which bypassed the Axios auth interceptors and didn't include the JWT token. | Replaced `fetch()` with `settingsAPI.getSettings()` to leverage centralized auth handling. |
| **Duplicate School Names** | Inconsistent casing/prepositions in the database (`School Of` vs `School of`) led to duplicate entries in dropdowns. | Added auto-migration in `Settings.js` to merge legacy keys into standard keys upon access. |
| **School List Mismatch** | Front-end components had different hardcoded fallback lists that went out of sync with the backend. | Standardized fallbacks and prioritized backend-driven lists in both `JobForm.jsx` and `Profile.jsx`. |
| **Council Post Eligibility** | Missing criteria for months served and certificate verification in job postings. | Added `councilService` to `User` and `councilPosts` to `Job` models with matching UI sections. |

