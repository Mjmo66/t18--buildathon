// Checks Kindred does on volunteers, and which tasks they unlock. Pure functions, so they can move to a backend later.
import type { Credential, CredentialType, Request, Snapshot, TaskType } from "@/api/types";
import { londonToday } from "@/lib/london-time";

export interface CredentialInfo {
  label: string;
  description: string;
  group: "core" | "task" | "optional";
  /** Whether the volunteer must give an expiry date. */
  expires: boolean;
  referenceLabel: string;
  referenceHint: string;
}

export const CREDENTIALS: Record<CredentialType, CredentialInfo> = {
  identity: {
    label: "Photo ID",
    description: "Passport or photocard driving licence.",
    group: "core",
    expires: true,
    referenceLabel: "Document type and last 4 characters",
    referenceHint: "For example: Passport ending 4821",
  },
  address: {
    label: "Proof of address",
    description: "A bill or bank statement from the last 3 months.",
    group: "core",
    expires: false,
    referenceLabel: "Document type",
    referenceHint: "For example: Council tax bill",
  },
  references: {
    label: "Two references",
    description: "People who’ve known you for 2+ years, not family. We contact them for you.",
    group: "core",
    expires: false,
    referenceLabel: "Who your referees are",
    referenceHint: "For example: Former manager, neighbour",
  },
  dbs: {
    label: "DBS check",
    description: "Enhanced check for work with children or vulnerable adults.",
    group: "task",
    expires: false,
    referenceLabel: "Certificate number (last 4 digits)",
    referenceHint: "Printed at the top of your certificate",
  },
  "driving-licence": {
    label: "Driving licence",
    description: "Full UK licence.",
    group: "task",
    expires: true,
    referenceLabel: "Licence number (last 4 characters)",
    referenceHint: "Box 5 on your photocard",
  },
  "car-insurance": {
    label: "Car insurance",
    description: "Must cover volunteering or business use.",
    group: "task",
    expires: true,
    referenceLabel: "Policy number (last 4 characters)",
    referenceHint: "On your certificate of insurance",
  },
  "food-hygiene": {
    label: "Food hygiene certificate",
    description: "Level 2 Food Safety and Hygiene.",
    group: "task",
    expires: true,
    referenceLabel: "Course or certificate name",
    referenceHint: "For example: Level 2 Food Hygiene",
  },
  "manual-handling": {
    label: "Manual handling training",
    description: "Safe lifting and carrying.",
    group: "task",
    expires: true,
    referenceLabel: "Course name",
    referenceHint: "For example: Manual handling awareness",
  },
  "first-aid": {
    label: "First aid certificate",
    description: "Optional, but charities love it.",
    group: "optional",
    expires: true,
    referenceLabel: "Course name",
    referenceHint: "For example: Emergency First Aid at Work",
  },
};

/** Everyone needs these before they can volunteer. */
export const CORE_CREDENTIALS: CredentialType[] = ["identity", "address", "references"];

/** Certificates a task type needs before a volunteer can accept it. */
export const TASK_CREDENTIALS: Partial<Record<TaskType, CredentialType[]>> = {
  Driving: ["driving-licence", "car-insurance"],
  "Food bank": ["food-hygiene"],
  Befriending: ["dbs"],
  "Heavy lifting": ["manual-handling"],
};

/** Task types each credential unlocks, for showing "Unlocks: Driving". */
export function tasksUnlockedBy(type: CredentialType): TaskType[] {
  return (Object.entries(TASK_CREDENTIALS) as [TaskType, CredentialType[]][])
    .filter(([, types]) => types.includes(type))
    .map(([task]) => task);
}

export type CredentialState = "missing" | "pending" | "verified" | "rejected" | "expired";

export function latestCredential(
  data: Snapshot,
  volunteerId: string,
  type: CredentialType,
): Credential | undefined {
  return data.credentials
    .filter((c) => c.volunteerId === volunteerId && c.type === type)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
}

export function credentialState(
  credential: Credential | undefined,
  now = new Date(),
): CredentialState {
  if (!credential) return "missing";
  if (credential.status !== "verified") return credential.status;
  if (credential.expiresAt && credential.expiresAt < londonToday(now)) return "expired";
  return "verified";
}

/** Credentials a request needs: its task type's, plus DBS if the charity asked for it. */
export function requiredCredentials(request: Request): CredentialType[] {
  const types = new Set(TASK_CREDENTIALS[request.taskType] ?? []);
  if (request.requirements.dbs) types.add("dbs");
  return [...types];
}

/** Why a credential stops someone accepting, or null if it's fine. */
export function credentialProblem(type: CredentialType, state: CredentialState): string | null {
  const label = CREDENTIALS[type].label;
  const lower = label.charAt(0).toLowerCase() + label.slice(1);
  switch (state) {
    case "verified":
      return null;
    case "missing":
      return `This needs a verified ${lower}. Add it in Profile → Verification.`;
    case "pending":
      return `Your ${lower} is still being checked. We’ll let you know when it’s done.`;
    case "expired":
      return `Your ${lower} has expired. Renew it in Profile → Verification.`;
    case "rejected":
      return `Your ${lower} wasn’t accepted. Please send it again in Profile → Verification.`;
  }
}

/** How many of the core checks plus the ones the volunteer's chosen tasks need are verified. */
export function verificationProgress(
  data: Snapshot,
  volunteerId: string,
  canDo: TaskType[],
  now = new Date(),
) {
  const needed = new Set<CredentialType>(CORE_CREDENTIALS);
  for (const task of canDo) for (const type of TASK_CREDENTIALS[task] ?? []) needed.add(type);
  const states = [...needed].map((type) =>
    credentialState(latestCredential(data, volunteerId, type), now),
  );
  return {
    done: states.filter((s) => s === "verified").length,
    total: needed.size,
    needsAttention: states.filter((s) => s === "expired" || s === "rejected").length,
  };
}
