import { AlertTriangle, Ban, ShieldCheck } from "lucide-react";
import type { Snapshot, Volunteer } from "@/api/types";
import {
  SUSPEND_AT_STRIKES,
  strikeExpiresAt,
  volunteerStanding,
  type Standing,
} from "@/lib/attendance";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});
const shortDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

function strikeDetails(data: Snapshot, volunteer: Volunteer) {
  const { strikes, standing, attended } = volunteerStanding(data.commitments, volunteer.id);
  const detailed = strikes.map((strike) => {
    const occurrence = data.occurrences.find((o) => o.id === strike.occurrenceId);
    const request = occurrence && data.requests.find((r) => r.id === occurrence.requestId);
    const expires = strikeExpiresAt(strike);
    return {
      id: strike.id,
      title: request?.title ?? "A session",
      when: occurrence ? shortDate.format(new Date(occurrence.start)) : "",
      expires: expires ? dateFormat.format(expires) : "",
    };
  });
  return { strikes: detailed, standing, attended };
}

const MESSAGES: Record<
  Exclude<Standing, "good">,
  { title: string; body: (n: number) => string }
> = {
  warning: {
    title: "You missed a session",
    body: (n) =>
      `That’s strike ${n} of ${SUSPEND_AT_STRIKES}. If you can’t make something, cancel in My commitments so the charity can find someone else.`,
  },
  "final-warning": {
    title: "Final warning",
    body: (n) =>
      `You’ve missed ${n} sessions. One more and you won’t be able to accept new requests for a while.`,
  },
  suspended: {
    title: "You can’t accept new requests right now",
    body: (n) =>
      `You’ve missed ${n} sessions in the last six months. Your strikes will expire over time, or contact the Kindred team if something’s gone wrong.`,
  },
};

/** Warning shown at the top of the Board when a volunteer has strikes. */
export function StandingBanner({ data, volunteer }: { data: Snapshot; volunteer: Volunteer }) {
  const { strikes, standing } = strikeDetails(data, volunteer);
  if (standing === "good") return null;
  const message = MESSAGES[standing];
  const latest = strikes[0];
  return (
    <div className={`standing-banner standing-${standing}`} role="status">
      {standing === "suspended" ? <Ban aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
      <div>
        <strong>{message.title}</strong>
        <p>
          {latest && standing === "warning" ? `${latest.title}, ${latest.when}. ` : ""}
          {message.body(strikes.length)}
        </p>
      </div>
    </div>
  );
}

/** "Reliability" section on the volunteer's Profile. */
export function ReliabilitySection({ data, volunteer }: { data: Snapshot; volunteer: Volunteer }) {
  const { strikes, standing, attended } = strikeDetails(data, volunteer);
  return (
    <div className="profile-section">
      <h3>Reliability</h3>
      <div className="detail-row">
        <span>Sessions attended</span>
        <span>{attended}</span>
      </div>
      <div className="detail-row">
        <span>Strikes</span>
        <span className={standing === "good" ? "" : "strike-count"}>
          {strikes.length} of {SUSPEND_AT_STRIKES}
        </span>
      </div>
      {standing === "good" ? (
        <p className="reliability-good">
          <ShieldCheck aria-hidden="true" /> In good standing. Thank you for turning up!
        </p>
      ) : (
        <>
          <StandingBanner data={data} volunteer={volunteer} />
          <ul className="strike-list">
            {strikes.map((s) => (
              <li key={s.id}>
                <span>
                  <strong>{s.title}</strong>
                  {s.when}
                </span>
                <span className="muted">Expires {s.expires}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted text-xs mt-3">
        Charities confirm who came after each session. Missing a session without cancelling is a
        strike. Strikes last six months, and {SUSPEND_AT_STRIKES} strikes pauses new requests.
      </p>
    </div>
  );
}
