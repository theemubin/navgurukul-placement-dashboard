# 📚 MongoDB Atlas Setup - Step by Step Guide

## 🚀 Get Your MongoDB Connection String in 5 Minutes

### Step 1: Go to MongoDB Atlas Website
```
🔗 Visit: https://www.mongodb.com/cloud/atlas
```
- Click the **"Sign Up Free"** button (top right)
- Or click **"Try Free"** button

---

### Step 2: Create Account
1. **Sign up** with:
   - Email address (use your Gmail/work email)
   - Password (at least 8 characters)
   - Agree to terms
   
2. **Verify email** - Check your email and click the verification link

3. **Create Organization** - You'll be asked to name your organization
   - Name it: `Navgurukul` (or any name you prefer)
   - Click **"Continue"`

---

### Step 3: Create a Project
1. After login, you'll see "Create Project" button
2. **Project Name**: `Placement Dashboard` (or any name)
3. Click **"Create Project"`
4. Select your preferred organization and click **"Create"`

---

### Step 4: Create a Cluster
1. Click **"Create"** to build a cluster
2. Select **"M0 Sandbox"** (it's FREE and never expires!)
3. Choose your region:
   - **Asia Pacific**: Singapore (closest to India)
   - Or your preferred region
4. Click **"Create Cluster"`
5. **Wait 1-2 minutes** for cluster to be created ⏳

---

### Step 5: Create Database User (Username & Password)
1. In the left menu, click **"Database Access"`
2. Click **"Add New Database User"`
3. Fill in:
   ```
   Username: placement_user
   Password: YourSecurePassword123 (remember this!)
   ```
4. Click **"Add User"`

**💾 Save these credentials - you'll need them!**

---

### Step 6: Allow Network Access
1. In the left menu, click **"Network Access"`
2. Click **"Add IP Address"`
3. Select **"Allow Access from Anywhere"** (for development)
   - IP: `0.0.0.0/0`
4. Click **"Confirm"`

⚠️ **Note**: In production, use specific IP addresses for security

---

### Step 7: Get Your Connection String
This is the important part! ⭐

1. Go back to **"Database"** (left menu)
2. Click **"Connect"** on your cluster
3. Choose **"Drivers"**
4. Select:
   - **Language**: Node.js
   - **Version**: 4.0 or later

5. You'll see a connection string like this:
   ```
   mongodb+srv://placement_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

---

### Step 8: Modify the Connection String
The string has placeholders that you need to replace:

**Original:**
```
mongodb+srv://placement_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

**Replace:**
- `<password>` → Your password from Step 5
- Add `/placement_dashboard` at the end

**Final Result:**
```
mongodb+srv://placement_user:YourSecurePassword123@cluster0.xxxxx.mongodb.net/placement_dashboard?retryWrites=true&w=majority
```

---

### Step 9: Add to Your Project

1. **Open this file**: `backend/.env`

2. **Find this line:**
   ```
   MONGODB_URI=mongodb://localhost:27017/placement_dashboard
   ```

3. **Replace it with:**
   ```
   MONGODB_URI=mongodb+srv://placement_user:YourSecurePassword123@cluster0.xxxxx.mongodb.net/placement_dashboard?retryWrites=true&w=majority
   ```

4. **Save the file** (Ctrl+S)

---

### Step 10: Restart Backend

Now stop the current backend and restart it:

```powershell
# In your terminal running the backend, press Ctrl+C

# Then run:
npm start
```

Or in separate terminals:
```powershell
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

**You should see in backend terminal:**
```
✅ MongoDB Connected
```

---

## 🎯 Example Connection String

If your cluster name is `cluster0` and your MongoDB dashboard shows:
```
mongodb+srv://placement_user:<password>@cluster0.abcd1234.mongodb.net/?retryWrites=true&w=majority
```

**Then your final string should be:**
```
mongodb+srv://placement_user:MyPassword123@cluster0.abcd1234.mongodb.net/placement_dashboard?retryWrites=true&w=majority
```

**Changes made:**
- ✅ Replaced `<password>` with actual password
- ✅ Added `/placement_dashboard` database name

---

## 🔍 Where to Find Each Part

| Part | Where to Find |
|------|---|
| **Username** | Database Access → Users |
| **Password** | You created it (Step 5) |
| **Cluster URL** | Connect → Drivers → Shows the whole string |
| **Region Code** | Your cluster URL (like `abcd1234`) |

---

## ✅ Verification Checklist

After updating `.env`:

- [ ] Replaced `<password>` with actual password
- [ ] Added `/placement_dashboard` at the end
- [ ] Saved the `.env` file
- [ ] Restarted backend (`npm run dev`)
- [ ] See "MongoDB Connected" in logs
- [ ] Can login at http://localhost:3002
- [ ] Can access dashboard

---

## ❓ Troubleshooting

### ❌ "Connection refused"
- Check username and password are correct
- Verify network access is set to "0.0.0.0/0"
- Wait 1-2 minutes after creating user

### ❌ "Authentication failed"
- Double-check password is correct (case-sensitive)
- Verify database user exists in "Database Access"
- Password might have special characters - use single quotes

### ❌ "Cluster not ready"
- Wait 3-5 minutes for cluster to start
- Refresh the page

### ✅ "MongoDB Connected"
- Success! You can now use the app

---

## 💡 Quick Copy-Paste Template

Use this template and just fill in your values:

```
mongodb+srv://[USERNAME]:[PASSWORD]@[CLUSTER_NAME].[REGION].mongodb.net/placement_dashboard?retryWrites=true&w=majority
```

**Example with real values:**
```
mongodb+srv://placement_user:MySecurePass123@cluster0.abcd1234.mongodb.net/placement_dashboard?retryWrites=true&w=majority
```

---

## 🚨 Security Note

- **For Development**: Using `0.0.0.0/0` is fine
- **For Production**: 
  - Lock down IP to specific addresses
  - Use strong passwords
  - Enable VPC
  - Use IAM roles

---

## Next Steps After Setup

1. ✅ Get connection string (you're here)
2. ⏳ Update `.env` file
3. ⏳ Restart backend
4. ⏳ Verify "MongoDB Connected" appears
5. ⏳ Login to app with test credentials
6. ⏳ Test Discord integration

---

**Need help?** The connection string is the only required step to switch from mock to real database!

Once you have it, come back and I'll help you verify it works. 🎉
