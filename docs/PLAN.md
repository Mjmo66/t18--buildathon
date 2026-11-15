# Kindred: hackathon plan

Working title **Kindred**: a volunteering app for St Andrews. Charities post volunteer requests,
students find shifts that fit their location, travel and timetable, check in, earn hours and
badges, and chat end-to-end encrypted. Built in 3 hours as a mobile-first Vite + React web app (decided 2026-11-15 instead of React Native).

The audience is University of St Andrews students. They open the web build on their phones and
sign up live with a passkey (Face ID / fingerprint).

## Architecture

```
 Phones / laptops                      Supabase (London region)
 ┌──────────────────────────┐          ┌───────────────────────────────────────┐
 │ Vite + React web app,    │  HTTPS   │ Auth (sessions)                        │
 │ phone browsers, Router   │ ───────► │ Postgres + row level security          │
 │                          │          │   profiles, charities, volunteer_prefs,│
 │ lib/crypto: NaCl box     │ realtime │   requests, signups, warnings, badges, │
 │ keys stay on the device  │ ◄──────► │   conversations, messages (ciphertext) │
 └──────────────────────────┘          │ RPC: verify_charity, mark_attendance,  │
            ▲                          │      check_in                          │
            │ static web build         │ Edge Function `passkey` (WebAuthn)     │
 Cloudflare Pages (kindred.niklas-sipf.workers.dev)  └───────────────────────────────────────┘
 also serves /.well-known for passkeys
```

- **Vite + React**: one web app, mobile first; students open it on their phones. Passkeys work
  in the browser without a native build.
- **Supabase**: auth, database, realtime chat and edge functions without writing a server.
- **Cloudflare Pages**: free HTTPS hosting for the web build and the passkey domain files.

The full schema is in `supabase/migrations/20261115000000_base.sql`; the rules every agent
follows are in `CONTRACT.md`.

## Features: what is real, what is a demo stand-in

| From the brainstorm | How we build it |
|---|---|
| React Native | Replaced by a Vite + React web app (team decision) |
| Charity passkeys | **Real** WebAuthn passkeys in the browser (edge function + `@simplewebauthn`). Email + password as fallback. |
| Charity Number verification | Format check (Scotland OSCR `SC` + 6 digits, England & Wales 6–7 digits, NI `NIC` + 6 digits) + lookup in a demo registry → "Verified charity" badge. Live OSCR / Charity Commission API is a pitch point. |
| Volunteer verification | Verified flag with a demo "verify" step; real ID checks are a pitch point |
| Preferences: location, travel, time | Built: location, max distance, transport, weekly availability (morning / afternoon / evening), physical level, experience |
| Smart matching | Built: distance within max km + availability overlap + physical and experience filters → score, sorted feed showing why it matched |
| Create request (one-time / recurring, hours, physical, experience, location), close request | Built |
| "Verify if comes" | Charity shows a QR code, volunteer scans it to check in; charity can also mark attended / no-show |
| "Warn" | No-show → warning; 3 warnings → account suspended |
| Rewarding? | Confirmed attendance automatically credits verified hours, 10 points per hour and badges (first shift, 5 h, 20 h, 5 shifts) |
| E2E-encrypted chat | Real: NaCl box keys created on the device; the server stores only ciphertext. 1:1 chats linked to a request, live via Supabase Realtime. |

## Agents and timeline

| Phase | Time | Agents | Output |
|---|---|---|---|
| 0 Contract | 0:00–0:10 | coordinator | `CONTRACT.md`, base schema |
| 1a Parallel start | 0:10–0:50 | Passkeys, Chat core, coordinator | passkey edge function + client · crypto + chat API with tests · Supabase client and auth context in the Vite app |
| 1b Features | 0:50–1:50 | Shell & auth, Charity, Volunteer, Attendance, Chat UI | Charity onboarding + requests + attendance · prefs + matching feed + dashboard · QR check-in, warnings, rewards · chat screens |
| 2 Integration | 1:50–2:30 | Integration + team | Merge, live Supabase, deploy to Cloudflare Pages, full demo run on two phones |
| 3 Polish & pitch | 2:30–3:00 | team | Design pass, demo script, slides |

Each agent works on its own branch from `integration` and only writes inside its own folders
(see `CONTRACT.md`). The coordinator merges into `integration`, then into `main` once it runs.

## Demo flow

1. Charity signs up with a passkey, enters its OSCR number → verified badge.
2. Charity posts "Beach clean at East Sands, Saturday 10:00, 2 h, light, no experience".
3. Student signs up with a passkey, sets location, 2 km walking, Saturday mornings → the beach
   clean is top of their feed.
4. Student signs up for the shift; charity accepts; they chat (🔒 end-to-end encrypted).
5. At the shift, the student scans the charity's QR → 2 verified hours, 20 points, "First shift" badge.
6. Another signup is marked no-show → warning shown on that volunteer's dashboard.

## Setup checklist

- [ ] Supabase project (London), "Confirm email" off, URL + anon key in `.env`
- [ ] Apply schema, seed demo data, deploy the `passkey` function
- [ ] Cloudflare account, `npm run deploy`
- [ ] Set passkey `RP_ID` / `RP_ORIGINS` to the `pages.dev` domain
