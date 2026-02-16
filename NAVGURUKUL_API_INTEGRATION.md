# NavGurukul API Integration Guide

## Overview
This guide explains how to integrate NavGurukul's external APIs with your placement dashboard to sync student information, attendance data, and other relevant information.

## What Are These APIs?

Yes, the curl command you shared is an API endpoint from NavGurukul's platform:

```bash
curl -X 'GET' \
  'https://ghar.navgurukul.org/gharZoho/All_Attendance_Configurations?isDev=true' \
  -H 'accept: application/json'
```

**Endpoint Details:**
- **Base URL**: `https://ghar.navgurukul.org`
- **Endpoint**: `/gharZoho/All_Attendance_Configurations`
- **Method**: GET
- **Authentication**: Required (Bearer Token)

## Setup Instructions

### Step 1: Get Your API Token

You need to obtain an authentication token from the NavGurukul platform. Contact your NavGurukul administrator or check their API documentation to get:

1. **API Token** - A Bearer token for authentication
2. **Available Endpoints** - List of all available API endpoints
3. **Data Schema** - Structure of the data returned by each endpoint

### Step 2: Configure Environment Variables

Add your NavGurukul API token to your `.env` file:

```bash
# NavGurukul External API Integration
NAVGURUKUL_API_TOKEN=your_actual_token_here
```

**Important**: Never commit your `.env` file to version control!

### Step 3: Test the Connection

Once you've added the token, you can test the connection using the provided endpoint:

**Test Connection:**
```bash
GET /api/navgurukul/connection-status
```

This will verify that:
- Your token is valid
- The API is accessible
- Authentication is working correctly

## Available Endpoints

### 1. Get Attendance Configurations
```
GET /api/navgurukul/attendance-config?isDev=true
```

**Description**: Fetches all attendance configurations from NavGurukul

**Query Parameters:**
- `isDev` (boolean): Whether to use development mode

**Response:**
```json
{
  "success": true,
  "data": {
    // Attendance configuration data
  }
}
```

### 2. Get Student Attendance
```
GET /api/navgurukul/student/:studentId/attendance
```

**Description**: Fetches attendance data for a specific student

**Parameters:**
- `studentId` (string): Student ID from NavGurukul system

**Response:**
```json
{
  "success": true,
  "data": {
    "attendance": {
      "percentage": 85.5,
      // Other attendance data
    }
  }
}
```

### 3. Sync Single Student
```
POST /api/navgurukul/sync-student
```

**Description**: Syncs a single student's data from NavGurukul API to your local database

**Request Body:**
```json
{
  "email": "student@example.com"
  // OR
  "userId": "mongodb_user_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Student data synced successfully",
  "data": {
    "student": {
      "id": "...",
      "name": "John Doe",
      "email": "student@example.com"
    },
    "externalData": {
      // Data from NavGurukul API
    }
  }
}
```

### 4. Batch Sync Students
```
POST /api/navgurukul/batch-sync
```

**Description**: Syncs multiple students at once

**Request Body (Option 1 - Specific Emails):**
```json
{
  "emails": [
    "student1@example.com",
    "student2@example.com",
    "student3@example.com"
  ]
}
```

**Request Body (Option 2 - All Students from Campus):**
```json
{
  "campusId": "mongodb_campus_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch sync completed: 8/10 successful",
  "summary": {
    "total": 10,
    "successful": 8,
    "failed": 2
  },
  "results": [
    {
      "email": "student1@example.com",
      "success": true,
      "data": { /* synced data */ }
    },
    {
      "email": "student2@example.com",
      "success": false,
      "error": "Student not found in external system"
    }
    // ... more results
  ]
}
```

### 5. Check Connection Status
```
GET /api/navgurukul/connection-status
```

**Description**: Verifies API connectivity and token validity

**Response:**
```json
{
  "success": true,
  "connected": true,
  "message": "NavGurukul API is accessible"
}
```

## Data Mapping

When syncing student data, the following fields are automatically mapped:

| NavGurukul API Field | Local Database Field |
|---------------------|---------------------|
| `attendance.percentage` | `studentProfile.attendancePercentage` |
| `currentSchool` | `studentProfile.currentSchool` |
| `joiningDate` | `studentProfile.dateOfJoining` |

