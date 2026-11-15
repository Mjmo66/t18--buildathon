import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import { snapshotQuery } from "@/api/queries";
import { TASK_TYPES, type RequestStatus, type TaskType } from "@/api/types";
import { Status } from "@/components/shared/common";
import { Button } from "@/components/ui/button";
import { filterRequests, sortRequests, summariseRequest, type SortKey } from "@/lib/charity";
import { RequestPanel } from "./request-panel";
import { PageHeading } from "./screens";

const STATUS_TABS: { value: RequestStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "draft", label: "Drafts" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={`sort-button ${active ? "active" : ""}`}
        onClick={() => onSort(column)}
      >
        {label} <Icon aria-hidden="true" />
      </button>
    </th>
  );
}

export function RequestsScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const { created, updated } = useSearch({ from: "/charity/requests" });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const [taskType, setTaskType] = useState<TaskType | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "asc",
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const summaries = useMemo(() => data.requests.map((r) => summariseRequest(data, r)), [data]);
  const visible = sortRequests(
    filterRequests(summaries, { query, status, taskType }),
    sort.key,
    sort.dir,
  );
  const counts = Object.fromEntries(
    STATUS_TABS.map((t) => [
      t.value,
      t.value === "all"
        ? summaries.length
        : summaries.filter((s) => s.request.status === t.value).length,
    ]),
  );
  const highlightId = created ?? updated;
  const highlighted = highlightId ? data.requests.find((r) => r.id === highlightId) : undefined;
  const openSummary = openId ? (summaries.find((s) => s.request.id === openId) ?? null) : null;
  const filtering = query !== "" || status !== "all" || taskType !== "all";

  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  return (
    <>
      <PageHeading
        title="Your requests"
        description="Click a request to see who’s coming, edit it, or cancel it."
      >
        <Button asChild>
          <Link to="/charity/create">
            <Plus /> Create request
          </Link>
        </Button>
      </PageHeading>

      {highlighted && (
        <p className="created-banner" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>“{highlighted.title}”</strong>{" "}
            {updated
              ? "is updated."
              : highlighted.status === "draft"
                ? "is saved as a draft. Volunteers can’t see it yet."
                : "is live. Volunteers whose preferences fit will see it on their board."}
          </span>
        </p>
      )}

      <div className="request-toolbar">
        <div className="status-tabs" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={status === t.value}
              className={status === t.value ? "active" : ""}
              onClick={() => setStatus(t.value)}
            >
              {t.label} <span>{counts[t.value]}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <label className="search-box">
            <Search aria-hidden="true" />
            <span className="sr-only">Search requests</span>
            <input
              type="search"
              placeholder="Search requests"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Task type</span>
            <select
              className="toolbar-select"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType | "all")}
            >
              <option value="all">All task types</option>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="table-wrap">
        <table className="requests-table">
          <thead>
            <tr>
              <SortHeader label="Request" column="title" sort={sort} onSort={onSort} />
              <SortHeader label="Next session" column="date" sort={sort} onSort={onSort} />
              <SortHeader label="Volunteers" column="spots" sort={sort} onSort={onSort} />
              <SortHeader label="Status" column="status" sort={sort} onSort={onSort} />
              <th>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => {
              const r = s.request;
              const shown = s.next ?? s.sessions.at(-1);
              return (
                <tr
                  key={r.id}
                  className={`clickable-row ${r.id === highlightId ? "row-new" : ""}`}
                  onClick={() => setOpenId(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(r.id);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`${r.title}, open details`}
                >
                  <td>
                    <div className="table-title">{r.title}</div>
                    <div className="table-sub">
                      {r.taskType} · {r.location}
                    </div>
                  </td>
                  <td>
                    <div className="table-title">
                      {shown ? when.format(new Date(shown.occurrence.start)) : "No sessions"}
                    </div>
                    <div className="table-sub">
                      {s.upcoming.length > 1
                        ? `+${s.upcoming.length - 1} more sessions`
                        : s.next
                          ? "One session left"
                          : "Finished"}
                    </div>
                  </td>
                  <td>
                    {s.next ? (
                      <div className="capacity">
                        <span>
                          {s.next.filled} / {s.next.needed}
                        </span>
                        <div className="capacity-track">
                          {Array.from({ length: s.next.needed }, (_, i) => (
                            <span
                              key={i}
                              className={`capacity-segment ${i < s.next!.filled ? "filled" : ""}`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="table-sub">—</span>
                    )}
                  </td>
                  <td>
                    <Status status={r.status} />
                  </td>
                  <td className="row-chevron">
                    <ChevronRight aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="attendance-empty">
            <Search aria-hidden="true" />
            <p>No requests match.</p>
            {filtering && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setTaskType("all");
                }}
              >
                <X /> Clear filters
              </Button>
            )}
          </div>
        )}
        <div className="table-footer">
          <span>
            Showing {visible.length} of {summaries.length} requests
          </span>
          <span>Click a column heading to sort</span>
        </div>
      </div>

      <RequestPanel data={data} summary={openSummary} onClose={() => setOpenId(null)} />
    </>
  );
}
