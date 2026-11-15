# Attendance & rewards

Code: `src/features/attendance/` · schema: `supabase/migrations/20261115000000_base.sql` and
`20261115010000_attendance.sql`.

## Flow
1. Volunteer applies (`signups.status = 'applied'`).
2. Charity accepts or declines in `AttendancePanel` (plain `update signups set status`, allowed by
   the `signups_charity_decide` policy).
3. At the shift the charity shows `CheckinQR` (payload `{"r": request.id, "c": checkin_code}`, plus a
   6-character code for manual entry). The volunteer scans it with `ScanCheckin` → `check_in`.
   The charity's panel updates live (Realtime on `signups`, filtered by `request_id`).
4. Or the charity marks **Attended** / **No-show** (`mark_attendance`); No-show asks for confirmation.
5. One-time shifts: accepted signups still unmarked 24 h after the shift ended become no-shows
   (`sweep_no_shows`, called by `AttendancePanel` when it opens such a request).

## RPCs
| RPC | Caller | Effect |
|---|---|---|
| `check_in(p_request, p_code)` | volunteer | code must match; marks the caller's accepted signup nearest to now as attended |
| `mark_attendance(p_signup, p_attended)` | owning charity | attended or no-show |
| `sweep_no_shows(p_request default null)` | owning charity | no-shows for its one-time requests 24 h after the shift; returns the count |

All three end in `_apply_attendance`, which is idempotent (an attended / no-show signup is not changed again).

## Rules
- Attended: `hours_credited = duration_hours`, `hours_total += hours`, `points += round(hours × 10)`.
- Badges: `first_shift` (1 attended shift), `regular` (5 shifts), `five_hours` (5 h), `twenty_hours` (20 h).
- No-show: one warning row, `warnings_count + 1`; at 3 warnings `suspended = true`, and the
  `signups_insert` policy blocks new signups.
- One-time requests switch to `filled` when accepted + attended + no-show signups reach `slots`
  and back to `open` below that (triggers); `closed` and recurring requests are left alone.

## Components (`src/features/attendance`)
`CheckinQR({request})`, `AttendancePanel({request, onChange})`, `ScanCheckin({onCheckedIn})`,
`RewardsSummary({profile})` (badges + printable certificate via `window.print()`),
`WarningsBanner({profile})`.

## Known gaps
- `requests.checkin_code` is readable by every signed-in user (`requests_read` uses `true` and
  covers all columns), so a volunteer could check in without being there. Fix later with a view or
  column grants; the manual-code fallback in `ScanCheckin` relies on reading it for the volunteer's
  own accepted requests.
- Recurring requests: no automatic no-shows or `filled` status.
