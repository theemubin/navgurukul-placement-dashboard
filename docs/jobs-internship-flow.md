# Jobs & Internships — End-to-End Application Flow

This document defines the canonical flow from job/internship posting to placement completion, responsibilities for coordinators and PoCs, expected UI/UX, APIs, timeline events, and acceptance criteria. **Council and Paid Projects flows are currently paused** — this doc focuses on Jobs and Internships only.

---

## 1) High-level summary ✅
- Students apply to Jobs/Internships (existing `Application` model).
- Coordinators manage job lifecycle and candidate progression (shortlist, interview, HR, offer).
- All important state changes are recorded in an immutable `timeline` on the `Application` and produce in-app notifications (and optionally email/SMS).
- When a student **accepts an offer** (presses "Accept Offer" CTA in-app), the system will:
  1. Mark application status as `selected` (or `placed` internally),
  2. Create a placement record (if your system tracks placements separately), and
  3. Update the student's `placementCycle` / `placement status` fields where applicable.

This reduces manual steps and eliminates human error in marking placements after offer acceptance.

---

## 2) Status model & nextStep (DB changes) 🔧
Add or confirm these fields on `Application` (and only those that don't exist yet):

- status: enum [
  'applied', 'under_review', 'shortlisted', 'interview_scheduled', 'hr_call_expected', 'interviewing',
  'offer_pending', 'offered', 'accepted', 'rejected', 'withdrawn', 'placed'
]

- nextStep: {
  type: 'hr_call' | 'interview' | 'assignment' | 'onsite' | 'task' | 'follow_up',
  description: String,
  dueDate: Date (optional),
  contact: { name, phone, email } (optional),
  status: 'pending'|'notified'|'confirmed'|'done'
}

- timeline: [{ event, actorId, actorRole, message, metadata, createdAt }]

- placement: {
  placedAt: Date,
  jobId: ObjectId,
  employerDetails: { company, name, contact },
  package: Number (optional),
  declaredBy: ObjectId (user id who recorded it) -- in this case system user when auto-placed
}

Notes:
- `accepted` is a student-driven status (action taken by student); `placed` is the final confirmed placement state.
- Some systems may prefer to map `accepted` directly to `placed` when acceptance implies onboarding is complete — choose the variant that matches operational policy.

---

## 3) API endpoints (suggested) 📡
- POST /roles/:roleId/apply (student) — creates application (existing)
- POST /applications/:id/next-step (coordinator) — create/update nextStep, add timeline entry, send notifications
- PUT /applications/:id/status (coordinator or PoC depending on role) — update status and append timeline
- POST /applications/:id/offers — coordinator creates offer (payload includes offer letter URL, package, expiry date, next steps)
- POST /applications/:id/accept-offer (student) — student accepts the offer; server sets status to `accepted` and initiates auto-placement
- POST /applications/:id/decline-offer (student) — decline and set status to `rejected` (or `offer_declined` if desired)
- GET /applications/:id/timeline — read-only timeline for UI

Server-side behavior:
- When `accept-offer` is called: validate offer is valid & not expired, then set `status: 'accepted'`, add timeline event, create placement object, set `placement.placedAt = now`, and send notifications to student, coordinator, and manager teams.

---

## 4) UI flows & UX components 🖥️
### Coordinator UI (Jobs list & Job details)
- Candidate list with bulk-select checkboxes + Bulk Actions bar: Shortlist, Schedule Interview, Send Offer, Reject.
- Application detail includes: Current status badge, **Next Step** card, Timeline, Upload/Attach offer letter button, and `Send Offer` action which opens an Offer modal (include expiry date and attachments).
- Offer modal: `package`, `expiryDate`, `offerLetter` (upload or link), `privateNotes` (internal), `publicMessage` (optional, shown to student on offer).
- Bulk Offer: allow sending standardized offers to selected students (with per-student override capability).

### Student UI (My Applications)
- Application card: Top-left `Status` badge, top-right `CTA` area.
- When an offer exists, show a prominent **Offer** card with: employer, package, summary, `View Letter`, `Accept Offer`, `Decline Offer`, and `Ask question` actions.
- When student clicks **Accept Offer**:
  - Show confirmation modal: “Accepting will mark your application as accepted and update your placement status. Continue?”
  - On confirm: call `POST /applications/:id/accept-offer` and show success banner `Offer accepted — Congratulations!` and the Placement card (showing start date, employer onboarding instructions).
- Next Steps card: reflects `nextStep` data (HR call, interview, task). Include `Confirm availability` & `Request reschedule` and `Mark done` buttons.

### Notifications & Emails
- When coordinator creates nextStep or sends offer → in-app notification + email with clear CTA links (Open application, Confirm, Accept Offer).
- Reminder flows: 48/24/1 hour reminders for nextStep and offer expiry.

---

## 5) Timeline & audit 🗂️
Every action should append a timeline entry with:
- event: 'status_update'|'offer_created'|'offer_accepted'|'offer_declined'|'next_step_added'|'next_step_confirmed' etc.
- actorId & actorRole (student|coordinator|poc|system)
- message: human-readable summary
- metadata: optional JSON ({offerId, steps, contact})

This gives a complete, auditable record and drives UI event history display.

---

## 6) Edge cases & operational rules ⚠️
- Offer expiry: after expiry, offers cannot be accepted; a coordinator must re-issue.
- Multiple offers:
  - If multiple offers exist, accepting one triggers auto-decline of other active offers (optional policy—specify in deployment).
- Auto-placement policy:
  - On accept-offer: create `placement` and set `status: 'placed'` or `application.status = 'accepted'` and `placement.placedAt` set. If `accepted` should equate to `placed`, update both.
- Admin overrides: managers/coordinators can mark `placed` manually in extenuating circumstances.

---

## 7) Tests & acceptance criteria ✅
- Unit tests:
  - Accept-offer: valid offer → status changes; placement record created; timeline includes 'offer_accepted'.
  - Expired offer → accept-offer returns 400 and no changes applied.
- Integration tests:
  - Coordinator sends offer → student sees Offer card → student accepts → DB shows placement and student `placementCycle` updated (if applicable).
  - Bulk-offer flow: send offers to N students → students see their offers separately.

Acceptance conditions:
- Student acceptance auto-creates placement and updates status without manual coordinator action.
- Next step creation is reflected immediately in student UI with confirm/reschedule options.

---

## 8) Monitoring & metrics 📊
- Metrics to track:
  - timeToOffer: median time from `applied` -> `offered`.
  - timeToAccept: median time from `offered` -> `accepted`.
  - placementRate: selected / applied.
  - outstandingNextSteps: count of pending nextSteps due in next 7 days.
- Alerts:
  - If `applied` → no action > X days, notify coordinator.
  - If offer expiry approaches with no response, auto-remind & notify coordinator.

---

## 9) Rollout plan & migration steps 🚀
1. Add DB fields and migration to ensure `timeline`, `nextStep`, `placement` are present (with default nulls).
2. Add API endpoints for offer creation and `accept-offer` handling (include transactional behavior to avoid double-accepts).
3. Add UI: Offer modal (coordinator) and Offer card (student) + Next Step UI.
4. Add background jobs for reminders and offer expiry handling.
5. Add tests and run a small pilot with a single coordinator/campus.

---

## 10) Short checklist for devs & ops ✔️
- [ ] Data model changes: add fields + migration script.
- [ ] Offer endpoints + server-side validation (expiry, one-off accept).
- [ ] Student `accept-offer` endpoint to create placement and timeline entry.
- [ ] UI updates: coordinator offer modal & student Offer card + Next Step components.
- [ ] Background reminders & metrics pipeline.
- [ ] Tests (unit + integration) and docs updates (`docs/jobs-internship-flow.md`).

---

If you'd like, I can next:
1) Draft the DB migration and model updates (schema diff + migration script), or
2) Implement the `accept-offer` API and its server-side logic (with tests), or
3) Mock the UI components and add the student acceptance flows to the frontend (component + API wiring).

Which should I start with? 🔁