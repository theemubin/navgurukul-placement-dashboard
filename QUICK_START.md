# NavGurukul API Integration - Quick Start Guide

## 📋 Summary

I've set up a complete integration system to connect NavGurukul's external APIs with your placement dashboard. This allows you to sync student information, attendance data, and other relevant information from the NavGurukul platform.

## ✅ What Was Created

### Backend Files:
1. **`backend/services/navgurukulApiService.js`** - Service to handle all API calls to NavGurukul
2. **`backend/routes/navgurukulIntegration.js`** - API routes for the integration
3. **`backend/server.js`** - Updated to include the new routes

### Frontend Files:
4. **`frontend/src/pages/manager/NavgurukulIntegration.jsx`** - UI component for managers
5. **`frontend/src/pages/manager/NavgurukulIntegration.css`** - Styling for the UI

### Documentation:
6. **`NAVGURUKUL_API_INTEGRATION.md`** - Complete integration guide
7. **`QUICK_START.md`** - This file

## 🚀 How to Get Started

### Step 1: Get Your API Token
Contact NavGurukul to obtain:
- API authentication token
- List of available endpoints
- Data schema/structure

### Step 2: Configure Your Environment
Add to your `backend/.env` file:
```bash
NAVGURUKUL_API_TOKEN=your_actual_token_here
```

### Step 3: Restart Your Backend
```bash
cd backend
npm run dev
```

### Step 4: Add Route to Frontend
Update your manager routes to include the new integration page:

```javascript
// In your App.jsx or router configuration
import NavgurukulIntegration from './pages/manager/NavgurukulIntegration';

// Add this route for managers:
<Route path="/manager/navgurukul" element={<NavgurukulIntegration />} />
```

### Step 5: Test the Integration
1. Navigate to `/manager/navgurukul` in your app
2. Check the connection status
3. Try syncing a single student
4. Test batch sync for a campus

## 🔌 Available API Endpoints

### Backend Endpoints:
```
GET  /api/navgurukul/connection-status        - Check API connection
GET  /api/navgurukul/attendance-config        - Get attendance configurations
GET  /api/navgurukul/student/:id/attendance   - Get student attendance
POST /api/navgurukul/sync-student             - Sync single student
POST /api/navgurukul/batch-sync               - Batch sync students
```

## 📊 What Gets Synced

When you sync a student, the following data is automatically updated:

| NavGurukul Field | Your Database Field |
|-----------------|---------------------|
| Attendance % | `studentProfile.attendancePercentage` |
| Current School | `studentProfile.currentSchool` |
| Joining Date | `studentProfile.dateOfJoining` |

**Note**: You can customize these mappings in `backend/routes/navgurukulIntegration.js`

## 🎯 Common Use Cases

### Use Case 1: Sync a Single Student
```javascript
// API Call
POST /api/navgurukul/sync-student
Body: { "email": "student@navgurukul.org" }
```

### Use Case 2: Sync All Students from a Campus
```javascript
// API Call
POST /api/navgurukul/batch-sync
Body: { "campusId": "campus_mongodb_id" }
```

### Use Case 3: Check Attendance Configuration
```javascript
// API Call
GET /api/navgurukul/attendance-config?isDev=true
```

## 🔧 Customization

### Adding New Endpoints
Edit `backend/services/navgurukulApiService.js`:
```javascript
async getNewData() {
  const response = await this.client.get('/new-endpoint');
  return response.data;
}
```

### Adding New Field Mappings
Edit `backend/routes/navgurukulIntegration.js`:
```javascript
if (externalData.newField) {
  student.studentProfile.newField = externalData.newField;
}
```

## ⚠️ Important Notes

1. **Authentication Required**: The API requires a valid token
2. **Rate Limiting**: Be mindful of API rate limits when batch syncing
3. **Data Validation**: Always validate external data before saving
4. **Error Handling**: Check sync results for failures
5. **Security**: Never expose the API token in frontend code

## 🐛 Troubleshooting

### Problem: 401 Unauthorized
**Solution**: Check your API token in `.env` file

### Problem: Connection Timeout
**Solution**: Verify NavGurukul API is accessible and your internet connection

### Problem: Data Not Syncing
**Solution**: Check console logs and verify field mappings match the API response

## 📚 Next Steps

1. ✅ Get API token from NavGurukul
2. ✅ Add token to `.env` file
3. ✅ Test connection
4. ✅ Add frontend route
5. ✅ Test single student sync
6. ✅ Test batch sync
7. ✅ Customize field mappings as needed
8. ✅ Set up automated syncs (optional)

## 📖 Full Documentation

For complete details, see: `NAVGURUKUL_API_INTEGRATION.md`

## 🆘 Need Help?

- **NavGurukul API Issues**: Contact NavGurukul support
- **Integration Code**: Check the implementation files listed above
- **Data Mapping**: Review `backend/models/User.js` for available fields

---

**Created**: February 16, 2026
**Last Updated**: February 16, 2026
