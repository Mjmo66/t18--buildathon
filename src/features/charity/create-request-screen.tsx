import { useMemo, useState, type ReactNode } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CalendarRange, Check, Loader2, Lock, Plus } from "lucide-react";
import { createRequest, updateRequest } from "@/api/mock-api";
import { snapshotQuery } from "@/api/queries";
import { TASK_TYPES, type NewRequest, type Request } from "@/api/types";
import { summariseRequest } from "@/lib/charity";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { londonToday } from "@/lib/london-time";
import { PageHeading } from "./screens";
import {
  MAX_WEEKLY_SESSIONS,
  createRequestSchema,
  emptyRequestForm,
  requestToFormValues,
  sessionDates,
  toNewRequest,
  type RequestFormValues,
} from "./request-schema";

type FieldName = keyof RequestFormValues;

/** id / aria wiring for an input, so labels, hints and errors are announced together. */
function useFieldA11y(name: FieldName, hasHint = false) {
  const { formState } = useFormContext<RequestFormValues>();
  const error = formState.errors[name]?.message;
  const describedBy = [hasHint && `${name}-hint`, error && `${name}-error`]
    .filter(Boolean)
    .join(" ");
  return {
    error,
    inputProps: {
      id: name,
      "aria-invalid": Boolean(error),
      "aria-describedby": describedBy || undefined,
    },
  };
}

