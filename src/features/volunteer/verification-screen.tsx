import { useCallback, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Clock3,
  FileUp,
  Loader2,
  Plus,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { CredentialType, Snapshot } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  CREDENTIALS,
  credentialState,
  latestCredential,
  tasksUnlockedBy,
  verificationProgress,
  type CredentialState,
} from "@/lib/credentials";
import { londonToday } from "@/lib/london-time";
import { formatLongDate } from "./format";
import { useSubmitCredential, useVolunteer } from "./hooks";
import { Sheet } from "./sheet";

const STATE_LABEL: Record<CredentialState, string> = {
  missing: "Not added",
  pending: "Being checked",
  verified: "Verified",
  expired: "Expired",
  rejected: "Not accepted",
};

function StateBadge({ state }: { state: CredentialState }) {
  const Icon = {
    missing: Plus,
    pending: Clock3,
    verified: BadgeCheck,
    expired: AlertTriangle,
    rejected: XCircle,
  }[state];
  return (
    <span className={`cred-badge cred-${state}`}>
      <Icon aria-hidden="true" /> {STATE_LABEL[state]}
    </span>
  );
}

function CredentialRow({
  data,
  volunteerId,
  type,
  onAdd,
}: {
  data: Snapshot;
  volunteerId: string;
  type: CredentialType;
  onAdd: (type: CredentialType) => void;
}) {
  const info = CREDENTIALS[type];
  const credential = latestCredential(data, volunteerId, type);
  const state = credentialState(credential);
  const unlocks = tasksUnlockedBy(type);
  const action =
    state === "missing"
      ? "Add"
      : state === "expired"
        ? "Renew"
        : state === "rejected"
          ? "Send again"
          : null;
  return (
    <li className="cred-row">
      <div className="cred-main">
        <div className="cred-title">
          <strong>{info.label}</strong>
          <StateBadge state={state} />
        </div>
        <p className="cred-desc">{info.description}</p>
        {unlocks.length > 0 && <p className="cred-unlocks">Unlocks: {unlocks.join(", ")}</p>}
        {credential && state !== "missing" && (
          <p className="cred-meta">
            {credential.reference}
            {credential.expiresAt &&
              ` · ${state === "expired" ? "expired" : "expires"} ${formatLongDate(credential.expiresAt)}`}
          </p>
        )}
        {state === "rejected" && credential?.rejectionReason && (
          <p className="pref-error">{credential.rejectionReason}</p>
        )}
      </div>
      {action && (
        <Button
          size="sm"
          variant={state === "missing" ? "outline" : "default"}
          onClick={() => onAdd(type)}
        >
          {action}
        </Button>
      )}
    </li>
  );
}

function SubmitForm({ type, onDone }: { type: CredentialType; onDone: () => void }) {
  const info = CREDENTIALS[type];
  const submit = useSubmitCredential();
  const [reference, setReference] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [fileName, setFileName] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const needsFile = type !== "references";

  const send = async () => {
    const next: Record<string, string> = {};
    if (reference.trim().length < 3)
      next["reference"] = "Tell us a bit more, at least 3 characters";
    if (info.expires && !expiresAt) next["expiresAt"] = "Enter the expiry date";
    else if (info.expires && expiresAt <= londonToday())
      next["expiresAt"] = "This has already expired. Please use an up-to-date document";
    if (needsFile && !fileName) next["file"] = "Add a photo or scan of the document";
    if (!consent) next["consent"] = "Please confirm so we can check it";
    setErrors(next);
    if (Object.keys(next).length) return;
    await submit.mutateAsync({
      type,
      reference,
      ...(expiresAt ? { expiresAt } : {}),
      ...(fileName ? { fileName } : {}),
    });
    onDone();
  };

  const err = (key: string) =>
    errors[key] ? (
      <p className="pref-error" id={`cred-${key}-error`}>
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="cred-form">
      <p className="muted text-xs">
        {info.description} We check it once, so charities don’t have to.
      </p>
      <label className="cred-field">
        <span>{info.referenceLabel}</span>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={info.referenceHint}
          maxLength={80}
          aria-invalid={Boolean(errors["reference"])}
          aria-describedby={errors["reference"] ? "cred-reference-error" : undefined}
        />
        {err("reference")}
      </label>
      {info.expires && (
        <label className="cred-field">
          <span>Expiry date</span>
          <input
            type="date"
            value={expiresAt}
            min={londonToday()}
            onChange={(e) => setExpiresAt(e.target.value)}
            aria-invalid={Boolean(errors["expiresAt"])}
            aria-describedby={errors["expiresAt"] ? "cred-expiresAt-error" : undefined}
          />
          {err("expiresAt")}
        </label>
      )}
      {needsFile && (
        <label className="cred-field">
          <span>Photo or scan</span>
          <span className="file-picker">
            <FileUp aria-hidden="true" />
            {fileName || "Choose a file (JPG, PNG or PDF)"}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              aria-invalid={Boolean(errors["file"])}
              aria-describedby={errors["file"] ? "cred-file-error" : undefined}
            />
          </span>
          {err("file")}
        </label>
      )}
      <label className="cred-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>This is my document, and Kindred can check it with the issuer.</span>
      </label>
      {err("consent")}
      {submit.isError && <p className="pref-error">{submit.error.message}</p>}
      <p className="readonly-note">
        Prototype: files aren’t uploaded anywhere. Only the file name is kept.
      </p>
      <div className="sheet-actions">
        <Button size="lg" className="w-full" onClick={send} disabled={submit.isPending}>
          {submit.isPending && <Loader2 className="animate-spin" />} Send for checking
        </Button>
      </div>
    </div>
  );
}

