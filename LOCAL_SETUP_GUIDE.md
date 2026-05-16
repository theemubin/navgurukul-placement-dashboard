# 🚀 Setup Guide - Placement Dashboard Local Development

## Current Status

✅ **Frontend**: Running on `http://localhost:3002`  
✅ **Backend**: Ready on `http://localhost:5004` (waiting for MongoDB)  
⚠️ **MongoDB**: Not available locally - need setup

---

## MongoDB Setup (Choose One)

### Option 1: MongoDB Atlas (Cloud - Recommended)

**Fastest option - no installation needed**

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account (M0 tier is free)
3. Create a cluster and get your connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/placement_dashboard?retryWrites=true&w=majority
   ```
4. Update `backend/.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/placement_dashboard?retryWrites=true&w=majority
   ```
5. Restart the backend: Press `Ctrl+C` in backend terminal and it will auto-restart with nodemon

**Pros:** No local installation, works from anywhere  
**Cons:** Requires internet

---

### Option 2: MongoDB Community (Local - Fully Offline)

**Install MongoDB Community Edition**

#### Windows Installation Steps:

1. **Download MongoDB Community Server**
   - Go to [MongoDB Download Center](https://www.mongodb.com/try/download/community)
   - Download the Windows MSI installer
   - Run the installer and follow the setup wizard
   - Choose "Install MongoDB as a Service" during installation

2. **Start MongoDB Service**
   ```powershell
   # MongoDB should start automatically, but if not:
   net start MongoDB
   ```

3. **Verify Installation**
   ```powershell
   mongod --version
   ```

4. **Your `.env` already has this configured:**
   ```
   MONGODB_URI=mongodb://localhost:27017/placement_dashboard
   ```

5. **Restart backend** - it should now connect!

**Pros:** Fully offline, no cloud dependency  
**Cons:** ~200MB download and installation required

---

### Option 3: Docker Desktop (Alternative)

If you have Docker installed:

```powershell
docker run -d -p 27017:27017 --name placement-mongodb mongo:latest
```

Then use: `MONGODB_URI=mongodb://localhost:27017/placement_dashboard`

---

## Environment Variables Configured

Your `.env` file is now set up with:

```env
PORT=5004
MONGODB_URI=mongodb://localhost:27017/placement_dashboard
FRONTEND_URL=http://localhost:3002
JWT_SECRET=navgurukul_placement_jwt_secret_2026_secure_key
SESSION_SECRET=navgurukul_session_secret_2026_secure_key
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5004/api/auth/google/callback
MANAGER_EMAIL=mubin@navgurukul.org
```

---

## Running the Application

### Start Both Backend & Frontend Together

```powershell
npm start
```

This runs:
- **Backend** on `http://localhost:5004` (via nodemon - auto-restarts on code changes)
- **Frontend** on `http://localhost:3002` (via Vite - auto-reloads on code changes)

### Or Run Separately (for debugging)

```powershell
# Terminal 1 - Backend only
cd backend
npm run dev

# Terminal 2 - Frontend only
cd frontend
npm run dev
```

---

## Accessing the Application

1. **Dashboard**: http://localhost:3002
2. **API Docs**: http://localhost:5004/api-docs
3. **API Health Check**: http://localhost:5004/api/health

---

## First Time Login

### Test Credentials (after seed):

```
Email: student@navgurukul.org
Password: password123
```

Or use **Google OAuth** (if configured in your Google Console)

---

## Common Issues & Fixes

### ❌ "MongoDB Connection Error"

**Cause**: MongoDB not running or not installed

**Solutions**:
1. Install MongoDB (see Option 2 above)
2. Or use MongoDB Atlas (Option 1)
3. Or use Docker (Option 3)

### ❌ "Port 5004 already in use"

```powershell
# Find process using port 5004
netstat -ano | findstr ":5004"

# Kill it (replace PID)
taskkill /PID <PID> /F

# Or change PORT in .env:
PORT=5005
```

### ❌ "Cannot GET /api/..."

**Cause**: Backend not running or API endpoint doesn't exist

**Solutions**:
1. Check backend terminal for errors
2. Verify MongoDB is connected (should see "Connected to MongoDB" message)
3. Check API docs at http://localhost:5004/api-docs

### ❌ "Frontend showing blank page"

**Cause**: Vite dev server not running or CORS issue

**Solutions**:
1. Check frontend terminal - should show "ready"
2. Clear browser cache (Ctrl+Shift+Delete)
3. Check browser console (F12) for errors

---

## Seeding Test Data

```powershell
npm run seed
```

This creates:
- Test users (student, coordinator, manager)
- Test campuses
- Test jobs
- Sample skills and job readiness criteria

---

## Stopping the Application

```powershell
# Press Ctrl+C in the terminal running npm start
# Or in individual terminals if running separately
```

---

## Next Steps

1. **Setup MongoDB** (choose one of the three options above)
2. **Restart backend** - it will auto-connect
3. **Visit http://localhost:3002** - should see login page
4. **Seed test data** if you want: `npm run seed`
5. **Login** with test credentials
6. **Test Discord Integration** (if Discord bot token configured)

---

## Discord Integration (Optional)

To enable Discord notifications for job postings:

1. Create a Discord bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Add to `.env`:
   ```
   DISCORD_BOT_TOKEN=your_bot_token_here
   ```
3. Restart backend
4. Configure channels in the app settings

See `docs/discord-setup.md` for detailed instructions.

---

## Support

For issues:
1. Check backend logs in terminal
2. Check frontend logs in browser console (F12)
3. Check `http://localhost:5004/api/health` for backend status
4. Review error messages in both terminals

**Happy Coding! 🎉**
