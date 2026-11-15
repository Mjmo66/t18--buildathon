import { useState, type ReactNode } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, CalendarX2, Check, Loader2, Plus, X } from "lucide-react";
import { TASK_TYPES } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatLongDate } from "./format";
import { useUpdatePreferences, useVolunteer } from "./hooks";
import {
  MAX_DISTANCE_RANGE,
  WEEK_DAYS,
  preferencesSchema,
  toFormValues,
  toPreferences,
  type PreferencesFormValues,
} from "./preferences-schema";

type SwitchName = "dbs" | "physicalWork" | "hasCar" | "willingToDrive";
type TaskListName = "canDo" | "cannotDo";

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

function ErrorText({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="pref-error" id={id}>
      {children}
    </p>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="pref-section">
      <h3>{title}</h3>
      {hint && <p className="pref-hint">{hint}</p>}
      <div className="pref-section-body">{children}</div>
    </section>
  );
}

function SwitchRow({
  name,
  label,
  description,
  disabled,
  onChange,
}: {
  name: SwitchName;
  label: string;
  description: string;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}) {
  const { control } = useFormContext<PreferencesFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="switch-row">
          <div>
            <Label htmlFor={`pref-${name}`}>{label}</Label>
            <p className="pref-hint">{description}</p>
            <ErrorText>{fieldState.error?.message}</ErrorText>
          </div>
          <Switch
            id={`pref-${name}`}
            ref={field.ref}
            checked={field.value}
            disabled={disabled}
            onCheckedChange={(value) => {
              field.onChange(value);
              onChange?.(value);
            }}
          />
        </div>
      )}
    />
  );
}

/** Chips for "can do" / "can't do". Picking a task in one list removes it from the other. */
function TaskChoice({
  name,
  other,
  legend,
  hint,
  tone,
}: {
  name: TaskListName;
  other: TaskListName;
  legend: string;
  hint: string;
  tone: "yes" | "no";
}) {
  const { control, getValues, setValue } = useFormContext<PreferencesFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <fieldset className="pref-field">
          <legend className="pref-legend">{legend}</legend>
          <p className="pref-hint">{hint}</p>
          <div className="choice-chips">
            {TASK_TYPES.map((task) => {
              const selected = field.value.includes(task);
              return (
                <button
                  key={task}
                  type="button"
                  className={`choice-chip choice-chip-${tone}`}
                  aria-pressed={selected}
                  onClick={() => {
                    if (selected) return field.onChange(field.value.filter((t) => t !== task));
                    field.onChange([...field.value, task]);
                    const otherList = getValues(other);
                    if (otherList.includes(task))
                      setValue(
                        other,
                        otherList.filter((t) => t !== task),
                      );
                  }}
                >
                  {selected && (tone === "yes" ? <Check /> : <X />)}
                  {task}
                </button>
              );
            })}
          </div>
          <ErrorText>{fieldState.error?.message}</ErrorText>
        </fieldset>
      )}
    />
  );
}

