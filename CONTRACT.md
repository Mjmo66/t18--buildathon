# Build contract (read before you write code)

A 3-hour hackathon build of a volunteering app for St Andrews, Scotland. Charities post volunteer
requests, students volunteer. The audience is University of St Andrews students; the demo runs on
their phones in the browser (passkeys with Face ID / fingerprint).

## Stack
- **Vite + React (web)**, JavaScript/JSX pages, TypeScript allowed in `src/lib/`. React Router.
  Mobile-first: the demo runs in phone browsers. (Decision 2026-11-15: web app instead of
  React Native.)
- Supabase: Postgres + RLS, Auth, Realtime, Edge Functions (Deno). `.env` holds
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`). Never commit keys.
- Hosting: Cloudflare Pages (https://kindred.niklas-sipf.workers.dev (Workers static assets, `wrangler.jsonc`)); `npm run build`, deploy `dist/`.
- Ready to use: `src/lib/supabase.ts` (`supabase`), `src/lib/types.ts`,
  `src/lib/auth/AuthContext.jsx` (`useAuth()` → `{session, user, profile, charity, loading,
  refreshProfile, signOut}`), `src/lib/auth/passkey` (`isPasskeySupported`, `signUpWithPasskey`,
  `signInWithPasskey`, `addPasskeyToCurrentUser`, `PasskeyError`), `src/lib/crypto`,
  `src/lib/chat` (E2E chat API, see its header).
- Installed: `@supabase/supabase-js`, `tweetnacl`, `tweetnacl-util`, `@simplewebauthn/browser`,
  `qrcode.react` (show QR), `@yudiel/react-qr-scanner` (scan QR), `date-fns`.

## Data model
`supabase/migrations/20261115000000_base.sql` is the source of truth. Do not edit it. If you need a
schema change, add `supabase/migrations/2026111501xxxx_<area>.sql`.
Key RPCs: `verify_charity()`, `demo_verify_volunteer()`, `mark_attendance(p_signup, p_attended)`,
`check_in(p_request, p_code)`. Profiles are created by a trigger from auth user metadata
(`role`, `display_name`).

## Folder ownership (only write inside your area)
| Area | Paths |
|---|---|
| Shell (auth screens, routing, layout, shared UI) | `src/App.jsx`, `src/main.jsx`, `src/components/`, `src/pages/auth/`, `src/pages/Home.jsx`, `src/index.css` |
| Charity space | `src/pages/charity/` |
| Volunteer space | `src/pages/user/`, `src/features/matching/` |
| Attendance & rewards | `src/features/attendance/`, `supabase/migrations/*_attendance.sql` |
| E2E chat | `src/lib/crypto/`, `src/lib/chat/`, `src/pages/chat/` |
| Passkeys | `supabase/functions/passkey/`, `src/lib/auth/passkey/` |

Shared files (`src/components/`, `src/lib/types.ts`, `src/index.css`): add, don't rewrite.
Need a dependency? Ask the coordinator instead of editing `package.json`.

## Product rules
- Charity numbers: Scottish charities are registered with OSCR (`SC` + 6 digits, e.g. `SC012345`);
  England & Wales (CCEW) use 6–7 digits; Northern Ireland (CCNI) `NIC` + 6 digits. Normalise to
  upper case without spaces, check the format, then call `verify_charity()` (demo registry lookup).
- Seed data is fictional (no real charity names); places are real St Andrews locations.
- Matching: distance (haversine) within `max_km`, availability overlap (weekday + morning
  06–12 / afternoon 12–17 / evening 17–22), `physical_level <= physical_max`,
  `experience <= volunteer experience`. Score and sort; show distance and why it matched.
- Accountability: accepted volunteer checks in by scanning the charity's QR
  (`{"r": request_id, "c": checkin_code}`) or the charity marks attended / no-show.
  Attended → hours, points (10/hour), badges. No-show → warning; 3 warnings → suspended.
- UI: no explanatory sentence under headings. Mobile first; works at 360 px width on web.

## Branches
Each agent works on its own branch from `integration` and commits there. The coordinator merges.
