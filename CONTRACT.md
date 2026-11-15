# Build contract (read before you write code)

A 3-hour hackathon build of a volunteering app for St Andrews, Scotland. Charities post volunteer
requests, students volunteer. The audience is University of St Andrews students; the demo runs on
their phones through the web build (passkeys with Face ID / fingerprint) and on Expo Go.

## Stack
- Expo (latest SDK), React Native, TypeScript, Expo Router. Targets: iOS, Android, **web** (web is
  the main demo target because passkeys work there without a native build).
- Supabase: Postgres + RLS, Auth, Realtime, Edge Functions (Deno). Project credentials arrive via
  `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Never commit keys.
- Web hosting: Cloudflare Pages (`https://<name>.pages.dev`), also serves `/.well-known/`.

## Data model
`supabase/migrations/20261115000000_base.sql` is the source of truth. Do not edit it. If you need a
schema change, add `supabase/migrations/2026111501xxxx_<area>.sql`.
Key RPCs: `verify_charity()`, `demo_verify_volunteer()`, `mark_attendance(p_signup, p_attended)`,
`check_in(p_request, p_code)`. Profiles are created by a trigger from auth user metadata
(`role`, `display_name`).

## Folder ownership (only write inside your area)
| Area | Owner | Paths |
|---|---|---|
| Foundation | foundation agent | `package.json`, `app.json`, `app/_layout.tsx`, `app/(auth)/`, `components/ui/`, `lib/supabase.ts`, `lib/types.ts`, `lib/auth/context.tsx`, `theme/`, `scripts/seed.mjs`, `supabase/seed.sql` |
| Passkeys | passkey agent | `supabase/functions/passkey/`, `lib/auth/passkey/`, `public/.well-known/`, `public/_headers`, `docs/passkeys.md`, `supabase/migrations/*_passkeys.sql` |
| E2E chat | chat agent | `lib/crypto/`, `lib/chat/`, `features/chat/`, `app/chat/` |
| Charity | charity agent | `app/(charity)/`, `features/charity/` |
| Volunteer | volunteer agent | `app/(volunteer)/`, `features/volunteer/`, `features/matching/` |
| Attendance | attendance agent | `features/attendance/`, `supabase/migrations/*_attendance.sql` |

Shared files (`components/ui/`, `lib/types.ts`): add new exports only, never change existing ones.
Need a dependency that is not installed? Do not edit `package.json`; list it in your final report.

## Pre-installed dependencies (foundation installs these)
`@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `expo-secure-store`,
`tweetnacl`, `tweetnacl-util`, `react-native-get-random-values`, `expo-camera`,
`react-native-qrcode-svg`, `react-native-svg`, `expo-location`, `@simplewebauthn/browser`,
`react-native-passkey`, `react-native-maps` (optional), `date-fns`.

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
