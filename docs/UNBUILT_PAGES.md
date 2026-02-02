# Unbuilt and "Under Construction" Pages

This document identifies pages and components in the Navgurukul Placement Dashboard that are currently in a "Coming Soon", mock data, or partially built state.

## 1. Manager Reports & Analytics
**File:** `frontend/src/pages/manager/Reports.jsx`
- **Current State:** Functional UI but uses **mock data** for monthly trends, company hiring stats, and campus performance.
- **Needed:** Connect to backend aggregation APIs to show real-time statistics instead of hardcoded `monthlyData`.

## 2. Shared Dashboards (Coordinator & Manager)
**Files:** 
- `frontend/src/pages/coordinator/Dashboard.jsx`
- `frontend/src/pages/manager/Dashboard.jsx`
- **Current State:** Basic aggregate stats are shown, but many "Recent Activity" and "Trends" sections are using simplified or static logic.
- **Needed:** Implement a more robust activity stream and detailed performance trends.

## 3. Forum / Questions & Answers
**File:** `frontend/src/pages/coordinator/Forum.jsx` (and related components)
- **Current State:** Basic listing and answering functionality.
- **Needed:** Better search, categorization, and potentially "pinned" questions for common student queries.

## 4. Job Readiness Configuration (Empty States)
**File:** `frontend/src/pages/campus-poc/UnifiedJobReadiness.jsx`
- **Current State:** The framework is there, but if a school doesn't have criteria configured, it shows an empty state that might confuse users.
- **Needed:** Templates or default "Job Readiness" packs that Campus POCs can import with one click.

## 5. Job Pipeline Stages (Management UI)
**File:** `frontend/src/pages/manager/Settings.jsx` (Rubrics, Locations, Companies tabs)
- **Current State:** Functional but basic.
- **Needed:** Better validation and potentially a way to merge duplicate companies or locations.

## 6. Authentication "Parking" Pages
**Files:**
- `frontend/src/pages/auth/AccountInactive.jsx`
- `frontend/src/pages/auth/PendingApproval.jsx`
- **Current State:** Very minimal "Wait for approval" pages.
- **Needed:** Better instructions or a "Contact Support" button.

---
*Last Updated: January 2024*
