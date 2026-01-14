# Changelog

All notable changes to this project are documented below. This project follows a simple date-based changelog.

## [Unreleased] - 2026-01-14

### Fixed
- URL checker: improved Google Drive / Dropbox handling, direct-download candidate generation, and detection of sign-in redirects (now treats sign-in redirects as inaccessible). (backend/utils/urlChecker.js)
- Fixed a ReferenceError in profile loading caused by an undefined `data` variable. (frontend/src/pages/student/Profile.jsx)
- Hardened role checks and added logging to avoid unexpected 403s in role-based authorization. (backend/middleware/auth.js)

### Changed
- Placement cycle flow: students may change their placement cycle to non-active cycles; after a change the student's profile is automatically submitted for approval and Campus POCs are notified. (backend/routes/placementCycles.js, frontend/src/pages/student/Profile.jsx)
- UI/UX tweaks: removed campus "Retry" button and disabled selecting already-active cycles in the profile UI. (frontend/src/pages/student/Profile.jsx)

### Added
- Dev docs and troubleshooting: `DEV-SETUP.md` and `SETUP-GUIDE.md` with commands and quick troubleshooting steps.
- Utility scripts: link checker tests and other scripts added under `backend/scripts/`.

### Misc
- Various small fixes to HMR/component exports, server error handling, and scripts.

Commit reference: e6483d1 (pushed to `main`) 

---

For full details and file-level changes see the commit history on `main`.