function Field({
  name,
  label,
  hint,
  wide,
  children,
}: {
  name: FieldName;
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const { error } = useFieldA11y(name, Boolean(hint));
  return (
    <div className={`form-field ${wide ? "wide" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {hint && (
        <p className="form-hint" id={`${name}-hint`}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p className="pref-error" id={`${name}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function TextInput({
  name,
  hint,
  ...props
}: { name: FieldName; hint?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { register } = useFormContext<RequestFormValues>();
  const { inputProps } = useFieldA11y(name, hint);
  const numeric = props.type === "number";
  return (
    <input {...props} {...inputProps} {...register(name, numeric ? { valueAsNumber: true } : {})} />
  );
}

function RequirementSwitch({
  name,
  label,
  description,
}: {
  name: "carNeeded" | "dbs" | "physicalWork";
  label: string;
  description: string;
}) {
  const { control } = useFormContext<RequestFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="requirement-row">
          <div>
            <label htmlFor={name}>{label}</label>
            <p className="form-hint">{description}</p>
          </div>
          <Switch
            id={name}
            ref={field.ref}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        </div>
      )}
    />
  );
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const formatDay = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

/** "4 weekly sessions, Tue 17 Nov to Tue 8 Dec, 10:00 for 2 hours" */
function SessionSummary() {
  const { control } = useFormContext<RequestFormValues>();
  const [date, schedule, repeatUntil, startTime, durationHours] = useWatch({
    control,
    name: ["date", "schedule", "repeatUntil", "startTime", "durationHours"],
  });
  const dates = useMemo(
    () => sessionDates({ date, schedule, repeatUntil }),
    [date, schedule, repeatUntil],
  );
  if (!dates.length) return null;
  const length =
    Number.isFinite(durationHours) && durationHours > 0
      ? ` for ${durationHours} ${durationHours === 1 ? "hour" : "hours"}`
      : "";
  const first = dates[0]!;
  const last = dates.at(-1)!;
  const text =
    dates.length === 1
      ? `1 session on ${formatDay(first)}, ${startTime}${length}`
      : `${dates.length} weekly sessions, ${formatDay(first)} to ${formatDay(last)}, ${startTime}${length}`;
  return (
    <p className="session-summary wide" role="status">
      <CalendarRange aria-hidden="true" /> {text}
    </p>
  );
}

export function CreateRequestScreen() {
  return <RequestFormScreen />;
}

/** One form for creating and editing. With `request`, it edits that request. */
export function RequestFormScreen({ request }: { request?: Request }) {
  const { data } = useSuspenseQuery(snapshotQuery);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [intent, setIntent] = useState<NewRequest["status"]>("open");
  const summary = request ? summariseRequest(data, request) : null;
  // Once anyone has signed up, the dates stay as they are so volunteers' plans don't change.
  const lockSchedule = Boolean(summary && summary.sessions.some((s) => s.filled > 0));
  const minVolunteers = summary ? Math.max(0, ...summary.sessions.map((s) => s.filled)) : 0;
  const schema = useMemo(
    () => createRequestSchema(new Date(), { minVolunteers, lockSchedule }),
    [minVolunteers, lockSchedule],
  );
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(schema),
    defaultValues: request
      ? requestToFormValues(data, request)
      : emptyRequestForm(data.charity.postcode),
    mode: "onTouched",
  });
  const { control, handleSubmit, formState } = form;
  const schedule = useWatch({ control, name: "schedule" });
  const errorCount = Object.keys(formState.errors).length;
  const isDraft = !request || request.status === "draft";

  const save = useMutation({
    mutationFn: ({
      values,
      status,
    }: {
      values: RequestFormValues;
      status: NewRequest["status"];
    }): Promise<Request> =>
      request
        ? updateRequest(request.id, toNewRequest(values, status), {
            replaceSessions: !lockSchedule,
          })
        : createRequest(toNewRequest(values, status)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: snapshotQuery.queryKey }),
  });

  const submit = (status: NewRequest["status"]) => {
    setIntent(status);
    return handleSubmit((values) =>
      save.mutate(
        { values, status },
        {
          onSuccess: (saved) =>
            navigate({
              to: "/charity/requests",
              search: request ? { updated: saved.id } : { created: saved.id },
            }),
        },
      ),
    )();
  };

  return (
    <>
      <PageHeading
        title={request ? "Edit request" : "Create a request"}
        description={
          request
            ? `Changes go live straight away for volunteers.`
            : "A helping hand starts with a simple request."
        }
      />
      <FormProvider {...form}>
        <form
          className="form-preview request-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit("open");
          }}
        >
          {formState.isSubmitted && errorCount > 0 && (
            <div className="pref-alert" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>
                Please fix {errorCount === 1 ? "1 thing" : `${errorCount} things`} below before
                saving.
              </span>
            </div>
          )}
          {save.isError && (
            <div className="pref-alert" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>
                {save.error instanceof Error
                  ? save.error.message
                  : "Couldn’t save the request. Please try again."}
              </span>
            </div>
          )}

          <div className="form-section">
            <h2>What do you need help with?</h2>
            <div className="form-grid">
              <Field name="title" label="Request title" wide>
                <TextInput name="title" placeholder="e.g. Help pack food parcels" maxLength={80} />
              </Field>
              <Field
                name="taskType"
                label="Task type"
                hint="Volunteers only see task types they’ve said they can do."
              >
                <TaskTypeSelect />
              </Field>
              <Field name="volunteersNeeded" label="Volunteers needed" hint="Per session.">
                <TextInput
                  name="volunteersNeeded"
                  hint
                  type="number"
                  min={1}
                  max={50}
                  inputMode="numeric"
                />
              </Field>
              <Field name="description" label="Description" wide>
                <DescriptionInput />
              </Field>
            </div>
          </div>

          <div className="form-section">
            <h2>When and where?</h2>
            <div className="form-grid">
              {lockSchedule && (
                <p className="locked-note wide">
                  <Lock aria-hidden="true" /> Volunteers have signed up, so the dates and times
                  can’t change. To move it, cancel this request and create a new one.
                </p>
              )}
              <fieldset disabled={lockSchedule} className="contents-fieldset">
                <Field name="schedule" label="Schedule" wide>
                  <ScheduleChoice />
                </Field>
                <Field name="date" label={schedule === "weekly" ? "First session" : "Date"}>
                  <TextInput name="date" type="date" min={londonToday()} />
                </Field>
                {schedule === "weekly" && (
                  <Field
                    name="repeatUntil"
                    label="Repeat until"
                    hint={`Up to ${MAX_WEEKLY_SESSIONS} weeks.`}
                  >
                    <TextInput name="repeatUntil" hint type="date" min={londonToday()} />
                  </Field>
                )}
                <Field name="startTime" label="Start time">
                  <TextInput name="startTime" type="time" />
                </Field>
                <Field
                  name="durationHours"
                  label="Duration (hours)"
                  hint="Half-hour steps, like 1.5."
                >
                  <TextInput
                    name="durationHours"
                    hint
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    inputMode="decimal"
                  />
                </Field>
                <SessionSummary />
              </fieldset>
              <Field name="location" label="Location">
                <TextInput name="location" placeholder="Community hall, office…" maxLength={80} />
              </Field>
              <Field
                name="postcode"
                label="Postcode"
                hint="Used to show volunteers how far away it is."
              >
                <TextInput name="postcode" hint placeholder="EH6 5AB" autoComplete="postal-code" />
              </Field>
            </div>
          </div>

          <div className="form-section">
            <h2>Requirements</h2>
            <div className="form-grid">
              <RequirementSwitch
                name="carNeeded"
                label="Car needed"
                description="Only volunteers with a car who are happy to drive will see it."
              />
              <RequirementSwitch
                name="dbs"
                label="DBS check needed"
                description="Only volunteers whose DBS check Kindred has verified can accept it."
              />
              <RequirementSwitch
                name="physicalWork"
                label="Physical work"
                description="Lifting, carrying or being on your feet."
              />
              <Field name="minimumAge" label="Minimum age">
                <TextInput
                  name="minimumAge"
                  type="number"
                  min={16}
                  max={100}
                  inputMode="numeric"
                  className="age-input"
                />
              </Field>
            </div>
          </div>

          <div className="form-actions">
            <Button asChild variant="ghost">
              <Link to="/charity/requests">{request ? "Discard changes" : "Cancel"}</Link>
            </Button>
            {isDraft && (
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => void submit("draft")}
              >
                {save.isPending && intent === "draft" ? <Loader2 className="animate-spin" /> : null}
                Save draft
              </Button>
            )}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && intent === "open" ? (
                <Loader2 className="animate-spin" />
              ) : request && !isDraft ? (
                <Check />
              ) : (
                <Plus />
              )}
              {request && !isDraft ? "Save changes" : "Publish request"}
            </Button>
          </div>
        </form>
      </FormProvider>
    </>
  );
}

function TaskTypeSelect() {
  const { register } = useFormContext<RequestFormValues>();
  const { inputProps } = useFieldA11y("taskType", true);
  return (
    <select {...inputProps} {...register("taskType")}>
      <option value="">Choose a task type</option>
      {TASK_TYPES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

function DescriptionInput() {
  const { register, control } = useFormContext<RequestFormValues>();
  const { inputProps } = useFieldA11y("description");
  const length = useWatch({ control, name: "description" })?.length ?? 0;
  return (
    <>
      <textarea
        {...inputProps}
        {...register("description")}
        maxLength={600}
        placeholder="Tell volunteers about the task and what to expect."
      />
      <span className="char-count" aria-live="polite">
        {length} / 600
      </span>
    </>
  );
}

function ScheduleChoice() {
  const { register } = useFormContext<RequestFormValues>();
  return (
    <div className="segmented" role="radiogroup" aria-label="Schedule">
      <label>
        <input type="radio" value="one-off" {...register("schedule")} />
        <span>One-off</span>
      </label>
      <label>
        <input type="radio" value="weekly" {...register("schedule")} />
        <span>Recurring weekly</span>
      </label>
    </div>
  );
}
