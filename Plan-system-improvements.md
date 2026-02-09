# System Improvements Plan

## Status Tracking
- **Created:** January 10, 2026
- **Last Updated:** January 10, 2026

---

## 🔴 PENDING ITEMS

### AI Integration (Paused)
- [ ] Fix Gemini model compatibility issues
- [ ] Test Google Drive PDF extraction in production
- [ ] Add more job posting site scrapers
- [ ] Consider OpenAI/Claude as fallback options

---

## 📋 NEW REQUIREMENTS (To Implement)

### 1. Enhanced Job Eligibility System

#### 1.1 Requirements Field Enhancement
**Current:** Simple text requirements list
**New:** Interactive requirements with student self-assessment

```
For each requirement:
- Requirement text (entered by coordinator)
- Student response: Yes/No toggle
- Used to calculate match percentage
```

#### 1.2 Required Skills with Proficiency Levels
**Current:** Select skills (binary)
**New:** Select skills + required proficiency level (1-4)

```
Skill Selection UI:
┌─────────────────────────────────────────┐
│ JavaScript    [■■■□] Level 3 required   │
│ React         [■■□□] Level 2 required   │
│ Node.js       [■■■■] Level 4 required   │
└─────────────────────────────────────────┘

Levels:
1 = Beginner
2 = Intermediate  
3 = Advanced
4 = Expert
```

#### 1.3 Eligibility Criteria Restructure
**New Structure:**
```
Education Requirements:
├── 10th Grade
│   ├── Required: Yes/No
│   └── Min Percentage: ___ (optional)
├── 12th Grade
│   ├── Required: Yes/No
│   └── Min Percentage: ___ (optional)
└── Degree
    ├── Required: Yes/No
    └── Specific Degree: Dropdown (only if Yes)
        └── Show only degrees present in active student database

School Requirements:
├── Schools: Multi-select (default: All)
│   └── Show: School of Programming, Business, Finance, etc.
└── Module Requirements (per school):
    └── Select minimum module (hierarchical - lower modules auto-selected)

Campus Requirements:
└── Campuses: Multi-select (default: All)
```

---

### 2. Enhanced Job Matching & Application Flow

#### 2.1 Match Percentage Calculation
**Formula:**
```
Match % = (
  (Matching Skills Score × 40%) +
  (Proficiency Level Match × 30%) +
  (Requirements Match × 20%) +
  (Eligibility Match × 10%)
) / 100
```

**Display:**
- Show "67% Match" badge on job cards
- Color coding: Green (80%+), Yellow (60-79%), Orange (40-59%), Red (<40%)

#### 2.2 Application Flow Based on Match

| Match % | Button | Flow |
|---------|--------|------|
| ≥60% | "Apply" | Direct application |
| <60% | "Show Interest" | Goes to Campus PoC for approval |

**Interest Request Flow:**
```
Student shows interest
    ↓
Campus PoC sees in dashboard
    ↓
├── Approve → Student can apply normally
└── Reject → Must provide reason → Student notified
```

---

### 3. Self-Application Section (Student Side)

#### 3.1 Purpose
Allow students to record jobs they applied to externally (not through platform)

#### 3.2 Fields
```
Self Application Form:
├── Company Name *
├── Job Title *
├── Job Type (Full-time/Part-time/Internship/Contract)
├── Application Date *
├── Source (LinkedIn/Company Website/Referral/Other)
├── Job Link (optional)
├── Contact Person (optional)
├── Status: Applied/In Process/Selected/Rejected
├── Salary Offered (if selected)
└── Notes
```

#### 3.3 Dashboard Impact
- Count in "Total Applications" metric
- Separate section in student applications view
- Campus PoC can view/edit if student doesn't fill

---

### 4. Bulk Upload Feature (Campus PoC)

#### 4.1 Student Data Upload
**CSV Format for Job-Ready Students:**
```csv
email,firstName,lastName,phone,school,module,campus,10thPercentage,12thPercentage,degree,cgpa
student1@ng.edu,John,Doe,9876543210,School of Programming,React,Bangalore,85,78,B.Tech,8.5
```

#### 4.2 Self-Application Bulk Upload
**CSV Format:**
```csv
studentEmail,companyName,jobTitle,jobType,applicationDate,source,status,salaryOffered
student1@ng.edu,Google,SDE Intern,internship,2026-01-05,LinkedIn,In Process,
```

#### 4.3 UI Features
- Download sample CSV button
- Upload with validation
- Error report for failed rows
- Preview before import

---

### 5. Job Readiness Criteria System

#### 5.1 Criteria Configuration (Manager/Campus PoC)
Each school can have custom job readiness criteria.

