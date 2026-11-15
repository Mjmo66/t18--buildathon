import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Ban,
  CalendarDays,
  Car,
  CheckCircle2,
  Loader2,
  MapPin,
  Pencil,
  Send,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { Snapshot } from "@/api/types";
import { Status } from "@/components/shared/common";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { volunteerStanding } from "@/lib/attendance";
import { CHARITY_CANCEL_REASONS, cancelReasonLabel, type RequestSummary } from "@/lib/charity";
import { requiredCredentials, CREDENTIALS } from "@/lib/credentials";
import { useCancelRequest, useCompleteRequest, usePublishRequest } from "./hooks";
import { MapLink } from "@/components/shared/map-link";

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});
const time = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});
const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p.charAt(0))
    .join("");

function CancelRequestForm({ summary, onDone }: { summary: RequestSummary; onDone: () => void }) {
  const cancel = useCancelRequest();
  const [reasonId, setReasonId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const affected = summary.upcomingSignUps;

  return (
    <div className="panel-cancel" role="group" aria-labelledby="cancel-request-title">
      <h3 id="cancel-request-title">Cancel this request?</h3>
      <p className="muted text-xs">
        {affected === 0
          ? "Nobody has signed up to an upcoming session, so no one will be affected."
          : `${affected} ${affected === 1 ? "volunteer has" : "volunteers have"} signed up. We’ll tell them it’s cancelled and they won’t be penalised.`}
      </p>
      <label className="panel-field">
        <span>Reason</span>
        <select
          value={reasonId}
          onChange={(e) => {
            setReasonId(e.target.value);
            setError("");
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "cancel-reason-error" : undefined}
        >
          <option value="">Choose a reason</option>
          {CHARITY_CANCEL_REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="pref-error" id="cancel-reason-error">
            {error}
          </span>
        )}
      </label>
      <label className="panel-field">
        <span>Message to volunteers (optional)</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Sorry, the hall has flooded. We hope to see you soon."
        />
      </label>
      {cancel.isError && <p className="pref-error">{cancel.error.message}</p>}
      <div className="panel-cancel-actions">
        <Button variant="ghost" onClick={onDone} disabled={cancel.isPending}>
          Keep request
        </Button>
        <Button
          variant="destructive"
          disabled={cancel.isPending}
          onClick={() => {
            if (!reasonId) return setError("Choose a reason so we can tell volunteers");
            cancel.mutate(
              { id: summary.request.id, reasonId, ...(message.trim() ? { message } : {}) },
              { onSuccess: onDone },
            );
          }}
        >
          {cancel.isPending && <Loader2 className="animate-spin" />} Cancel request
        </Button>
      </div>
    </div>
  );
}

/** Side panel with everything about one request, and what the charity can do with it. */
export function RequestPanel({
  data,
  summary,
  onClose,
}: {
  data: Snapshot;
  summary: RequestSummary | null;
  onClose: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const publish = usePublishRequest();
  const complete = useCompleteRequest();
  const r = summary?.request;
  const active = r && (r.status === "open" || r.status === "draft");
  const checks = r ? requiredCredentials(r) : [];

  return (
    <Sheet
      open={summary !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCancelling(false);
          onClose();
        }
      }}
    >
      <SheetContent className="request-panel" side="right">
        {summary && r && (
          <>
            <SheetHeader>
              <div className="panel-status">
                <Status status={r.status} />
                <span className="muted text-xs">{r.taskType}</span>
              </div>
              <SheetTitle className="panel-title">{r.title}</SheetTitle>
              <SheetDescription>{r.description}</SheetDescription>
            </SheetHeader>

            {r.status === "cancelled" && r.cancellation && (
              <p className="panel-note panel-note-cancelled">
                <Ban aria-hidden="true" />
                <span>
                  Cancelled: {cancelReasonLabel(r.cancellation.reasonId)}
                  {r.cancellation.message && <> · “{r.cancellation.message}”</>}
                </span>
              </p>
            )}

            <ul className="panel-facts">
              <li>
                <MapPin aria-hidden="true" />{" "}
                <MapLink location={r.location} postcode={r.postcode} />
              </li>
              <li>
                <UsersRound aria-hidden="true" /> {r.volunteersNeeded} volunteers per session
              </li>
              {r.carNeeded && (
                <li>
                  <Car aria-hidden="true" /> Car needed
                </li>
              )}
              <li>
                <ShieldCheck aria-hidden="true" />{" "}
                {checks.length
                  ? `Kindred checks: ${checks.map((c) => CREDENTIALS[c].label).join(", ")}`
                  : "Kindred checks ID, address and references"}
                {` · ${r.requirements.minimumAge}+`}
                {r.requirements.physicalWork && " · physical work"}
              </li>
            </ul>

            <h3 className="panel-heading">
              {summary.sessions.length === 1 ? "Session" : `Sessions (${summary.sessions.length})`}
            </h3>
            <ul className="panel-sessions">
              {summary.sessions.map((s) => (
                <li key={s.occurrence.id} className={s.past ? "is-past" : ""}>
                  <div className="panel-session-top">
                    <span>
                      <CalendarDays aria-hidden="true" />{" "}
                      {when.format(new Date(s.occurrence.start))}–
                      {time.format(new Date(s.occurrence.end))}
                    </span>
                    <span className={s.filled >= s.needed ? "spots-full" : "spots"}>
                      {s.filled} / {s.needed}
                    </span>
                  </div>
                  {s.volunteers.length ? (
                    <ul className="panel-people">
                      {s.volunteers.map(({ volunteer, commitment }) => {
                        const standing = volunteerStanding(data.commitments, volunteer.id).standing;
                        return (
                          <li key={commitment.id}>
                            <span className="avatar">{initials(volunteer.name)}</span>
                            <span>{volunteer.name}</span>
                            {commitment.status === "completed" && (
                              <span className="outcome outcome-came">Came</span>
                            )}
                            {commitment.status === "no-show" && (
                              <span className="outcome outcome-no-show">No-show</span>
                            )}
                            {commitment.status === "accepted" && standing !== "good" && (
                              <span className="standing-badge standing-badge-warning">
                                Has strikes
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="muted text-xs">{s.past ? "Nobody came." : "No one yet."}</p>
                  )}
                </li>
              ))}
            </ul>

            {(publish.isError || complete.isError) && (
              <p className="pref-error">{(publish.error ?? complete.error)?.message}</p>
            )}

            {cancelling ? (
              <CancelRequestForm summary={summary} onDone={() => setCancelling(false)} />
            ) : (
              active && (
                <div className="panel-actions">
                  <Button asChild variant="outline">
                    <Link to="/charity/requests/$requestId/edit" params={{ requestId: r.id }}>
                      <Pencil /> Edit
                    </Link>
                  </Button>
                  {r.status === "draft" && (
                    <Button onClick={() => publish.mutate(r.id)} disabled={publish.isPending}>
                      {publish.isPending ? <Loader2 className="animate-spin" /> : <Send />} Publish
                    </Button>
                  )}
                  {r.status === "open" && (
                    <Button
                      variant="outline"
                      onClick={() => complete.mutate(r.id)}
                      disabled={!summary.allEnded || complete.isPending}
                      title={
                        summary.allEnded ? undefined : "Available once every session has finished"
                      }
                    >
                      <CheckCircle2 /> Mark complete
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="panel-cancel-button"
                    onClick={() => setCancelling(true)}
                  >
                    <Ban /> Cancel request
                  </Button>
                  {r.status === "open" && !summary.allEnded && (
                    <p className="muted text-xs panel-actions-hint">
                      You can mark it complete once every session has finished.
                    </p>
                  )}
                </div>
              )
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
