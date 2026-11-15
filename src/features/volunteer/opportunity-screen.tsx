import { useCallback, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Ban, CalendarCheck2, Check, HeartHandshake, Loader2 } from "lucide-react";
import { acceptRequest } from "@/api/mock-api";
import { DEMO_VOLUNTEER_ID, snapshotQuery } from "@/api/queries";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CANCELLATION_NOTICE_HOURS } from "@/lib/cancellation";
import { checkEligibility, spotsLeft, upcomingOccurrences } from "@/lib/eligibility";
import { formatSession } from "./commitments";
import { useAcceptRequest, useVolunteer } from "./hooks";
import { TaskTag } from "./screens";
import { CancelForm } from "./commitment-screens";
import { Sheet } from "./sheet";
import { MapLink } from "@/components/shared/map-link";

export function OpportunityScreen({ requestId }: { requestId: string }) {
  const { data, volunteer } = useVolunteer();
  const navigate = useNavigate();
  const accept = useAcceptRequest();
  const [cancelOpen, setCancelOpen] = useState(false);
  const closeCancel = useCallback(() => setCancelOpen(false), []);
  const request = data.requests.find((r) => r.id === requestId);
  const sessions = request ? upcomingOccurrences(data, request) : [];
  // Default to the first session that still has room.
  const [chosenId, setChosenId] = useState<string | undefined>(
    () =>
      (request && sessions.find((o) => spotsLeft(data, request, o.id) > 0)?.id) ?? sessions[0]?.id,
  );

  if (!request || request.status === "draft") {
    return (
      <div className="empty-state">
        <h3>Opportunity not found</h3>
        <Button asChild variant="outline" size="sm">
          <Link to="/volunteer">Back to the Board</Link>
        </Button>
      </div>
    );
  }

  const occurrence = sessions.find((o) => o.id === chosenId);
  const eligibility = occurrence ? checkEligibility(data, volunteer, request, occurrence) : null;
  const goingCommitment = occurrence
    ? data.commitments.find(
        (c) =>
          c.volunteerId === volunteer.id &&
          c.occurrenceId === occurrence.id &&
          c.status === "accepted",
      )
    : undefined;
  const requirements = [
    request.carNeeded && "Car",
    request.requirements.dbs && "DBS check",
    `${request.requirements.minimumAge}+`,
    request.requirements.physicalWork && "Physical work",
  ].filter(Boolean);

  return (
    <div className="opportunity-screen">
      <div className="phone-padding">
        <TaskTag task={request.taskType} />
        <h2 className="detail-title">{request.title}</h2>
        <p className="charity-line">
          <HeartHandshake /> {data.charity.name}
        </p>
        <p className="opportunity-description">{request.description}</p>

        {sessions.length === 0 ? (
          <p className="muted text-xs">There are no upcoming sessions for this request.</p>
        ) : sessions.length > 1 ? (
          <fieldset className="session-picker">
            <legend>Choose a session</legend>
            {sessions.map((o) => {
              const left = spotsLeft(data, request, o.id);
              return (
                <label
                  key={o.id}
                  className={`session-option ${chosenId === o.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="session"
                    value={o.id}
                    checked={chosenId === o.id}
                    onChange={() => {
                      setChosenId(o.id);
                      accept.reset();
                    }}
                  />
                  <span>{formatSession(o)}</span>
                  <span className={left ? "spots" : "muted"}>{left ? `${left} left` : "Full"}</span>
                </label>
              );
            })}
          </fieldset>
        ) : null}

        <div className="profile-section">
          {occurrence && (
            <div className="detail-row">
              <span>When</span>
              <span>{formatSession(occurrence)}</span>
            </div>
          )}
          <div className="detail-row">
            <span>Where</span>
            <span>
              <MapLink location={request.location} postcode={request.postcode} />
              {eligibility && (
                <>
                  <br />
                  {eligibility.distanceMiles} miles from home
                </>
              )}
            </span>
          </div>
          <div className="detail-row">
            <span>You’ll need</span>
            <span>{requirements.join(" · ")}</span>
          </div>
          {eligibility && (
            <div className="detail-row">
              <span>Spots left</span>
              <span>
                {eligibility.spotsLeft} of {request.volunteersNeeded}
              </span>
            </div>
          )}
        </div>

        {eligibility && eligibility.notes.length > 0 && !goingCommitment && (
          <div className="eligibility eligibility-notes">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Just so you know</strong>
              <ul>
                {eligibility.notes.map((n) => (
                  <li key={n.code}>{n.message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {eligibility && !eligibility.canAccept && !goingCommitment && (
          <div className="eligibility eligibility-blockers" role="status">
            <Ban aria-hidden="true" />
            <div>
              <strong>You can’t accept this session</strong>
              <ul>
                {eligibility.blockers.map((b) => (
                  <li key={b.code}>{b.message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {accept.isError && (
          <p className="pref-error" role="alert">
            {accept.error.message}
          </p>
        )}
      </div>

      {occurrence && (
        <div className="pref-actions">
          {goingCommitment ? (
            <div className="going">
              <span>
                <CalendarCheck2 aria-hidden="true" /> You’re going
              </span>
              <span className="going-actions">
                <Button asChild variant="outline" size="sm">
                  <Link
                    to="/volunteer/commitments/$commitmentId"
                    params={{ commitmentId: goingCommitment.id }}
                  >
                    Manage
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="cancel-button"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel
                </Button>
              </span>
            </div>
          ) : (
            <>
              <Button
                size="lg"
                className="w-full"
                disabled={!eligibility?.canAccept || accept.isPending}
                onClick={async () => {
                  const commitment = await accept.mutateAsync(occurrence.id);
                  navigate({ to: "/volunteer/commitments", search: { accepted: commitment.id } });
                }}
              >
                {accept.isPending ? <Loader2 className="animate-spin" /> : <Check />} Accept this
                session
              </Button>
              <p className="accept-hint">
                Free cancellation up to {CANCELLATION_NOTICE_HOURS} hours before.
              </p>
            </>
          )}
        </div>
      )}
      {goingCommitment && occurrence && (
        <Sheet open={cancelOpen} onClose={closeCancel} title="Cancel this commitment?">
          <CancelForm
            item={{ commitment: goingCommitment, occurrence, request }}
            onClose={closeCancel}
            onDone={() =>
              navigate({ to: "/volunteer/commitments", search: { cancelled: goingCommitment.id } })
            }
          />
        </Sheet>
      )}
    </div>
  );
}
