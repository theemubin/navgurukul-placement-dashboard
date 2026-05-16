# 📸 MongoDB Atlas - Menu Navigation Guide

## Where to Find Each Option in MongoDB Dashboard

### 🔍 Left Sidebar Menu Options

```
MongoDB Atlas Dashboard
├── 📊 Overview
├── 📁 Projects & Deployments
│   ├── Create Project
│   ├── Select Project
│   └── Deployment
├── 🔒 Security
│   ├── ⭐ Database Access        ← CREATE USER HERE
│   ├── ⭐ Network Access         ← ALLOW 0.0.0.0/0 HERE
│   ├── API Keys
│   ├── IP Whitelist
│   └── Encryption
├── 🗄️ Data Services
│   ├── Database
│   ├── ⭐ Clusters               ← YOUR M0 CLUSTER HERE
│   └── Search (optional)
├── 🔗 Integrations
├── ⚙️ Admin
└── 📚 Additional Resources
```

---

## Step-by-Step Menu Clicks

### 1️⃣ Create Project
```
Top Left: "Projects"
    ↓
"Create Project" button
    ↓
Enter: "Placement Dashboard"
    ↓
Click: "Create Project"
```

### 2️⃣ Create Cluster
```
"Build" or "Create a Deployment"
    ↓
Select: "M0 Sandbox" (FREE)
    ↓
Choose: Region (Singapore or India)
    ↓
Click: "Create Deployment"
    ↓
⏳ Wait 2-3 minutes...
```

### 3️⃣ Create Database User ⭐ IMPORTANT
```
Left Menu → Security
    ↓
"Database Access"
    ↓
"Add New Database User" button
    ↓
Fill In:
  Username: placement_user
  Password: YourPassword123
    ↓
"Add User"
```

### 4️⃣ Allow Network Access ⭐ IMPORTANT
```
Left Menu → Security
    ↓
"Network Access"
    ↓
"Add IP Address" button
    ↓
Select: "Allow Access from Anywhere"
    ↓
IPv4: 0.0.0.0/0
    ↓
"Confirm"
```

### 5️⃣ Get Connection String ⭐ KEY STEP
```
Left Menu → Data Services
    ↓
"Clusters"
    ↓
Find your cluster
    ↓
"Connect" button
    ↓
Select: "Drivers"
    ↓
Language: "Node.js"
    ↓
Version: "4.0 or later"
    ↓
👁️ Copy the connection string:
   mongodb+srv://placement_user:<password>@cluster0.xxxxx...
```

---

## Connection String Location

### In MongoDB Dashboard:
```
Cluster View
    └── [Your Cluster Name] 
        └── "Connect" button
            └── "Drivers"
                └── "Node.js"
                    └── Connection String (in code box)
```

### You'll see something like:
```javascript
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://placement_user:<password>@cluster0.abcd1234.mongodb.net/?retryWrites=true&w=majority";
// ...
```

**Copy this part:** `mongodb+srv://placement_user:<password>@...`

---

## Visual: Where Things Are Located

### Dashboard Overview (After Login)
```
┌─────────────────────────────────────────────────────────┐
│ MongoDB Atlas                                       [?]  │
├─────────────────────────────────────────────────────────┤
│ LEFT MENU        │     MAIN AREA                         │
│                  │                                       │
│ Overview         │  ┌────────────────────────────────┐  │
│ ⭐ Database      │  │  Your Cluster: cluster0         │  │
│   Access         │  │  Status: ✅ ACTIVE             │  │
│ ⭐ Network       │  │  Region: Asia Singapore         │  │
│   Access         │  │  Tier: M0 (Free)               │  │
│ ⭐ Clusters      │  │  Storage: 512 MB                │  │
│                  │  │                                 │  │
│                  │  │  [Connect] [Manage] [...]       │  │
│                  │  └────────────────────────────────┘  │
│                  │                                       │
└─────────────────┴───────────────────────────────────────┘
```

---

## Connection String Parts Reference

### What You See:
```
mongodb+srv://placement_user:<password>@cluster0.abcd1234.mongodb.net/?retryWrites=true&w=majority
```

### What Each Part Means:
```
mongodb+srv://          = Connection protocol
placement_user          = Your username (you created this)
<password>              = PLACEHOLDER - replace with actual password!
cluster0.abcd1234       = Your cluster ID (auto-generated)
mongodb.net             = MongoDB Atlas domain
retryWrites=true        = Retry failed writes
w=majority              = Write concern setting
```

### For YOUR .env:
```
mongodb+srv://placement_user:YOUR_ACTUAL_PASSWORD@cluster0.abcd1234.mongodb.net/placement_dashboard?retryWrites=true&w=majority
```

---

## Quick Checklist - "What Do I Need?"

☐ **Username**: `placement_user` (you create it in Database Access)
☐ **Password**: Something secure like `YourPassword123` (you create it)
☐ **Cluster URL**: Auto-generated (like `cluster0.abcd1234.mongodb.net`)
☐ **Database**: `placement_dashboard` (add yourself)
☐ **Network Access**: Allow `0.0.0.0/0`

---

## "I Found It!" Template

When you have all parts, fill this in:

```
📍 Username:        placement_user
📍 Password:        _________________ (what you set)
📍 Cluster URL:     cluster0._________ (from MongoDB)
📍 Region Code:     _________ (from Cluster URL)

Final Connection String:
mongodb+srv://placement_user:_________________@cluster0._________.mongodb.net/placement_dashboard?retryWrites=true&w=majority
```

---

## Next: Update Your Code

Once you have the connection string:

1. Open: `backend/.env`
2. Find: `MONGODB_URI=mongodb://localhost:27017/placement_dashboard`
3. Replace with your string
4. Save
5. Restart backend
6. Check logs for: ✅ MongoDB Connected

---

## "Still Lost?" Common Questions

**Q: Where do I see the password?**
A: You set it yourself in "Database Access" - it won't show again, so remember it!

**Q: Where's the cluster URL?**
A: In the "Connect" → "Drivers" window, the long string has it built in.

**Q: Can I use a different database name?**
A: Yes, change `placement_dashboard` to anything you want.

**Q: Is my connection string secret?**
A: YES! It has your password - never share it or commit to git!

**Q: Can I reset my password?**
A: Yes - go to Database Access → Edit User → Regenerate Password

---

## Security Reminder

🔒 **Production Security**:
- Don't use `0.0.0.0/0` - specify your IP or VPC
- Use strong passwords (32+ characters)
- Enable encryption
- Use separate accounts for dev/prod

✅ **For Development**: 
- `0.0.0.0/0` is fine
- Any password works
- Single account is OK

🚨 **NEVER**:
- Commit `.env` to git
- Share your connection string
- Use production password in code

---

## Still Need Help?

1. Follow the menu paths above
2. Compare with MONGODB_ATLAS_SETUP.md
3. Let me know the exact step you're stuck on!
