# ⚡ Quick MongoDB Atlas Setup - TL;DR Version

## In 30 Seconds:
1. Go to: https://www.mongodb.com/cloud/atlas
2. Sign up → Create Organization → Create Project → Create M0 Cluster
3. Database Access → Add User (username & password)
4. Network Access → Allow 0.0.0.0/0
5. Connect → Drivers → Copy connection string
6. Replace `<password>` with your password
7. Add `/placement_dashboard` at the end
8. Update `backend/.env`
9. Restart backend
10. Done! ✅

---

## Example Flow:

```
┌─────────────────────────────────────┐
│ 1. Visit MongoDB Atlas              │
│    https://mongodb.com/cloud/atlas  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Sign Up with Email               │
│    (takes 1 minute)                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Create Free M0 Cluster           │
│    (wait 2-3 minutes)               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. Create Database User             │
│    Username: placement_user         │
│    Password: YourPassword123        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. Allow Network Access             │
│    IP: 0.0.0.0/0                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 6. Get Connection String            │
│    Connect → Drivers → Copy URL     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ 7. Connection String Template:                      │
│                                                     │
│ mongodb+srv://[USER]:[PASS]@[CLUSTER]/[DATABASE]   │
│                                                     │
│ Replace:                                            │
│ [USER] → placement_user                             │
│ [PASS] → YourPassword123                            │
│ [CLUSTER] → cluster0.xxxxx                          │
│ [DATABASE] → placement_dashboard                    │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────────────────┐
│ 8. Update backend/.env:                                   │
│                                                           │
│ MONGODB_URI=mongodb+srv://placement_user:YourPassword123@ │
│ cluster0.xxxxx.mongodb.net/placement_dashboard?          │
│ retryWrites=true&w=majority                               │
└───────────────────┬──────────────────────────────────────┘
                    │
                    ▼
             ✅ Ready to Use!
```

---

## Exact Steps (Copy-Paste):

### Step 1: Create Free Account
- URL: https://www.mongodb.com/cloud/atlas
- Click: "Sign Up Free"
- Enter: Email & Password
- Verify: Check your email

### Step 2: Create Cluster
- Organization Name: `Navgurukul`
- Project Name: `Placement Dashboard`
- Cluster Type: `M0 Sandbox` (FREE)
- Region: `Singapore` or your choice
- Wait: 2-3 minutes ⏳

### Step 3: Create Database User
- Menu: Database Access
- Button: "Add New Database User"
- Username: `placement_user`
- Password: `YourSecurePassword123` (you choose)
- Save: Remember your password!

### Step 4: Allow Network Access
- Menu: Network Access
- Button: "Add IP Address"
- Select: "Allow Access from Anywhere"
- Confirm: `0.0.0.0/0`

### Step 5: Get Connection String
- Button: "Connect" (on cluster)
- Select: "Drivers"
- Language: Node.js
- Copy: Full connection string

### Step 6: Final Format
Take the string like:
```
mongodb+srv://placement_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

Make it look like:
```
mongodb+srv://placement_user:YourSecurePassword123@cluster0.xxxxx.mongodb.net/placement_dashboard?retryWrites=true&w=majority
```

Changes:
- ✅ `<password>` → `YourSecurePassword123`
- ✅ Add `/placement_dashboard` before `?`

---

## Update Your .env File

Open: `backend/.env`

Find this line:
```
MONGODB_URI=mongodb://localhost:27017/placement_dashboard
```

Replace with your Atlas string:
```
MONGODB_URI=mongodb+srv://placement_user:YourSecurePassword123@cluster0.xxxxx.mongodb.net/placement_dashboard?retryWrites=true&w=majority
```

Save: `Ctrl+S`

---

## Test It Works

1. Stop backend: `Ctrl+C` in backend terminal
2. Start backend: `npm run dev` (or `npm start`)
3. Check logs: Should show ✅ `MongoDB Connected`
4. Visit: http://localhost:3002
5. Login: student@navgurukul.org / password123

---

## Connection String Breakdown

```
mongodb+srv://placement_user:YourPassword@cluster0.abc123.mongodb.net/placement_dashboard?retryWrites=true&w=majority
 │             │              │             │                          │                      │
 │             │              │             │                          │                      └─ Options
 │             │              │             │                          └─ Database Name
 │             │              │             └─ Cluster URL
 │             │              └─ Password
 │             └─ Username
 └─ Connection Type (MongoDB Atlas)
```

---

## Common Mistakes

❌ **Don't forget `<password>` replacement**
```
Wrong: mongodb+srv://placement_user:<password>@cluster0...
Right: mongodb+srv://placement_user:MyActualPassword@cluster0...
```

❌ **Don't forget `/placement_dashboard` database name**
```
Wrong: mongodb+srv://placement_user:pass@cluster0.xxx.mongodb.net/?retryWrites=true
Right: mongodb+srv://placement_user:pass@cluster0.xxx.mongodb.net/placement_dashboard?retryWrites=true
```

❌ **Don't share your connection string publicly!**
- It contains your password
- Add to `.env` (not git)
- Keep it private!

---

## Need Help?

If stuck on any step, let me know:
1. What step you're on
2. Any error messages you see
3. I'll help you debug! 🚀