**Note**: You may need to adjust these mappings based on the actual structure of data returned by NavGurukul's API.

## Usage Examples

### Example 1: Sync a Single Student

```javascript
// Frontend code
const syncStudent = async (email) => {
  try {
    const response = await fetch('/api/navgurukul/sync-student', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    console.log('Sync result:', data);
  } catch (error) {
    console.error('Sync failed:', error);
  }
};

// Usage
syncStudent('student@navgurukul.org');
```

### Example 2: Batch Sync All Students from a Campus

```javascript
// Frontend code
const syncCampusStudents = async (campusId) => {
  try {
    const response = await fetch('/api/navgurukul/batch-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ campusId })
    });
    
    const data = await response.json();
    console.log(`Synced ${data.summary.successful}/${data.summary.total} students`);
  } catch (error) {
    console.error('Batch sync failed:', error);
  }
};
```

### Example 3: Get Student Attendance

```javascript
// Frontend code
const getAttendance = async (studentId) => {
  try {
    const response = await fetch(`/api/navgurukul/student/${studentId}/attendance`, {
      credentials: 'include'
    });
    
    const data = await response.json();
    console.log('Attendance:', data.data);
  } catch (error) {
    console.error('Failed to fetch attendance:', error);
  }
};
```

## Customizing the Integration

### Adding New Endpoints

To add more NavGurukul API endpoints:

1. **Add method to service** (`backend/services/navgurukulApiService.js`):
```javascript
async getStudentProfile(studentId) {
  try {
    const response = await this.client.get(`/api/student/${studentId}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch student profile: ${error.message}`);
  }
}
```

2. **Add route** (`backend/routes/navgurukulIntegration.js`):
```javascript
router.get('/student/:studentId/profile', isAuthenticated, async (req, res) => {
  try {
    const { studentId } = req.params;
    const profile = await navgurukulApiService.getStudentProfile(studentId);
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Customizing Data Mapping

Edit the sync functions in `backend/routes/navgurukulIntegration.js` to map additional fields:

```javascript
// Example: Adding more field mappings
if (externalData.phoneNumber) {
  student.phone = externalData.phoneNumber;
}
if (externalData.gender) {
  student.gender = externalData.gender.toLowerCase();
}
if (externalData.skills) {
  // Map skills data
  student.studentProfile.technicalSkills = externalData.skills.map(skill => ({
    skillName: skill.name,
    selfRating: skill.rating
  }));
}
```

## Troubleshooting

### 401 Unauthorized Error

**Problem**: API returns "No token provided" or "Unauthorized"

**Solutions**:
1. Verify your token is correctly set in `.env`
2. Check if the token has expired
3. Ensure the token format is correct (usually starts with "Bearer ")
4. Contact NavGurukul admin for a new token

### Connection Timeout

**Problem**: Requests timeout or fail to connect

**Solutions**:
1. Check your internet connection
2. Verify the base URL is correct
3. Check if NavGurukul's API is currently available
4. Try increasing the timeout in `navgurukulApiService.js`

### Data Not Syncing

**Problem**: API call succeeds but data doesn't update

**Solutions**:
1. Check the console logs for mapping errors
2. Verify the field names match between NavGurukul API and your schema
3. Ensure the student exists in your local database
4. Check if the external data structure matches your expectations

## Security Best Practices

1. **Never expose the API token** in frontend code
2. **Use environment variables** for sensitive data
3. **Implement rate limiting** to prevent API abuse
4. **Log all sync operations** for audit trails
5. **Validate data** before saving to database
6. **Handle errors gracefully** and don't expose internal errors to users

## Next Steps

1. **Get your API token** from NavGurukul
2. **Add it to your .env file**
3. **Test the connection** using the connection-status endpoint
4. **Explore available endpoints** and customize as needed
5. **Build UI components** to trigger syncs from the frontend
6. **Set up automated syncs** using cron jobs if needed

## Support

For questions about:
- **NavGurukul API**: Contact NavGurukul support
- **Integration code**: Check the implementation in `backend/services/navgurukulApiService.js` and `backend/routes/navgurukulIntegration.js`
- **Data mapping**: Review the User model in `backend/models/User.js`
