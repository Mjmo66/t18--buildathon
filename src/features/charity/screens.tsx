// Shared building blocks for the charity and admin pages.
import type { ReactNode } from "react";
import type { UsersRound } from "lucide-react";
import type { Snapshot, Request } from "@/api/types";
import { Status, filledSpots, requestDate } from "@/components/shared/common";
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function Stat({
  label,
  value,
  foot,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  foot: string;
  icon: typeof UsersRound;
}) {
  return (
    <article className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon />
        </span>
      </div>
      <div className="stat-number">{value}</div>
      <p className="stat-foot">{foot}</p>
    </article>
  );
}
export function RequestTable({
  data,
  requests,
  showPeople = true,
  highlightId,
}: {
  data: Snapshot;
  requests: Request[];
  showPeople?: boolean;
  highlightId?: string | undefined;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Request</th>
            <th>Date & time</th>
            <th>Volunteers</th>
            {showPeople && <th>Accepted by</th>}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const when = requestDate(data, r);
            const count = filledSpots(data, r);
            const names = data.commitments
              .filter((c) => c.status === "accepted" && r.occurrenceIds.includes(c.occurrenceId))
              .map((c) => data.volunteers.find((v) => v.id === c.volunteerId)?.name ?? "Volunteer");
            return (
              <tr key={r.id} className={r.id === highlightId ? "row-new" : undefined}>
                <td>
                  <div className="table-title">{r.title}</div>
                  <div className="table-sub">
                    {r.taskType} · {r.location}
                  </div>
                </td>
                <td>
                  <div className="table-title">{when.date}</div>
                  <div className="table-sub">{when.time}</div>
                </td>
                <td>
                  <div className="capacity">
                    <span>
                      {count} / {r.volunteersNeeded}
                    </span>
                    <div className="capacity-track">
                      {Array.from({ length: r.volunteersNeeded }, (_, i) => (
                        <span key={i} className={`capacity-segment ${i < count ? "filled" : ""}`} />
                      ))}
                    </div>
                  </div>
                </td>
                {showPeople && (
                  <td>
                    {names.length ? (
                      names.map((n) => (
                        <div key={n} className="table-person">
                          <span className="avatar">
                            {n
                              .split(" ")
                              .map((x) => x[0])
                              .join("")}
                          </span>
                          <span className="table-sub">{n}</span>
                        </div>
                      ))
                    ) : (
                      <span className="table-sub">No volunteers yet</span>
                    )}
                  </td>
                )}
                <td>
                  <Status status={r.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="table-footer">
        <span>{requests.length} requests</span>
        <span>Read-only overview</span>
      </div>
    </div>
  );
}
