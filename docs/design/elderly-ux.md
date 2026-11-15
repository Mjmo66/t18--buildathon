# Kindred for older and non-tech users: change list

Advisor: Opus (c3). Batch 1, 2026-11-15, reviewed against origin/main 2c48e8b and the screenshots in
`.scratch/design-shots/`. A second, independent review by Fable 5.2 is running; its additions come as batch 2.

## The rules behind every item
1. **One main action per screen**, big and near the top. On phones the main action is sticky at the bottom.
2. **Words beat icons.** Every button and tab shows a text label. No icon-only buttons on the main path.
3. **Bigger and higher contrast.** Body text 18px, tap targets at least 52px tall, no grey text under 4.5:1.
4. **Plain English.** No jargon: pending, recurring, verified, encrypted, passkey, ⌘K, score.
5. **Nothing hidden.** No hover-only, swipe, long-press, collapsible sections, sliders or keyboard shortcuts.
6. **Always say what happened and what comes next.** Ask before anything that can't be undone.
7. **Calm screens.** Fewer chips, fewer numbers, no repeated links, no walls of text.

---

## P1: must have for the demo

### P1.1 Global type, size and contrast (`src/index.css`)
- `html { font-size: 112.5%; }` (18px base). Body `line-height: 1.55`.
- h1 `1.75rem`, h2 `1.35rem`, h3 `1.15rem`.
- `.btn`: `min-height: 52px; font-size: 1.05rem; font-weight: 650; padding: 12px 20px; border-radius: 12px`. Make `.btn-sm` `min-height: 44px; font-size: 1rem`, and stop using `btn-sm` for main actions.
- Fields: `.field-control` `min-height: 52px`, `.field-label` `1rem`, `.field-hint` `0.95rem`.
- **Contrast fail:** `--subtle #8a93a3` is **2.86:1** on `--bg #f4f6f9` and 3.1:1 on white (AA needs 4.5:1). Set `--subtle: #5d6779` (the current `--muted`, 5.3:1) and `--muted: #454e5e`. Use `--subtle` for decorative icons only, never for text.
- **Retire the small uppercase monospace labels** (`.section-label`, `.micro-label`, `.meta`, stat labels, sidebar section labels at 0.65–0.74rem with 0.12em tracking). Use normal sentence case at `0.95rem`, weight 600, `--muted`. Show dates, times and distances in the normal font, not `--mono`: "Thu 19 Nov, 14:00" in monospace looks like code to this audience. Keep `--mono` only for the check-in code.
- Secondary buttons need a visible border (2px `--border-strong`) and a white fill so they still look like buttons. Ghost and text-only buttons are not used for actions.

