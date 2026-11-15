export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';
export type TaskType = 'Food bank' | 'Driving' | 'Befriending' | 'Admin' | 'Events' | 'Heavy lifting';
export interface Coordinates { lat: number; lng: number }
export interface Volunteer { id: string; name: string; email: string; postcode: string; coordinates: Coordinates; verification: VerificationStatus; available: boolean; maxDistanceMiles: number; hasCar: boolean; willingToDrive: boolean; canDo: TaskType[]; cannotDo: TaskType[]; weeklyAvailability: { day: number; start: string; end: string }[]; blockedDates: string[]; age: number; dbs: boolean; physicalWork: boolean }
export interface Charity { id: string; name: string; email: string; contactName: string; postcode: string; address: string; coordinates: Coordinates; registrationNumber: string; verification: VerificationStatus; description: string }
export interface Request { id: string; charityId: string; title: string; description: string; taskType: TaskType; postcode: string; location: string; coordinates: Coordinates; carNeeded: boolean; requirements: { dbs: boolean; minimumAge: number; physicalWork: boolean }; volunteersNeeded: number; status: 'open' | 'completed' | 'closed'; schedule: 'one-off' | 'weekly'; occurrenceIds: string[]; distanceMiles: number }
export interface Occurrence { id: string; requestId: string; start: string; end: string }
export interface Commitment { id: string; volunteerId: string; occurrenceId: string; status: 'accepted' | 'cancelled' | 'completed' }
export interface Verification { id: string; subjectType: 'volunteer' | 'charity'; subjectId: string; submittedDate: string; status: VerificationStatus; reason?: string }
export interface Snapshot { volunteers: Volunteer[]; charity: Charity; requests: Request[]; occurrences: Occurrence[]; commitments: Commitment[]; verifications: Verification[] }