**Default for School of Programming:**
| # | Criteria | Type | Student Input | PoC Review |
|---|----------|------|---------------|------------|
| 1 | One Real Life Project Done | Yes/No + Link | Project link | Approve/Reject + Comment |
| 2 | One AI Integrated Project Done | Yes/No + Link | Project link | Approve/Reject + Comment |
| 3 | 70%+ on AI Interviewer Tool | Yes/No + Score | Score/Screenshot | Approve/Reject + Comment |
| 4 | LinkedIn Updated + Reviewed | Yes/No + Link | LinkedIn URL | Approve/Reject + Comment |
| 5 | Resume Updated + Reviewed | Yes/No + File | Resume file | Approve/Reject + Comment |
| 6 | Portfolio Updated + Reviewed | Yes/No + Link | Portfolio URL | Approve/Reject + Comment |
| 7 | At least 2 Mock Interviews Done | Yes/No + Count | Interview details | Approve/Reject + Comment |
| 8 | 5 Communication Engagements | Yes/No + List | Activity list | Approve/Reject + Comment |
| 9 | Placement Drive Completed | Yes/No | - | Approve/Reject + Comment |

#### 5.2 Student View
```
Job Readiness Checklist
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Real Life Project Done
   Link: github.com/student/project
   Status: Approved ✓
   PoC Comment: "Great work on the e-commerce project!"

⏳ AI Integrated Project Done  
   Link: github.com/student/ai-project
   Status: Pending Review
   
❌ LinkedIn Updated
   Link: Not submitted
   Status: Not Started

Progress: 4/9 completed (44%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 5.3 Campus PoC View
- See all students' readiness status
- Bulk review pending items
- Add detailed comments per section
- Mark criteria as approved/needs revision

#### 5.4 Schema Design
```javascript
// JobReadinessCriteria Model
{
  school: String, // "School of Programming"
  criteria: [{
    id: String,
    title: String,
    description: String,
    inputType: 'yes_no' | 'yes_no_link' | 'yes_no_file' | 'yes_no_score' | 'yes_no_list',
    required: Boolean,
    order: Number
  }],
  createdBy: ObjectId,
  isActive: Boolean
}

// StudentReadiness (in User model or separate)
{
  student: ObjectId,
  school: String,
  responses: [{
    criteriaId: String,
    completed: Boolean,
    link: String,
    file: String,
    score: Number,
    list: [String],
    submittedAt: Date,
    status: 'pending' | 'approved' | 'revision_needed',
    reviewedBy: ObjectId,
    reviewedAt: Date,
    comment: String
  }],
  overallStatus: 'in_progress' | 'ready' | 'not_started',
  completedCount: Number,
  totalCount: Number
}
```

---

## 📁 Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `backend/models/JobReadinessCriteria.js` | Criteria template per school |
| `backend/models/SelfApplication.js` | Self-reported applications |
| `backend/routes/jobReadiness.js` | Readiness CRUD & review APIs |
| `backend/routes/selfApplications.js` | Self-application APIs |
| `frontend/src/pages/student/JobReadiness.jsx` | Student readiness checklist |
| `frontend/src/pages/student/SelfApplications.jsx` | Self-application form |
| `frontend/src/pages/campus-poc/ReadinessReview.jsx` | PoC review page |
| `frontend/src/pages/campus-poc/BulkUpload.jsx` | CSV upload page |

### Modify Files
| File | Changes |
|------|---------|
| `backend/models/Job.js` | Enhanced eligibility schema |
| `backend/models/User.js` | Add readiness responses to student profile |
| `backend/routes/jobs.js` | Interest request flow, match calculation |
| `backend/routes/applications.js` | Include self-applications in stats |
| `frontend/src/pages/coordinator/JobForm.jsx` | New eligibility UI |
| `frontend/src/pages/student/Jobs.jsx` | Match %, interest button |
| `frontend/src/pages/student/Applications.jsx` | Self-application section |
| `frontend/src/pages/campus-poc/Dashboard.jsx` | Interest requests, readiness stats |

---

## 🗓️ Implementation Priority

### Phase 1 (High Priority)
1. Enhanced Job Eligibility System
2. Match Percentage Calculation
3. Interest Request Flow

### Phase 2 (Medium Priority)
4. Job Readiness Criteria System
5. Self-Application Section

### Phase 3 (Lower Priority)
6. Bulk Upload Feature
7. AI Integration Improvements

---

## ✅ COMPLETED: AI-Assisted JD Parsing (Jan 13, 2026)

### Implementation Summary
- **Code-based hybrid parsing**: Zero quota usage for basic extraction
- **Automatic key rotation**: 2-5 API keys with seamless fallback
- **Graceful degradation**: Never fails completely on quota exhaustion
- **Error code mapping**: Clear error messages (QUOTA_EXCEEDED, RATE_LIMITED, etc)
- **Coordinator Settings**: Personal API key management UI (up to 5 keys)

### Architecture
```
Parse Request
  → Step 1: Code-based extraction (regex) - NO API CALLS
  → Step 2: If minimal results + AI available → Try AI parsing (fills gaps)
  → Step 3: On quota error → Continue with code results (graceful fallback)
```

### Next Steps When Resuming
- Manager global settings UI for multi-key configuration
- Health polling dashboard for quota monitoring
- Integration tests for error scenarios

---

## 📝 Notes
- All percentages should be configurable in Settings
- Consider mobile responsiveness for student checklist
- Add email notifications for status changes
- Ensure backward compatibility with existing jobs/applications