### P1.2 Force light mode
Remove the `prefers-color-scheme: dark` block and the dark theme. Reason: the dark palette uses mid-grey text on navy, which is harder for ageing eyes, and one look keeps the demo predictable. (Keep the tokens if you want, but don't switch automatically.)

### P1.3 Header and sign out (`src/components/Header.jsx`, `Sidebar.jsx`)
- Remove the icon-only sign-out arrow from the phone header. It sits next to the name and gets tapped by accident. Move **"Sign out"** to the bottom of the Profile page as a full-width secondary button with text, and ask "Sign out of Kindred?" before doing it.
- The header shows just the logo and the page title. The user's name and the "verified" tick can go (the tick means nothing to them).

### P1.4 Volunteer feed (`src/pages/user/Discover.jsx`)
- Title: **"Shifts for you"** instead of "For you".
- Remove the **"Show all" checkbox** and the **icon-only sliders button**. When nothing matches, show one friendly empty state: "No shifts match your times yet." plus two big buttons: **"Show all shifts"** and **"Change my times"**.
- Remove the "Doesn't fit" section from the default view (greyed-out cards look broken).
- Card content: title (large), charity name, then **one line** "Thursday 19 November, 2pm · 2 hours · 10 minutes' walk" in plain text, then a full-width **"See details"** button. Keep at most **one** green reason chip ("Fits your Thursday afternoon"). Remove the amber "Needs some experience" / "Not free…" chips from the card, the category tag and the "recurring" line (say "Every 2 weeks" on the detail page instead).
- Times in 12-hour format with "am/pm" (UK older users), dates with the full weekday ("Thursday 19 November"), and "Tomorrow" / "Today" where true.
- Show distance as walking time if transport is walking ("10 minutes' walk"), otherwise "0.6 miles away". UK older users think in miles.

### P1.5 Shift detail and signing up (`src/pages/user/RequestDetail.jsx`)
- The **"Sign up" button is at the very bottom** (line ~180), two screens down on a phone. Make it a **sticky full-width bar at the bottom**: **"Sign up to help"**. After signing up the bar turns into a green confirmation: "You're signed up. The charity will confirm by message." plus a **"Cancel my place"** text button.
- Collapse the 7-row WHEN / DURATION / WHERE / PHYSICAL / EXPERIENCE / VOLUNTEERS / CATEGORY block into **4 plain lines**, each with an icon and normal-weight text, no uppercase labels:
  - "Thursday 19 November, 2pm to 4pm"
  - "Harbour, St Andrews (10 minutes' walk)" + a **"Open in Maps"** link
  - "Some walking and bending" (physical level in words, not "Moderate")
  - "No experience needed" / "Some experience helps: basic species ID; we bring guides"
- Description goes right under the title, max ~3 lines, with "Read more" only if longer.
- Remove the chip row under the title (it repeats the facts below). "Verified charity" becomes a small "✓ Checked charity" line at most.

### P1.6 Bottom tab bar (`src/components/BottomNav.jsx`, `src/pages/*/links.js`)
- Volunteer: **Find shifts · My shifts · Messages · My profile**. Icons: Search, CalendarCheck, MessageCircle, User. Replace the "sparkles" icon: it has no meaning for this audience.
- Charity (phones): **Home · My requests · Messages · Profile**. "New request" is not a tab; it's the big primary button on Home and on My requests.
- Tab bar: height 72px + safe area, icon 26px, label `0.9rem` weight 600, active tab = brand colour + bold label + a 3px bar on top (not colour alone).

### P1.7 Charity overview (`src/pages/charity/CharityDashboard.jsx`)
- Remove the **⌘K "Jump to…" search** from the sidebar and delete `CommandPalette.jsx` usage.
- Remove the **quick-actions row** (it repeats the sidebar) and the two **collapsible rows** ("Requests", "Volunteers").
- Order: big primary button **"+ Post a new request"** at the top. Then **"To do" list** (rename "Needs attention"), each row with a real button on the right: "Review application" → **"Review"**; "Shift today" → **"Check in volunteers"**. Then the 3 stat cards, relabelled in plain words: "Open requests 4", "Waiting for your reply 2", "Volunteers coming this week 1". Remove the sub-lines "0 filled" / "1.5 h total".
- Sidebar: drop the uppercase section labels (OVERVIEW / REQUESTS / ACCOUNT); a flat list of 5 links with bigger text (1.05rem) is enough.

### P1.8 Hover explanations (owner request): one shared Tooltip, never the only label
- Add a `hint` prop to `src/components/ui/Button.jsx` (and to the icon-button and tab components) that renders a small styled tooltip on **hover and on keyboard focus** (desktop), positioned above, 300 ms delay, dark navy box, white 0.95rem text, max 240px wide. Use `aria-describedby` so screen readers read it. No native `title` (tiny, slow, unstyled).
- **On touch phones don't rely on it:** every button already has a visible text label (P1 rules), so phones need no tooltip. Do not add (i) buttons or long-press: both are hidden interactions and add clutter. Where a phone user truly needs an explanation (sign-up, cancel, check-in), put **one short visible line** under the button.
- Write the hints as "what happens when I press this", e.g.:
  - Sign up to help → "Tell the charity you'd like to come. They'll confirm by message."
  - Cancel my place → "Let the charity know you can't come. You can sign up again later."
  - Post a new request → "Ask for volunteers for a task, a date and a place."
  - Review → "See who applied and accept or decline them."
  - Check in volunteers → "Show a code that volunteers scan when they arrive."
  - Use my location → "Let Kindred find shifts near where you are now."
  - Save → "Keep these choices. Your list of shifts updates straight away."

### P1.9 Sign-up and sign-in wording (`src/pages/auth/Signup.jsx`, `Login.jsx`, `Home.jsx`)
- Nobody in this audience knows "passkey". Button: **"Continue with Face ID or fingerprint"**; the switch link: **"Use a password instead"**. Sign in: **"Sign in with Face ID or fingerprint"**. One visible line under it: "Your phone checks it's you. No password to remember."
- Landing: remove the mono kicker "ST ANDREWS · VOLUNTEERING" and the header "Sign in" button (sign in is already below the two main buttons; one place is enough). Make "Already have an account? Sign in" a real secondary button **"I already have an account"**.
- Landing feature cards: replace "Encrypted chat" with **"Private messages"** and "Verified hours" with **"Your hours recorded"**; "Around your timetable" → **"When it suits you"** (timetable is student language).

### P1.10 Confirmations in plain words
- Replace `window.confirm` in `MyShifts.jsx:69` with a styled dialog: title "Cancel your place?", body "Beach clean at East Sands, Tuesday 17 November, 10am", buttons **"Yes, cancel my place"** (red) and **"No, keep it"** (primary, focused by default). Same pattern for sign out and charity "Mark as no-show".
- After every action show a toast that stays 6 s at the top (not bottom, where the tab bar hides it), large text, with an "Undo" where possible.

---

## P2: should have

### P2.1 Preferences (`src/pages/user/Preferences.jsx`)
- Replace the **distance slider** with 4 big buttons: "Up to 1 mile · 2 miles · 5 miles · Any distance". Sliders are hard with shaky hands.
- Replace the **7×3 availability grid of empty grey boxes** with a list of days, each a row: day name + three big toggle buttons labelled with text **"Morning" "Afternoon" "Evening"** (selected = filled brand colour + ✓ tick + label, unselected = white with border). Add one shortcut button at the top: **"I'm flexible: any time"**.
- Order the page as 3 numbered steps: "1. Where are you?", "2. How far can you travel?", "3. When are you free?". The sticky "Save" bar must not cover content: add bottom padding equal to the bar height. Rename to **"Save my choices"**, and on success show "Saved. Your shifts list is updated." and go to Find shifts.
- "Or pick a place in St Andrews…" dropdown: label it "Or choose your area".

### P2.2 My shifts (`src/pages/user/MyShifts.jsx`)
- Replace the "Upcoming / Past" segmented control with two plain headings on one page: "Coming up" then "Done" (segmented controls look like a label, not a switch, to this audience).
- Status chip "Pending" → **"Waiting for the charity"**; "Accepted" → **"Confirmed: see you there"**; "No-show" → "Missed".
- Don't truncate the title ("Beach clean at East S…"): let titles wrap to 2 lines everywhere.
- "Cancel" button → **"Cancel my place"**; on the shift day show a big **"I've arrived: check in"** button instead.

### P2.3 Profile and rewards (`src/pages/user/Profile.jsx`, `features/attendance/RewardsSummary.jsx`)
- Keep **hours** (useful for references); drop **points** ("30 · 10 per hour" is game noise). Show "3 hours given · 1 shift".
- Badges: show only earned badges; drop the grey locked ones (they look disabled/broken). Keep "Download certificate" as a big button.
- Remove the email in mono under the name. "Verification ✓ Verified" card → one line "✓ Your account is checked" or remove.

### P2.4 QR check-in (`src/features/attendance/ScanCheckin.jsx`, `CheckinQR.jsx`)
- Volunteer button: **"I've arrived: check in"**. Before the camera opens, one line: "Point your camera at the code the organiser shows you." Ask for camera permission only after that tap.
- Always offer the fallback in big text: **"Type the code instead"** with a large numeric field (`inputmode="numeric"`, 28px digits).
- Success screen: "You're checked in. Thank you!" + hours. Remove points, PartyPopper and badge lists here.
- Charity side: title "Show this to volunteers when they arrive", QR as large as the screen allows, and the code in big digits under it for people who can't scan.

### P2.5 Chat and the encryption-key sheet (`src/pages/chat/*`)
- Tab and page: **"Messages"**, not "Chats".
- Hide the key/fingerprint sheet from the main path. Replace the lock button with a small static line in the conversation header: "🔒 Private: only you and {name} can read this". Move "Compare security codes" into a small link inside that line, for the curious. Comparing hex fingerprints in person is meaningless to this audience.
- Message input: 52px tall, 18px text, a **"Send"** button with text (not just an arrow).

### P2.6 Charity request form (`src/pages/charity/RequestNew.jsx`)
- Remove the uppercase fieldset legends (WHAT / WHEN / WHO); use numbered steps "1. What's the task?", "2. When?", "3. Who can help?".
- Replace "One-time / Recurring" segmented control with two big radio cards: "Just once" / "It repeats".
- Physical level and experience: radio cards with words ("Light: mostly sitting or standing", "Moderate: some walking and lifting", "Heavy: lots of lifting"), not dropdowns. Dropdowns hide the options.
- Date input: show the date in UK format and spell it out next to the field ("Monday 16 November").
- Submit button: **"Post this request"**, sticky at the bottom on phones.

---

## P3: nice to have
- **Text size switch** on Profile: "Text size: Normal / Large / Extra large" (sets `html` font-size 18/20/22px). Respect the browser zoom; never `user-scalable=no`.
- Charity overview: a single "Today" card at the very top on shift days, with the one action "Check in volunteers".
- Replace the remaining raspberry badge counts (red dot "3") with words "3 to do": red dots read as errors.
- Reduce motion: honour `prefers-reduced-motion`, no slide-in animations.
- Help: a "Need help? Call us" or "How Kindred works" link at the bottom of Profile, with 3 illustrated steps.

---

## Decisions you asked for
- **(a) ⌘K palette and collapsible rows:** remove both. Keyboard shortcuts and collapsibles hide things; this audience won't find them.
- **(b) Dark mode:** force light.
- **(c) Hover explanations:** one shared Tooltip on `Button` (hover + keyboard focus, `aria-describedby`), never the only label. On phones every button has a visible text label instead, plus one visible line under the few buttons that need it. No (i) buttons, no long-press.
- **(d) Tab bar:** volunteer "Find shifts · My shifts · Messages · My profile"; charity "Home · My requests · Messages · Profile" (see P1.6).

## Flows that will confuse them (summary)
- "Passkey" wording → "Face ID or fingerprint" (P1.9).
- Availability grid of empty boxes and the distance slider (P2.1).
- QR check-in without instructions or a typed-code fallback (P2.4).
- Encryption fingerprint sheet (P2.5).
- Sign-up button two screens down on the detail page (P1.5).
- Icon-only sign-out next to the name (P1.3).

## Owner rules to keep
- No explanatory sentence under section headings. The visible helper lines above sit under **buttons**, only where a misunderstanding would cost something, and stay one short sentence.
- Phone first at 360 px; no horizontal scroll at 18px base.
