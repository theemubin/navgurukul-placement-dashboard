# Plan: Kanban Job Management Board for Coordinator

A visual Kanban board to manage job postings through their lifecycle, with status tracking visible to both coordinators and students.

## Current State Analysis

### Existing Job Model Fields
| Field | Type | Description |
|-------|------|-------------|
| title | String (required) | Job title |
| company | Object | Contains name (required), website, description, logo |
| description | String (required) | Job description |
| requirements | [String] | Array of requirement strings |
| responsibilities | [String] | Array of responsibility strings |
| location | String (required) | Job location |
| jobType | Enum | `full_time`, `part_time`, `internship`, `contract` (default: `full_time`) |
| duration | String | For internships (e.g., "3 months") |
| salary | Object | min, max, currency (default: INR) |
| skills | Array | References to Skill model with required boolean |
| eligibility | Object | minCGPA, schools, campuses, minModule, etc. |
| deadline | Date (required) | Application deadline |
| maxPositions | Number | Default: 1 |
| interviewRounds | Array | Objects with name, type, description, order |
| postedBy | ObjectId | Reference to User |
| applicationCount | Number | Default: 0 |
| status | Enum | **Current:** `draft`, `active`, `closed`, `filled` |

### Current API Endpoints
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | All authenticated | Get all jobs (filtered by role/eligibility) |
| GET | `/matching` | Students only | Get jobs matching student's approved skills |
| GET | `/:id` | All authenticated | Get single job by ID |
| POST | `/` | Coordinator/Manager | Create new job |
| PUT | `/:id` | Coordinator/Manager | Update job |
| DELETE | `/:id` | Coordinator/Manager | Delete job |

---

## Implementation Steps

### Step 1: Extend Job Statuses
**File:** `backend/models/Job.js`

Update status enum to include additional workflow stages:
```
draft → pending_approval → active → on_hold → interviewing → closed → filled
```

**New Status Definitions:**
| Status | Description | Visible to Students |
|--------|-------------|---------------------|
| `draft` | Job being created, not visible | No |
| `pending_approval` | Awaiting manager approval | No |
| `active` | Open for applications | Yes - "Hiring" |
| `on_hold` | Temporarily paused | Yes - "On Hold" |
| `interviewing` | Interview process ongoing | Yes - "Interviewing" |
| `closed` | No longer accepting applications | Yes - "Closed" |
| `filled` | All positions filled | Yes - "Filled" |

---

### Step 2: Create Kanban Board Component
**File:** `frontend/src/pages/coordinator/JobsKanban.jsx`

**Features:**
- Horizontal scrollable board with columns for each status
- Job cards showing: title, company, applications count, deadline
- Drag-and-drop between columns (using @hello-pangea/dnd)
- Quick actions on cards: Edit, View Applications, Delete
- Color-coded columns by status type
- Filter by job type (Jobs/Internships)
- Search functionality

**Column Layout:**
```
| Draft | Pending | Active | On Hold | Interviewing | Closed | Filled |
|-------|---------|--------|---------|--------------|--------|--------|
| Card  | Card    | Card   | Card    | Card         | Card   | Card   |
| Card  |         | Card   |         | Card         |        |        |
```

**Job Card Design:**
```
┌─────────────────────────────┐
│ 🏢 Company Name             │
│ Job Title                   │
│ ─────────────────────────── │
│ 📍 Location  |  💼 Full-time │
│ 📅 Deadline: Jan 15, 2026   │
│ 👥 12 Applications          │
│ ─────────────────────────── │
│ [Edit] [View Apps]          │
└─────────────────────────────┘
```

---

### Step 3: Add API Endpoint for Status Update
**File:** `backend/routes/jobs.js`

Add new endpoint:
```javascript
PATCH /api/jobs/:id/status
Body: { status: 'new_status' }
```

**Validation Rules:**
- Only coordinator/manager can change status
- Validate status transitions (e.g., can't go from `filled` back to `draft`)
- Send notifications on certain transitions (e.g., `active` → notify eligible students)

---

### Step 4: Update Student Jobs View
**File:** `frontend/src/pages/student/Jobs.jsx`

Add status badge to job cards with student-friendly labels:
| Internal Status | Student Label | Badge Color |
|-----------------|---------------|-------------|
| `active` | "Hiring" | Green |
| `on_hold` | "On Hold" | Yellow |
| `interviewing` | "Interviewing" | Blue |
| `closed` | "Closed" | Gray |
| `filled` | "Filled" | Red |

---

### Step 5: Add View Toggle in Coordinator Jobs Page
**File:** `frontend/src/pages/coordinator/Jobs.jsx`

Add toggle buttons:
```
[📋 List View] [📊 Kanban View]
```

---

## Technical Considerations

### 1. Drag-and-Drop Library
**Recommendation:** Use `@hello-pangea/dnd` (maintained fork of react-beautiful-dnd)
- Better accessibility
- Smooth animations
- Well-documented
- Active maintenance

**Alternative:** Native HTML5 Drag API
- Lighter weight
- Less polished UX
- More code to write

### 2. Status Visibility for Students
**Options:**
- **Option A:** Show all statuses with friendly names (recommended)
- **Option B:** Simplified view (Open/In Progress/Closed)

### 3. Status Change Notifications
**Trigger notifications when:**
- Job becomes `active` → Notify all eligible students
- Job moves to `interviewing` → Notify applicants
- Job becomes `closed` or `filled` → Notify applicants

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/models/Job.js` | Modify | Add new status values |
| `backend/routes/jobs.js` | Modify | Add PATCH status endpoint |
| `frontend/src/pages/coordinator/JobsKanban.jsx` | Create | New Kanban board component |
| `frontend/src/pages/coordinator/Jobs.jsx` | Modify | Add view toggle |
| `frontend/src/pages/student/Jobs.jsx` | Modify | Add status badges |
| `frontend/src/services/api.js` | Modify | Add updateJobStatus API call |
| `frontend/package.json` | Modify | Add @hello-pangea/dnd dependency |

---

## Open Questions

1. Should we require manager approval for jobs before they go `active`? (pending_approval flow)
2. Should coordinators be able to move jobs backward in the pipeline (e.g., `interviewing` → `active`)?
3. What happens to applications when a job is put `on_hold`?
4. Should we add a "scheduled" status for jobs that auto-activate on a date?
