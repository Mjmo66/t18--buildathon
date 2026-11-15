// Small helpers and plain-English labels for the volunteer pages. Buttons, dialogs and toasts come from
// src/components/ui; dates, times and distances from src/components/format.js.
import { Spinner } from '../../components/ui/index.js';
import './user.css';

export function Loading() {
  return <div className="v-loading"><Spinner size="lg" /></div>;
}

export const LABELS = {
  physical: { light: 'Light work', moderate: 'Some bending', heavy: 'Heavy lifting' },
  physicalShort: { light: 'Light work', moderate: 'Some walking and lifting', heavy: 'Heavy work too' },
  experience: { none: 'No experience needed', some: 'Some experience helps', experienced: 'For experienced volunteers' },
  experienceMine: { none: "I'm new to this", some: 'I have some experience', experienced: "I'm experienced" },
  transport: { walk: 'Walking', bike: 'Bike', bus: 'Bus', car: 'Car' },
  recurrence: { weekly: 'Every week', fortnightly: 'Every 2 weeks', monthly: 'Every month' },
  category: {
    environment: 'Nature and outdoors', food: 'Food', elderly: 'Older people', kids: 'Children',
    animals: 'Animals', community: 'Community', events: 'Events',
  },
};

/** Status of a signup in plain words, with a badge tone. */
export const SIGNUP_STATUS = {
  applied: { label: 'Waiting for reply', tone: 'warning' },
  accepted: { label: 'Confirmed', tone: 'success' },
  attended: { label: 'Done', tone: 'success' },
  no_show: { label: 'Missed', tone: 'danger' },
  declined: { label: 'The charity said no', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
