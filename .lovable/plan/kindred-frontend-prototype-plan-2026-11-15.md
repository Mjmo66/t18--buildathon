# Kindred — frontend prototype plan

## Product and design
- Suggested app name: **Kindred**. Suggested fictional charity: **Thistle Community Care**, based in Edinburgh, Scotland. These are invented names, not real organisations.
- One charity with varied needs: food-bank packing, delivery driving, befriending, admin, events and heavy lifting.
- Shared blue and raspberry palette, pale cool background and dark neutral text. Use **Outfit** for headings and **Figtree** for body text, clear icons and generous tap targets.
- Frontend only: no backend, database, real login or external verification services. Mock changes last for the current browser session and reset on reload.

## Step 1 — the only implementation in the first review
1. Replace the blank home page with a simple simulated sign-in screen offering Volunteer, Charity and Admin roles. Selecting a role opens its workspace; every workspace has a way to return to role selection.
2. Build the shared colours, typography, buttons, badges, form controls and navigation styles.
3. Build the Volunteer phone shell: about **390 × 844px**, centred on a plain desktop background; fills an actual phone screen. Keep the header and bottom tabs fixed within the shell, with scrolling content between them.
4. Volunteer tabs: **Board**, **My commitments**, **Profile**. Show read-only mock summaries, an illustrative set of opportunities and a verified profile. Do not label this initial board as personalised: preference filtering comes in step 3. No editable preferences, ON/OFF interaction or acceptance yet.
5. Build the full-width Charity laptop shell with sidebar entries **Dashboard**, **Requests**, **Create request**, **Profile**. Show summary counts, a read-only request table and profile. The Create request destination is an unfinished form view, not a working submission flow.
6. Build the matching Admin shell with **Verifications** and **Unfilled requests** tables. Show pending mock volunteers and the single charity's verification record; approval and rejection are not active yet.
7. Add realistic mock records through one central API layer and check role navigation, phone sizing and laptop/tablet layouts.

**Review checkpoint:** stop after step 1. You test the design, role switching, navigation and sample content before further work starts. Later-stage actions will not pretend to work; read-only status or disabled controls will make unfinished actions clear.

## Remaining stages — each requires its own review
2. **Volunteer preferences and availability:** validated editable profile/preferences, postcode, travel distance, car ownership and willingness, can/cannot task lists, weekly availability, blocked dates and ON/OFF toggle. Age, DBS and physical-work eligibility are editable profile fields.
3. **Volunteer workflow:** all matching rules, request details in a phone-friendly sheet or full screen, acceptance, cancellation and My commitments. Only verified, switched-on volunteers see matched requests. Prevent overlapping commitments, enforce remaining capacity and remove full requests from the board. Include sign-up and pending/verified/rejected/expired status views.
4. **Charity workflow:** validated sign-up and registered charity number; create/edit one-off and recurring requests; sortable/filterable dashboard and requests table; accepted-volunteer details; mark complete and close actions.
5. **Admin workflow:** approve/reject volunteer and charity verifications and inspect open requests with no accepted volunteers.
6. **Polish:** loading and empty states, accessible controls, error feedback and phone/laptop layout checks.

## Technical approach
- Retain the existing **React 19 + TypeScript + TanStack Start/TanStack Router** project with **Tailwind CSS v4** and shared shadcn components. No framework replacement or server-side application logic.
- Separate routes for each screen; the root route renders the simulated login. Role selection is for testing only, not a security boundary.
- Central semantic design tokens in `src/styles.css`; shared controls and layouts consume those tokens.
- Central browser-safe mock API returns promises and owns all data access/mutations. Screens call API functions, never import fixture records directly. TanStack Query coordinates reads and refreshed results when mutations are added.
- Keep postcode-distance, schedule matching, requirements and overlap calculations in a separate pure module. Use mock coordinates and Europe/London scheduling; recurring requests have explicit occurrence records for matching and commitments.
- Use Vitest for concrete filtering, capacity, verification and double-booking rules when those rules are implemented. Test each stage's relevant flows in the browser before its review.

### Folder structure
```text
src/
  api/
    types.ts              shared API data contracts
    fixtures.ts           single source of mock records
    mock-api.ts           getRequests(), getVolunteer(), getCharity(), etc.
    queries.ts            query definitions used by screens
  components/
    ui/                   shared design controls
    layouts/              Volunteer phone shell and desktop sidebar shell
    shared/               role selector, status badges and summary elements
  features/
    volunteer/            volunteer screen content and later forms
    charity/              charity screen content and later forms
    admin/                verification and unfilled-request views
  lib/
    matching.ts           pure matching and overlap rules, added in step 3
    matching.test.ts      concrete rule tests, added with matching
  routes/
    __root.tsx            shared providers and page head defaults
    index.tsx             simulated sign-in / role selection
    volunteer.tsx         phone layout with child screen outlet
    volunteer.index.tsx   Board
    volunteer.commitments.tsx
    volunteer.profile.tsx
    charity.tsx           desktop layout with child screen outlet
    charity.index.tsx     Dashboard
    charity.requests.tsx
    charity.create.tsx
    charity.profile.tsx
    admin.tsx             desktop layout with child screen outlet
    admin.index.tsx       Verifications
    admin.unfilled.tsx
  styles.css              shared design tokens and layout styles
```

### Mock data shape
- **Volunteer:** ID, name, email, home postcode/coordinates, verification status, available ON/OFF state, maximum distance, car ownership/willingness, can/cannot task types, weekly time windows, blocked dates, age, DBS status and physical-work eligibility.
- **Charity:** ID, fictional name, contact details, Scottish postcode/coordinates, fictional registration number and verification status. Exactly one charity record.
- **Request:** ID, charity ID, title/description, task type, location/coordinates, car requirement, DBS/minimum-age/physical-work requirements, volunteers needed, lifecycle status, one-off/recurring schedule and occurrence IDs.
- **Occurrence:** ID, request ID, start/end times and occurrence date. Explicit instances make recurring matching and overlap checks unambiguous.
- **Commitment:** ID, volunteer ID, occurrence ID and accepted/cancelled/completed status. Filled spots are derived from active commitments, not separately editable counts.
- **Verification:** ID, subject type/ID, submitted date, status and optional rejection reason.
- Example API functions: `getVolunteer()`, `getCharity()`, `getRequests()`, `getCommitments()`, `getVerifications()`; later add `updatePreferences()`, `setAvailable()`, `acceptRequest()`, `cancelCommitment()`, `createRequest()`, `updateRequest()` and `reviewVerification()`.

Seed a small mix of verified/pending/rejected/expired volunteers and the single charity's varied requests, including partially filled, full and unfilled examples. Keep demo dates together so availability and commitments are consistent.

## Approval
Approve this plan to begin **step 1 only**, using the suggested names unless you request a different name.