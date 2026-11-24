# Placement Management Dashboard

A comprehensive web application for managing campus placements with multiple user roles including Students, Campus POCs, Placement Coordinators, and Managers.

## Features

### User Roles

1. **Students**
   - Create and manage profile with skills
   - Upload resume
   - Browse and apply for jobs
   - Track application status
   - View interview feedback

2. **Campus POCs**
   - View and manage students from their campus
   - Approve/reject student skills
   - Add recommendations for students
   - Track student placement journey

3. **Placement Coordinators**
   - Create and manage job postings
   - Review and process applications
   - Manage skill categories
   - Update application status

4. **Managers**
   - View comprehensive placement statistics
   - Generate reports
   - Monitor campus-wise performance
   - Track company-wise placements

## Tech Stack

### Backend
- Node.js with Express.js
- MongoDB with Mongoose ODM
- JWT Authentication
- Multer for file uploads

### Frontend
- React 18 with Vite
- TailwindCSS for styling
- React Router for navigation
- Axios for API calls
- React Hot Toast for notifications

## Project Structure

```
├── backend/
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── middleware/      # Auth & upload middleware
│   ├── uploads/         # Uploaded files
│   ├── server.js        # Express server
│   └── seed.js          # Database seeder
│
└── frontend/
    ├── src/
    │   ├── components/  # Reusable components
    │   ├── context/     # React context providers
    │   ├── layouts/     # Layout components
    │   ├── pages/       # Page components by role
    │   └── services/    # API services
    └── index.html
```

## Getting Started

### Prerequisites
- Node.js 16+ 
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/placement_dashboard
   JWT_SECRET=your_super_secret_key_here
   NODE_ENV=development
   ```

4. Seed the database (optional):
   ```bash
   npm run seed
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

### Development Troubleshooting
If you run into issues (port in use, backend unreachable, DB errors), see `DEV-SETUP.md` for step-by-step commands to diagnose and fix common problems such as EADDRINUSE, failed migrations, and health checks.

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 in your browser

## Default Test Users

After running the seed script:

| Role | Email | Password |
|------|-------|----------|
| Student | student@test.com | password123 |
| Campus POC | poc@test.com | password123 |
| Coordinator | coordinator@test.com | password123 |
| Manager | manager@test.com | password123 |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (admin)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `POST /api/users/:id/avatar` - Upload avatar
- `POST /api/users/:id/resume` - Upload resume

### Jobs
- `GET /api/jobs` - Get all jobs
- `GET /api/jobs/:id` - Get job by ID
- `POST /api/jobs` - Create job (coordinator)
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job

### Applications
- `GET /api/applications` - Get applications
- `POST /api/applications` - Apply for job
- `PUT /api/applications/:id/status` - Update status

### Skills
- `GET /api/skills` - Get all skills
- `POST /api/skills` - Create skill
- `PUT /api/skills/:id` - Update skill
- `DELETE /api/skills/:id` - Delete skill

### Statistics
- `GET /api/stats/dashboard` - Get dashboard stats

## Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| MONGODB_URI | MongoDB connection string | - |
| JWT_SECRET | Secret for JWT tokens | - |
| NODE_ENV | Environment | development |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:5000/api |

## Contributing

1. Fork the repository.
2. Create a focused feature branch.
3. Commit your changes.
4. Push the branch.
5. Open a Pull Request.

### Safely separating ready and future work

Use this workflow when the worktree contains both changes that are ready to
publish and experimental features that should remain unpublished.

Do not use `git reset --hard`, `git clean`, or `git stash drop` during this
process. These commands can permanently remove uncommitted work.

1. Back up the current uncommitted and untracked files outside the repository
   before reorganizing them:

   ```bash
   git diff --binary > ../placement-dashboard-uncommitted.patch
   ```

2. Create a dedicated branch for the future feature and commit the complete
   current work as a recovery checkpoint:

   ```bash
   git switch -c feature/future-integration
   git add -A
   git commit -m "WIP future integration"
   git switch main
   ```

   Untracked files are included by `git add -A`. Do not push this branch until
   the future feature is complete and tested.

3. On `main`, reapply only the changes that are ready to publish. Keep future
   routes, models, UI pages, dependencies, environment variables, and tests out
   of `main`. Shared files need manual review because they may contain changes
   from both groups.

4. Create small commits for the ready changes. Review the exact files with:

   ```bash
   git status --short --branch
   git diff --stat origin/main
   git diff --name-only origin/main
   ```

5. Validate the relevant code before pushing:

   ```bash
   cd backend
   npm test
   node --check server.js

   cd ../frontend
   npm run build
   ```

6. Push ready changes only after they pass:

   ```bash
   git push origin main
   ```

For example, certificate request, signatory, Gmail, and Google Drive integration
code should stay on a dedicated future-feature branch until those integrations
are tested and production credentials are configured. Never commit `.env`,
OAuth credentials, refresh tokens, or private keys.

If a commit already pushed to `main` is incorrect, fix it with a normal follow-up
commit. Avoid force-pushing or rewriting shared branch history.

## Deployment Guide (Render + MongoDB Atlas)

### Step 1: Set up MongoDB Atlas (Free Tier)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas) and create a free account
2. Create a new **FREE** cluster (M0 Sandbox - 512MB)
3. Set up database access:
   - Go to **Database Access** → Add New Database User
   - Create username/password (save these!)
4. Set up network access:
   - Go to **Network Access** → Add IP Address
   - Click **Allow Access from Anywhere** (0.0.0.0/0)
5. Get connection string:
   - Go to **Database** → **Connect** → **Connect your application**
   - Copy the connection string: `mongodb+srv://<username>:<password>@cluster.mongodb.net/placement_dashboard`

### Step 2: Deploy to Render

1. Push your code to GitHub
2. Go to [Render](https://render.com) and sign up with GitHub
3. Click **New** → **Blueprint** → Connect your repository
4. Render will detect `render.yaml` and create both services

**Or deploy manually:**

#### Backend:
1. Click **New** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add Environment Variables:
   - `MONGODB_URI`: Your Atlas connection string
   - `JWT_SECRET`: A random secure string
   - `NODE_ENV`: `production`

#### Frontend:
1. Click **New** → **Static Site**
2. Connect your GitHub repo
3. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_URL`: `https://your-backend-name.onrender.com/api`

### Step 3: Seed the Database (One-time)

After deployment, run the seed script locally pointing to Atlas:

```bash
cd backend
MONGODB_URI="mongodb+srv://..." node seed.js
```

### Free Tier Limits

| Service | Limit |
|---------|-------|
| Render Web Service | 750 hrs/month (spins down after 15 min inactivity) |
| Render Static Site | Unlimited |
| MongoDB Atlas M0 | 512 MB storage, shared RAM |

> **Note**: Free tier backends on Render spin down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds.

## License

MIT License
