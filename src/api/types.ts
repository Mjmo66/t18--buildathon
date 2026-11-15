export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";
export type TaskType =
  "Food bank" | "Driving" | "Befriending" | "Admin" | "Events" | "Heavy lifting";
export interface Coordinates {
  lat: number;
  lng: number;
}
export interface Volunteer {
  id: string;
  name: string;
  email: string;
  postcode: string;
  coordinates: Coordinates;
  verification: VerificationStatus;
  available: boolean;
  maxDistanceMiles: number;
  hasCar: boolean;
  willingToDrive: boolean;
  canDo: TaskType[];
  cannotDo: TaskType[];
  weeklyAvailability: { day: number; start: string; end: string }[];
  blockedDates: string[];
  age: number;
  dbs: boolean;
  physicalWork: boolean;
}
export interface Charity {
  id: string;
  name: string;
  email: string;
  contactName: string;
  postcode: string;
  address: string;
  coordinates: Coordinates;
  registrationNumber: string;
  verification: VerificationStatus;
  description: string;
  phone?: string | undefined;
}

/** Charity details the charity can edit on its Profile. */
export type CharityDetails = Pick<
  Charity,
  "contactName" | "email" | "phone" | "address" | "postcode" | "description"
>;
/** Drafts are saved by the charity but not shown to volunteers. */
export type RequestStatus = "draft" | "open" | "completed" | "closed" | "cancelled";
/** Why a charity cancelled a request. Shown to the volunteers who had signed up. */
export interface RequestCancellation {
  cancelledAt: string;
  reasonId: string;
  message?: string;
}
export interface Request {
  id: string;
  charityId: string;
  title: string;
  description: string;
  taskType: TaskType;
  postcode: string;
  location: string;
  coordinates: Coordinates;
  carNeeded: boolean;
  requirements: { dbs: boolean; minimumAge: number; physicalWork: boolean };
  volunteersNeeded: number;
  status: RequestStatus;
  cancellation?: RequestCancellation;
  schedule: "one-off" | "weekly";
  occurrenceIds: string[];
  distanceMiles: number;
}
export interface Occurrence {
  id: string;
  requestId: string;
  start: string;
  end: string;
}
export type CommitmentStatus = "accepted" | "cancelled" | "completed" | "no-show";
export interface Commitment {
  id: string;
  volunteerId: string;
  occurrenceId: string;
  /** completed = the charity confirmed they came; no-show = they didn't (a strike). */
  status: CommitmentStatus;
  /** When the charity confirmed attendance. Strikes expire 6 months after this. */
  attendanceMarkedAt?: string;
  /** Set when the volunteer cancels. */
  cancellation?: {
    cancelledAt: string;
    /** Less than 24 hours' notice. */
    late: boolean;
    reasonId?: string;
    note?: string;
    /** Late with no accepted reason: costs points. */
    penalised: boolean;
    /** The charity cancelled the whole request; never a penalty for the volunteer. */
    byCharity?: boolean;
  };
}
export interface Verification {
  id: string;
  subjectType: "volunteer" | "charity";
  subjectId: string;
  submittedDate: string;
  status: VerificationStatus;
  reason?: string;
}
export const TASK_TYPES: TaskType[] = [
  "Food bank",
  "Driving",
  "Befriending",
  "Admin",
  "Events",
  "Heavy lifting",
];
/** The fields a volunteer can change on the preferences screen. */
export type VolunteerPreferences = Pick<
  Volunteer,
  | "postcode"
  | "coordinates"
  | "maxDistanceMiles"
  | "hasCar"
  | "willingToDrive"
  | "canDo"
  | "cannotDo"
  | "weeklyAvailability"
  | "blockedDates"
  | "age"
  | "dbs"
  | "physicalWork"
>;
export interface Snapshot {
  volunteers: Volunteer[];
  charity: Charity;
  requests: Request[];
  occurrences: Occurrence[];
  commitments: Commitment[];
  verifications: Verification[];
  redemptions: Redemption[];
  credentials: Credential[];
}

/** Checks and certificates Kindred verifies on the charity's behalf. */
export type CredentialType =
  | "identity"
  | "address"
  | "references"
  | "dbs"
  | "driving-licence"
  | "car-insurance"
  | "food-hygiene"
  | "manual-handling"
  | "first-aid";

export interface Credential {
  id: string;
  volunteerId: string;
  type: CredentialType;
  /** Expiry is worked out from expiresAt, so it isn't stored here. */
  status: "pending" | "verified" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  /** "YYYY-MM-DD", for documents that expire. */
  expiresAt?: string;
  /** What the volunteer gave us, e.g. the last digits of a certificate number. */
  reference: string;
  fileName?: string;
  rejectionReason?: string;
}

/** A reward a volunteer has swapped points for. */
export interface Redemption {
  id: string;
  volunteerId: string;
  rewardId: string;
  points: number;
  /** Demo voucher code shown to the volunteer. */
  code: string;
  redeemedAt: string;
}

/** What the charity's Create request form sends to the API. */
export interface NewRequest {
  title: string;
  description: string;
  taskType: TaskType;
  postcode: string;
  location: string;
  coordinates: Coordinates;
  carNeeded: boolean;
  requirements: Request["requirements"];
  volunteersNeeded: number;
  status: Extract<RequestStatus, "draft" | "open">;
  schedule: Request["schedule"];
  /** One entry for a one-off request, one per week for a weekly request. ISO times in UTC. */
  occurrences: { start: string; end: string }[];
}