function WeeklyAvailability() {
  const { control, register, formState } = useFormContext<PreferencesFormValues>();
  const weekly = useWatch({ control, name: "weekly" });
  const listError = formState.errors.weekly?.message ?? formState.errors.weekly?.root?.message;
  return (
    <div className="day-list">
      {WEEK_DAYS.map(({ day, label }, index) => {
        const slotErrors = formState.errors.weekly?.[index];
        const error = slotErrors?.end?.message ?? slotErrors?.start?.message;
        return (
          <div className="day-row" key={day}>
            <Controller
              control={control}
              name={`weekly.${index}.enabled`}
              render={({ field }) => (
                <Switch
                  id={`day-${day}`}
                  ref={field.ref}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor={`day-${day}`} className="day-name">
              {label}
            </Label>
            {weekly[index]?.enabled ? (
              <div className="day-times">
                <input
                  type="time"
                  className="time-input"
                  aria-label={`${label} from`}
                  aria-invalid={Boolean(error)}
                  {...register(`weekly.${index}.start`)}
                />
                <span aria-hidden="true">to</span>
                <input
                  type="time"
                  className="time-input"
                  aria-label={`${label} until`}
                  aria-invalid={Boolean(error)}
                  {...register(`weekly.${index}.end`)}
                />
              </div>
            ) : (
              <span className="day-off">Not available</span>
            )}
            {error && <ErrorText>{`${label}: ${error}`}</ErrorText>}
          </div>
        );
      })}
      <ErrorText>{listError}</ErrorText>
    </div>
  );
}

function BlockedDates() {
  const { control } = useFormContext<PreferencesFormValues>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  return (
    <Controller
      control={control}
      name="blockedDates"
      render={({ field }) => {
        const add = () => {
          if (!draft) return setError("Choose a date first");
          if (draft < todayIso()) return setError("Choose today or a later date");
          if (field.value.includes(draft)) return setError("That date is already blocked");
          field.onChange([...field.value, draft].sort());
          setDraft("");
          setError("");
        };
        return (
          <div className="pref-field">
            <Label htmlFor="blocked-date">Add a date you can’t do</Label>
            <div className="blocked-add">
              <Input
                id="blocked-date"
                type="date"
                min={todayIso()}
                value={draft}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "blocked-date-error" : undefined}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError("");
                }}
              />
              <Button type="button" variant="outline" onClick={add}>
                <Plus /> Add
              </Button>
            </div>
            <ErrorText id="blocked-date-error">{error}</ErrorText>
            {field.value.length ? (
              <ul className="blocked-list">
                {field.value.map((date) => (
                  <li key={date}>
                    <CalendarX2 aria-hidden="true" />
                    <span>{formatLongDate(date)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${formatLongDate(date)}`}
                      onClick={() => field.onChange(field.value.filter((d) => d !== date))}
                    >
                      <X />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pref-hint">No blocked dates.</p>
            )}
          </div>
        );
      }}
    />
  );
}

export function PreferencesScreen() {
  const { volunteer } = useVolunteer();
  const navigate = useNavigate();
  const save = useUpdatePreferences();
  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: toFormValues(volunteer),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, setValue, formState } = form;
  const { errors } = formState;
  const hasCar = useWatch({ control, name: "hasCar" });
  const distance = useWatch({ control, name: "maxDistanceMiles" });
  const errorCount = Object.keys(errors).length;

  const onSubmit = handleSubmit(async (values) => {
    await save.mutateAsync(toPreferences(values));
    navigate({ to: "/volunteer/profile", search: { saved: true } });
  });

  return (
    <FormProvider {...form}>
      <form className="pref-form" onSubmit={onSubmit} noValidate>
        <div className="phone-padding">
          <p className="pref-intro">Set these once. We’ll only show you requests that fit.</p>

          {formState.isSubmitted && errorCount > 0 && (
            <div className="pref-alert" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>Please fix {errorCount === 1 ? "1 thing" : `${errorCount} things`} below.</span>
            </div>
          )}
          {save.isError && (
            <div className="pref-alert" role="alert">
              <AlertCircle aria-hidden="true" />
              <span>Couldn’t save your preferences. Please try again.</span>
            </div>
          )}

          <Section title="About you">
            <div className="pref-field">
              <Label htmlFor="postcode">Home postcode</Label>
              <p className="pref-hint" id="postcode-hint">
                Used to work out how far away requests are.
              </p>
              <Input
                id="postcode"
                autoComplete="postal-code"
                aria-invalid={Boolean(errors.postcode)}
                aria-describedby={
                  errors.postcode ? "postcode-hint postcode-error" : "postcode-hint"
                }
                {...register("postcode")}
              />
              <ErrorText id="postcode-error">{errors.postcode?.message}</ErrorText>
            </div>
            <div className="pref-field">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                className="age-input"
                aria-invalid={Boolean(errors.age)}
                aria-describedby={errors.age ? "age-error" : undefined}
                {...register("age", { valueAsNumber: true })}
              />
              <ErrorText id="age-error">{errors.age?.message}</ErrorText>
            </div>
            <SwitchRow
              name="physicalWork"
              label="Physical work"
              description="I’m comfortable with lifting and being on my feet."
            />
          </Section>

          <Section title="Getting there">
            <Controller
              control={control}
              name="maxDistanceMiles"
              render={({ field }) => (
                <div className="pref-field">
                  <div className="distance-label">
                    <Label id="distance-label">Maximum travel distance</Label>
                    <strong>
                      Up to {distance} {distance === 1 ? "mile" : "miles"}
                    </strong>
                  </div>
                  <Slider
                    min={MAX_DISTANCE_RANGE.min}
                    max={MAX_DISTANCE_RANGE.max}
                    step={1}
                    value={[field.value]}
                    onValueChange={([value]) => field.onChange(value)}
                    aria-labelledby="distance-label"
                    className="distance-slider"
                  />
                  <div className="distance-scale" aria-hidden="true">
                    <span>{MAX_DISTANCE_RANGE.min} mile</span>
                    <span>{MAX_DISTANCE_RANGE.max} miles</span>
                  </div>
                </div>
              )}
            />
            <SwitchRow
              name="hasCar"
              label="I have a car"
              description="Some requests need a car, like deliveries."
              onChange={(value) => {
                if (!value)
                  setValue("willingToDrive", false, { shouldValidate: formState.isSubmitted });
              }}
            />
            <SwitchRow
              name="willingToDrive"
              label="Happy to use it"
              description="Show me requests that need a car."
              disabled={!hasCar}
            />
          </Section>

          <Section title="What you’ll help with">
            <TaskChoice
              name="canDo"
              other="cannotDo"
              tone="yes"
              legend="I can do"
              hint="Pick everything you’re happy to help with."
            />
            <TaskChoice
              name="cannotDo"
              other="canDo"
              tone="no"
              legend="I can’t or won’t do"
              hint="We’ll never show you these."
            />
          </Section>

          <Section title="Weekly availability" hint="When are you usually free?">
            <WeeklyAvailability />
          </Section>

          <Section title="Blocked dates" hint="Holidays or one-off days you can’t help.">
            <BlockedDates />
          </Section>
        </div>

        <div className="pref-actions">
          <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Loader2 className="animate-spin" /> Saving…
              </>
            ) : (
              "Save preferences"
            )}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