const GROUPS: { title: string; hint: string; group: "core" | "task" | "optional" }[] = [
  { title: "Everyone needs", hint: "Before you can accept any request.", group: "core" },
  {
    title: "Unlocks certain tasks",
    hint: "You can only accept these tasks once the check is verified.",
    group: "task",
  },
  { title: "Optional", hint: "Nice to have.", group: "optional" },
];

export function VerificationScreen() {
  const { data, volunteer } = useVolunteer();
  const [adding, setAdding] = useState<CredentialType | null>(null);
  const [sent, setSent] = useState<CredentialType | null>(null);
  const close = useCallback(() => setAdding(null), []);
  const progress = verificationProgress(data, volunteer.id, volunteer.canDo);

  return (
    <div className="phone-padding">
      <section className="cred-hero">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>
            {progress.done} of {progress.total} checks verified
          </strong>
          <p>We handle background checks and certificates, so charities don’t have to.</p>
        </div>
      </section>
      {progress.needsAttention > 0 && (
        <p className="standing-banner standing-warning">
          <AlertTriangle aria-hidden="true" />
          <span>
            {progress.needsAttention === 1
              ? "One check needs"
              : `${progress.needsAttention} checks need`}{" "}
            your attention, so some tasks are paused.
          </span>
        </p>
      )}
      {sent && (
        <p className="cancel-result" role="status">
          <BadgeCheck aria-hidden="true" />
          <span>
            Thanks! We’re checking your {CREDENTIALS[sent].label.toLowerCase()}. This usually takes
            2 working days.
          </span>
        </p>
      )}

      {GROUPS.map((g) => (
        <section key={g.group} className="cred-group">
          <h3>{g.title}</h3>
          <p className="pref-hint">{g.hint}</p>
          <ul>
            {(Object.keys(CREDENTIALS) as CredentialType[])
              .filter((type) => CREDENTIALS[type].group === g.group)
              .map((type) => (
                <CredentialRow
                  key={type}
                  data={data}
                  volunteerId={volunteer.id}
                  type={type}
                  onAdd={setAdding}
                />
              ))}
          </ul>
        </section>
      ))}

      <Sheet
        open={adding !== null}
        onClose={close}
        title={adding ? `Add ${CREDENTIALS[adding].label.toLowerCase()}` : ""}
      >
        {adding && (
          <SubmitForm
            key={adding}
            type={adding}
            onDone={() => {
              setSent(adding);
              setAdding(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

/** Short verification summary for the Profile screen. */
export function VerificationSummary({
  data,
  volunteerId,
  canDo,
}: {
  data: Snapshot;
  volunteerId: string;
  canDo: Parameters<typeof verificationProgress>[2];
}) {
  const progress = verificationProgress(data, volunteerId, canDo);
  return (
    <>
      <div className="detail-row">
        <span>Checks verified</span>
        <span>
          {progress.done} of {progress.total}
        </span>
      </div>
      {progress.needsAttention > 0 && (
        <p className="pref-error mb-3">
          {progress.needsAttention === 1
            ? "1 check needs"
            : `${progress.needsAttention} checks need`}{" "}
          renewing
        </p>
      )}
    </>
  );
}
