# Pending Tasks / Short Roadmap

This file lists actionable, high-priority work discovered during the recent changes (2026-01-14).

## High Priority
- [x] Deploy on GitHub: Push the current codebase to the GitHub repository and ensure all sync workflows are active. (Done)
- AI Integration Refinement: Further refine the JD parsing and mapping logic to handle complex job descriptions and ensure 100% accuracy in field mapping.
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
- Fix Discord ID Verification Flow: The frontend (`Profile.jsx` / `Discord.jsx`) uses generic `updateProfile` instead of the dedicated `POST /api/discord/verify-user` endpoint. Currently, users' Discord IDs can never be marked as verified because the backend resets `verified = false` on normal profile updates.
- Implement Strict Discord Verification: Update the `POST /api/discord/verify-user` endpoint to use an actual verification handshake (e.g., DM with OTP or magic link) rather than just validating the ID string format.
- Document test commands and examples in `DEV-SETUP.md` (add test commands & example Drive/Dropbox links).
- Add CI workflow to run tests on PRs and pushes.
- Add provider-specific helpers for Drive/Dropbox to handle large files and confirm content-type edge cases.
- Performance: Check the loading time of the profile section and optimize if necessary.

## Low Priority / Nice-to-have
- QA checklist with sample links for Drive/Dropbox/OneDrive (public/private/nonexistent).
- Add automatic changelog generation to release workflow.

---

If you want, I can start with the unit tests for `checkUrlAccessible` next and add CI jobs to run these tests.