// Attendance & rewards components. STUBS with the agreed props; the attendance agent replaces
// the bodies, keeping these names and props. Charity and volunteer pages import from here.

/** Charity: QR code a volunteer scans to check in. Payload JSON {"r": request.id, "c": request.checkin_code}. */
export function CheckinQR({ request }) {
  return <div>QR for {request?.title}</div>;
}

/** Charity: list of signups for one request with Accept/Decline and Attended/No-show actions.
 *  Calls onChange() after any change so the parent can reload. */
export function AttendancePanel({ request, onChange }) {
  return <div>Signups for {request?.title}</div>;
}

/** Volunteer: camera scanner that calls check_in(); onCheckedIn(signup) on success. */
export function ScanCheckin({ onCheckedIn }) {
  return <div>Scan to check in</div>;
}

/** Volunteer: hours, points, badges. */
export function RewardsSummary({ profile }) {
  return <div>{profile?.hours_total ?? 0} hours</div>;
}

/** Volunteer: warnings count and suspension notice; renders nothing when there are none. */
export function WarningsBanner({ profile }) {
  return null;
}
