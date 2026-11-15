import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock3, Loader2, Pencil, ShieldCheck } from "lucide-react";
import { snapshotQuery } from "@/api/queries";
import type { Charity } from "@/api/types";
import { Status } from "@/components/shared/common";
import { Button } from "@/components/ui/button";
import { normalisePostcode } from "@/lib/postcodes";
import { edinburghPostcode } from "@/lib/validation";
import { useUpdateCharityDetails } from "./hooks";
import { PageHeading } from "./screens";

const detailsSchema = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, "Enter the main contact’s name")
    .max(60, "Keep it under 60 characters"),
  email: z.string().trim().email("Enter an email address like name@example.org"),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^[0-9 +()-]{10,16}$/.test(v),
      "Enter a UK phone number, like 0131 496 0000",
    ),
  address: z.string().trim().min(5, "Enter your street address"),
  postcode: edinburghPostcode("Enter your postcode"),
  description: z
    .string()
    .trim()
    .min(20, "Tell volunteers a little more (at least 20 characters)")
    .max(400, "Keep it under 400 characters"),
});
type DetailsValues = z.infer<typeof detailsSchema>;

const toValues = (c: Charity): DetailsValues => ({
  contactName: c.contactName,
  email: c.email,
  phone: c.phone ?? "",
  address: c.address,
  postcode: c.postcode,
  description: c.description,
});

function DetailsForm({ charity, onDone }: { charity: Charity; onDone: (saved: boolean) => void }) {
  const save = useUpdateCharityDetails();
  const { register, handleSubmit, formState } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: toValues(charity),
    mode: "onTouched",
  });
  const { errors } = formState;
  const field = (
    name: keyof DetailsValues,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    wide = false,
  ) => (
    <label className={`form-field ${wide ? "wide" : ""}`}>
      {label}
      <input
        {...props}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...register(name)}
      />
      {errors[name] && (
        <span className="pref-error" id={`${name}-error`}>
          {errors[name]?.message}
        </span>
      )}
    </label>
  );

  return (
    <form
      className="request-form"
      noValidate
      onSubmit={handleSubmit((values) =>
        save.mutate(
          {
            ...values,
            postcode: normalisePostcode(values.postcode),
            ...(values.phone ? { phone: values.phone } : { phone: undefined }),
          },
          { onSuccess: () => onDone(true) },
        ),
      )}
    >
      <div className="form-grid">
        {field("contactName", "Main contact", { autoComplete: "name" })}
        {field("email", "Email", { type: "email", autoComplete: "email" })}
        {field("phone", "Phone (optional)", { type: "tel", autoComplete: "tel" })}
        {field("postcode", "Postcode", { autoComplete: "postal-code" })}
        {field("address", "Address", { autoComplete: "street-address" }, true)}
        <label className="form-field wide">
          About your charity
          <textarea
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? "description-error" : undefined}
            {...register("description")}
            maxLength={400}
          />
          {errors.description && (
            <span className="pref-error" id="description-error">
              {errors.description.message}
            </span>
          )}
        </label>
      </div>
      {save.isError && <p className="pref-error mt-3">{save.error.message}</p>}
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />} Save details
        </Button>
      </div>
    </form>
  );
}

export function CharityProfileScreen() {
  const { data } = useSuspenseQuery(snapshotQuery);
  const c = data.charity;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <>
      <PageHeading
        title="Charity profile"
        description="Volunteers see this when they look at your requests."
      >
        {!editing && (
          <Button
            variant="outline"
            onClick={() => {
              setEditing(true);
              setSaved(false);
            }}
          >
            <Pencil /> Edit details
          </Button>
        )}
      </PageHeading>
      {saved && (
        <p className="created-banner" role="status">
          <CheckCircle2 aria-hidden="true" /> Your details are saved.
        </p>
      )}
      <div className="profile-desktop">
        <div className="profile-desktop-header">
          <span className="avatar avatar-large">
            <Building2 size={30} />
          </span>
          <div>
            <h2>{c.name}</h2>
            <Status status={c.verification} />
          </div>
        </div>

        <div
          className={`verification-callout ${c.verification === "verified" ? "is-verified" : ""}`}
        >
          {c.verification === "verified" ? (
            <ShieldCheck aria-hidden="true" />
          ) : (
            <Clock3 aria-hidden="true" />
          )}
          <div>
            <strong>
              {c.verification === "verified"
                ? "Your charity is verified"
                : "We’re checking your charity number"}
            </strong>
            <p>
              Scottish charity number <strong>{c.registrationNumber}</strong>.{" "}
              {c.verification === "verified"
                ? "Volunteers can see you’re a registered charity."
                : "We check it with OSCR, the Scottish Charity Regulator. This usually takes 2 working days. You can post requests in the meantime."}
            </p>
            <p className="muted text-xs mt-2">
              Kindred handles volunteers’ ID, references, DBS checks and certificates, so you don’t
              need to.
            </p>
          </div>
        </div>

        {editing ? (
          <DetailsForm
            charity={c}
            onDone={(didSave) => {
              setEditing(false);
              setSaved(didSave);
            }}
          />
        ) : (
          <div className="profile-columns">
            <section>
              <h3>Organisation details</h3>
              <div className="detail-row">
                <span>Address</span>
                <span>
                  {c.address}
                  <br />
                  {c.postcode}
                </span>
              </div>
              <div className="detail-row">
                <span>About</span>
                <span>{c.description}</span>
              </div>
            </section>
            <section>
              <h3>Main contact</h3>
              <div className="detail-row">
                <span>Name</span>
                <span>{c.contactName}</span>
              </div>
              <div className="detail-row">
                <span>Email</span>
                <span>{c.email}</span>
              </div>
              <div className="detail-row">
                <span>Phone</span>
                <span>{c.phone ?? "Not added"}</span>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
