# Unbuilt and Placeholder Content Documentation

This document identifies pages and features within the Placement Dashboard application that are currently unbuilt, marked as under construction, or utilize mock data.

## 1. Manager Reports & Analytics
- **File:** `frontend/src/pages/manager/Reports.jsx`
- **Status:** Partially Functional (Mocked Data)
- **Details:** 
    - The "Monthly Trends" chart currently uses hardcoded mock data for applications and placements.
    - Integration with actual backend aggregator APIs for monthly trends is required for production use.
    - Export functionality is implemented but relies on the quality of retrieved data.

## 2. Manager Dashboard Conversion Rates
- **File:** `frontend/src/pages/manager/Dashboard.jsx`
- **Status:** Functional with Data Dependency
- **Details:** 
    - Displays conversion rates per coordinator. If coordination/application data is sparse, these percentages may show as 0% or N/A.

## 3. Skills Registry Management
- **File:** `frontend/src/pages/manager/Settings.jsx`
- **Status:** Partially Built (Manual Operations)
- **Details:** 
    - The "Skills Data & Maintenance" section provides instructions and commands for manual scripts (e.g., `backfill_normalized_skill_name.js`) rather than a fully automated one-click UI solution.
    - These scripts must be run via SSH/Terminal on the server.

## 4. Student Job Readiness (Non-Programming Schools)
- **File:** `frontend/src/pages/student/Dashboard.jsx`
- **Status:** Limited Scope
- **Details:** 
    - The "Job Readiness" summary on the student dashboard is currently optimized only for the "School of Programming".
    - Students from other schools (e.g., School of Business) may not see the readiness card if criteria maps are not explicitly defined for their school.

## 5. Maintenance Mode
- **Status:** Not Implemented
- **Details:** 
    - There is currently no "Maintenance Mode" toggle that prevents user access during updates, although some code references "Maintenance" in the context of data cleanup.

---
*Created on: 2026-06-25*
