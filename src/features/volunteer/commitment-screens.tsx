import { useCallback, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Loader2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelReasonLabel } from "@/lib/charity";
import {
  CANCEL_REASONS,
  CANCELLATION_NOTICE_HOURS,
  LATE_CANCEL_PENALTY,
  cancelWindow,
  freeCancellationEnds,
  isPenalised,
} from "@/lib/cancellation";
import {
  findCommitment,
  formatDateTime,
  formatSession,
  myCommitments,
  type CommitmentItem,
} from "./commitments";
import { useCancelCommitment, useVolunteer } from "./hooks";
import { TaskTag } from "./screens";
import { Sheet } from "./sheet";
import { MapLink } from "@/components/shared/map-link";

function CancelNotice({ item }: { item: CommitmentItem }) {
  const window = cancelWindow(item.occurrence.start);
  if (window === "free") {
    return (
      <span className="cancel-chip cancel-chip-free">
        Free cancellation until {formatDateTime(freeCancellationEnds(item.occurrence.start))}
      </span>
    );
  }
  if (window === "late")
    return <span className="cancel-chip cancel-chip-late">Starts within 24 hours</span>;
  return <span className="cancel-chip">Happening now</span>;
}

function CommitmentCard({ item, charityName }: { item: CommitmentItem; charityName: string }) {
  return (
    <Link
      to="/volunteer/commitments/$commitmentId"
      params={{ commitmentId: item.commitment.id }}
      className="opportunity commitment-card"
    >
      <div className="opportunity-top">
        <TaskTag task={item.request.taskType} />
        <CancelNotice item={item} />
      </div>
      <h3>{item.request.title}</h3>
      <p className="charity-line">
        <HeartHandshake /> {charityName}
      </p>
      <div className="opportunity-details">
        <span>
          <CalendarDays />
          {formatSession(item.occurrence)}
        </span>
        <span>
          <MapPin />
          {item.request.location}
        </span>
      </div>
    </Link>
  );
}

