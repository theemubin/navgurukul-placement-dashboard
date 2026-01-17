# Skills — Manager Guide

This document explains the new skills normalization, safety nets, and operational steps managers can use to monitor and maintain skills data.

## Background
- We now store a canonical, case-insensitive form of skill names in the database as `normalizedName` (lowercased + trimmed).
- A unique index enforces that `normalizedName` is unique in the `skills` collection.
- Scripts exist to find mismatches (profiles that reference skill names without `skillId`), migrate profile entries to canonical `skillId`s, and backfill `normalizedName`.

## Why this matters
- Prevents duplicate skills that differ only by case or punctuation (e.g., `JavaScript` vs `javascript`).
- Keeps student profiles consistent by ensuring `technicalSkills` and `softSkills` have the canonical `skillName` and, where possible, an authoritative `skillId`.

## Manager responsibilities
- Review skill mismatch reports periodically.
- If duplicates are found, decide canonical names or allow developers to merge duplicates.
- Ensure only authorized users (coordinators/managers/campus POCs) create new skills to avoid freeform duplicates.

## Useful CLI scripts (run from `backend/`)
- Backfill normalized name and create unique index (safe; will abort if duplicates exist):

  node scripts/backfill_normalized_skill_name.js

- Promote `normalizedName` to unique index (already safe to run once backfill is clean):

  node scripts/promote_normalized_index_unique.js

- Find skill-name mismatches in user profiles (writes `scripts/skill_mismatch_report.json`):

  node scripts/find_skill_mismatches.js

- Migrate `studentProfile.technicalSkills` to use `skillId` where possible:

  node scripts/migrate_skill_ids.js --dry-run
  node scripts/migrate_skill_ids.js

- Check for duplicate normalized names (quick check):

  node scripts/check_skill_duplicates.js


> Files of interest:
> - `backend/scripts/skill_mismatch_report.json` (report output)
> - `backend/scripts/normalized_skill_duplicates.json` (when duplicates are present)

## Emergency procedure (if a user creates a non-normalized skill)
1. Run `node scripts/find_skill_mismatches.js` to generate the latest report.
2. If duplicates are found, open `backend/scripts/normalized_skill_duplicates.json` and choose a canonical skill document to keep.
3. For each duplicate to be removed, re-assign any references in `users.studentProfile.*` to the canonical `skillId` (a merge script can be written if needed).
4. Delete the duplicate skill documents from the `skills` collection.
5. Re-run `node scripts/backfill_normalized_skill_name.js` and `node scripts/promote_normalized_index_unique.js`.

---

If you want, I can add an endpoint to run `find_skill_mismatches.js` on-demand (protected for managers only) which will make it easier to generate reports from the UI. Let me know if you'd like that feature. ✨