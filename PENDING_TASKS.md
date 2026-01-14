# Pending Tasks / Short Roadmap

This file lists actionable, high-priority work discovered during the recent changes (2026-01-14).

## High Priority
- Add unit tests for `checkUrlAccessible` (backend/utils/urlChecker.js):
  - public Drive file -> accessible
  - private Drive -> sign-in redirect / inaccessible
  - Dropbox `dl=0` -> `dl=1` transformation
  - 404 / non-existent file
  - timeout and retry behaviour
- Add integration tests for `/api/utils/check-url` endpoint.
- Add integration tests for `PUT /api/placement-cycles/my-cycle` flow:
  - Student changes to non-active cycle -> profile becomes `pending_approval` and notifications created for campus POCs.
  - Student attempts to change to `active` cycle -> returns 400.

## Medium Priority
- Document test commands and examples in `DEV-SETUP.md` (add test commands & example Drive/Dropbox links).
- Add CI workflow to run tests on PRs and pushes.
- Add provider-specific helpers for Drive/Dropbox to handle large files and confirm content-type edge cases.

## Low Priority / Nice-to-have
- QA checklist with sample links for Drive/Dropbox/OneDrive (public/private/nonexistent).
- Add automatic changelog generation to release workflow.

---

If you want, I can start with the unit tests for `checkUrlAccessible` next and add CI jobs to run these tests.