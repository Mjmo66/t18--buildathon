// Row types for supabase/migrations/20261115000000_base.sql. Add new exports only.
export type Role = 'charity' | 'volunteer';
export type PhysicalLevel = 'light' | 'moderate' | 'heavy';
export type Experience = 'none' | 'some' | 'experienced';
export type Register = 'OSCR' | 'CCEW' | 'CCNI';
export type Slot = 'morning' | 'afternoon' | 'evening';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type SignupStatus = 'applied' | 'accepted' | 'declined' | 'cancelled' | 'attended' | 'no_show';

export interface Profile {
  id: string; role: Role; display_name: string; email: string | null; verified: boolean;
  public_key: string | null; warnings_count: number; suspended: boolean;
  hours_total: number; points: number; created_at: string;
}
export interface Charity {
  profile_id: string; org_name: string; charity_number: string; register: Register;
  verified_at: string | null; address: string | null; lat: number | null; lng: number | null;
}
export interface VolunteerPrefs {
  profile_id: string; lat: number | null; lng: number | null; max_km: number;
  transport: 'walk' | 'bike' | 'bus' | 'car';
  availability: Partial<Record<Weekday, Slot[]>>;
  physical_max: PhysicalLevel; experience: Experience; interests: string[];
}
export interface Request {
  id: string; charity_id: string; title: string; description: string; category: string | null;
  schedule_type: 'one_time' | 'recurring'; starts_at: string; duration_hours: number;
  recurrence: 'weekly' | 'fortnightly' | 'monthly' | null; ends_on: string | null; slots: number;
  physical_level: PhysicalLevel; experience: Experience; experience_notes: string | null;
  address: string | null; lat: number | null; lng: number | null;
  status: 'open' | 'filled' | 'closed'; checkin_code: string; created_at: string;
}
export interface Signup {
  id: string; request_id: string; volunteer_id: string; shift_at: string; status: SignupStatus;
  hours_credited: number | null; marked_at: string | null; created_at: string;
}
export interface Warning { id: string; volunteer_id: string; signup_id: string | null; reason: string; created_at: string }
export interface Badge { volunteer_id: string; code: 'first_shift' | 'five_hours' | 'twenty_hours' | 'regular' | string; earned_at: string }
export interface Conversation { id: string; request_id: string | null; charity_id: string; volunteer_id: string; created_at: string }