export function CommitmentsScreen() {
  const { data, volunteer } = useVolunteer();
  const { cancelled: justCancelledId, accepted: justAcceptedId } = useSearch({
    from: "/volunteer/commitments",
  });
  const { upcoming, cancelled } = myCommitments(data, volunteer.id);
  const justCancelled = cancelled.find((c) => c.commitment.id === justCancelledId);
  const justAccepted = upcoming.find((c) => c.commitment.id === justAcceptedId);

  return (
    <div className="phone-padding">
      <div className="phone-intro">
        <div>
          <span className="eyebrow">Time well given</span>
          <h2>You’re making a difference.</h2>
          <p>
            {upcoming.length} upcoming {upcoming.length === 1 ? "commitment" : "commitments"}
          </p>
        </div>
      </div>

      {justAccepted && (
        <p className="cancel-result" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>
            You’re going to “{justAccepted.request.title}” on{" "}
            {formatSession(justAccepted.occurrence)}. Thank you!
          </span>
        </p>
      )}
      {justCancelled && (
        <p
          className={`cancel-result ${justCancelled.commitment.cancellation?.penalised ? "penalised" : ""}`}
          role="status"
        >
          {justCancelled.commitment.cancellation?.penalised ? (
            <AlertTriangle aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          <span>
            Cancelled “{justCancelled.request.title}”. The charity has been told.{" "}
            {justCancelled.commitment.cancellation?.penalised
              ? `${LATE_CANCEL_PENALTY} points have been taken off for cancelling late.`
              : "No penalty."}
          </span>
        </p>
      )}

      {upcoming.length === 0 ? (
        <div className="empty-state">
          <CalendarCheck2 className="text-primary" />
          <h3>Nothing booked yet</h3>
          <p className="muted text-xs">Requests you accept from the Board will appear here.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/volunteer">Go to the Board</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="commitment-date">COMING UP</p>
          {upcoming.map((item) => (
            <CommitmentCard key={item.commitment.id} item={item} charityName={data.charity.name} />
          ))}
          <p className="readonly-note mt-2">
            <Clock3 /> Cancel for free up to {CANCELLATION_NOTICE_HOURS} hours before. Tap a
            commitment to manage it.
          </p>
        </>
      )}

      {cancelled.length > 0 && (
        <>
          <p className="commitment-date mt-6">CANCELLED</p>
          <ul className="cancelled-list">
            {cancelled.map((item) => (
              <li key={item.commitment.id}>
                <span>
                  <strong>{item.request.title}</strong>
                  {formatSession(item.occurrence)}
                </span>
                {item.commitment.cancellation?.byCharity ? (
                  <span className="by-charity">
                    Cancelled by {data.charity.name}
                    {item.request.cancellation &&
                      `: ${cancelReasonLabel(item.request.cancellation.reasonId)}`}
                    {item.request.cancellation?.message && (
                      <em>“{item.request.cancellation.message}”</em>
                    )}
                  </span>
                ) : item.commitment.cancellation?.penalised ? (
                  <span className="ledger-points ledger-penalty">−{LATE_CANCEL_PENALTY} pts</span>
                ) : (
                  <span className="muted text-xs">No penalty</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function CancelForm({
  item,
  onDone,
  onClose,
}: {
  item: CommitmentItem;
  onDone: () => void;
  onClose: () => void;
}) {
  const cancel = useCancelCommitment();
  const window = cancelWindow(item.occurrence.start);
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const late = window === "late";
  const penalised = late && reasonId !== "" && isPenalised(window, reasonId);

  const submit = async () => {
    if (late && !reasonId) {
      setError("Choose a reason to continue");
      return;
    }
    try {
      await cancel.mutateAsync({
        commitmentId: item.commitment.id,
        ...(reasonId ? { reasonId } : {}),
        ...(note.trim() ? { note } : {}),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t cancel. Please try again.");
    }
  };

  return (
    <div className="cancel-form">
      {late ? (
        <>
          <p className="cancel-warning">
            <AlertTriangle aria-hidden="true" />
            <span>
              This starts in less than {CANCELLATION_NOTICE_HOURS} hours. Cancelling now costs{" "}
              {LATE_CANCEL_PENALTY} points, unless it’s for one of the accepted reasons below.
            </span>
          </p>
          <fieldset className="reason-list">
            <legend>Why do you need to cancel?</legend>
            {CANCEL_REASONS.map((reason) => (
              <label
                key={reason.id}
                className={`reason-option ${reasonId === reason.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={reason.id}
                  checked={reasonId === reason.id}
                  onChange={() => {
                    setReasonId(reason.id);
                    setError("");
                  }}
                />
                <span>{reason.label}</span>
                {reason.excused && <span className="reason-tag">No penalty</span>}
              </label>
            ))}
          </fieldset>
          <label className="cancel-note">
            <span>Anything the charity should know? (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
            />
          </label>
          {reasonId && (
            <p className={`cancel-consequence ${penalised ? "penalised" : ""}`} role="status">
              {penalised
                ? `You’ll lose ${LATE_CANCEL_PENALTY} points.`
                : "No penalty. We hope everything’s OK."}
            </p>
          )}
        </>
      ) : (
        <p className="cancel-free">
          <ShieldCheck aria-hidden="true" />
          <span>
            You’re cancelling more than {CANCELLATION_NOTICE_HOURS} hours before, so there’s no
            penalty. Your spot will go to another volunteer.
          </span>
        </p>
      )}

      {error && (
        <p className="pref-error" role="alert">
          {error}
        </p>
      )}
      <div className="sheet-actions">
        <Button
          variant="destructive"
          className="w-full"
          size="lg"
          onClick={submit}
          disabled={cancel.isPending}
        >
          {cancel.isPending && <Loader2 className="animate-spin" />}
          {penalised ? `Cancel and lose ${LATE_CANCEL_PENALTY} points` : "Yes, cancel"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose} disabled={cancel.isPending}>
          Keep my commitment
        </Button>
      </div>
    </div>
  );
}

export function CommitmentDetailScreen({ commitmentId }: { commitmentId: string }) {
  const { data, volunteer } = useVolunteer();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const item = findCommitment(data, volunteer.id, commitmentId);

  if (!item) {
    return (
      <div className="empty-state">
        <h3>Commitment not found</h3>
        <Button asChild variant="outline" size="sm">
          <Link to="/volunteer/commitments">Back to My commitments</Link>
        </Button>
      </div>
    );
  }

  const { commitment, occurrence, request } = item;
  const window = cancelWindow(occurrence.start);
  const status = commitment.status;

  return (
    <div className="phone-padding">
      <TaskTag task={request.taskType} />
      <h2 className="detail-title">{request.title}</h2>
      <p className="charity-line">
        <HeartHandshake /> {data.charity.name}
      </p>

      <div className="profile-section">
        <div className="detail-row">
          <span>When</span>
          <span>{formatSession(occurrence)}</span>
        </div>
        <div className="detail-row">
          <span>Where</span>
          <span>
            <MapLink location={request.location} postcode={request.postcode} />
          </span>
        </div>
        <div className="detail-row">
          <span>Car</span>
          <span>{request.carNeeded ? "Needed" : "Not needed"}</span>
        </div>
        <p className="opportunity-description">{request.description}</p>
      </div>

      <div className="profile-section">
        <h3>Cancellation</h3>
        {status === "cancelled" ? (
          <p className="muted text-xs">
            You cancelled this on{" "}
            {formatDateTime(commitment.cancellation?.cancelledAt ?? occurrence.start)}.
            {commitment.cancellation?.penalised
              ? ` ${LATE_CANCEL_PENALTY} points were taken off.`
              : " No penalty."}
          </p>
        ) : status !== "accepted" ? (
          <p className="muted text-xs">This session has finished.</p>
        ) : window === "started" ? (
          <p className="muted text-xs">
            This session has started, so it can’t be cancelled. Please contact the charity.
          </p>
        ) : (
          <>
            <p className="muted text-xs mb-3">
              {window === "free"
                ? `Free cancellation until ${formatDateTime(freeCancellationEnds(occurrence.start))}. After that you’ll need a reason, and it may cost ${LATE_CANCEL_PENALTY} points.`
                : `This starts within ${CANCELLATION_NOTICE_HOURS} hours. You can still cancel, but you’ll need to give a reason.`}
            </p>
            <Button
              variant="outline"
              className="w-full cancel-button"
              onClick={() => setSheetOpen(true)}
            >
              Cancel commitment
            </Button>
          </>
        )}
      </div>

      <Sheet open={sheetOpen} onClose={closeSheet} title="Cancel this commitment?">
        <CancelForm
          item={item}
          onClose={closeSheet}
          onDone={() =>
            navigate({ to: "/volunteer/commitments", search: { cancelled: commitment.id } })
          }
        />
      </Sheet>
    </div>
  );
}
