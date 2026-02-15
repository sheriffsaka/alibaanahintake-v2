
import { Level, Role } from './types';

export const LEVELS: Level[] = [
  Level.Beginner,
  Level.Elementary,
  Level.Intermediate,
  Level.Advanced,
];

export const ROLES: Role[] = [
  Role.SuperAdmin,
  Role.MaleAdmin,
  Role.FemaleAdmin,
  Role.MaleFrontDesk,
  Role.FemaleFrontDesk,
];

export const WHAT_TO_BRING: { item: string, detail: string }[] = [
    { item: 'Identification', detail: 'National ID, Passport, or Driver\'s License.' },
    { item: 'Proof of Payment', detail: 'If any pre-payment was made.' },
    { item: 'Previous Certificates', detail: 'If you have prior Arabic language qualifications.' },
    { item: 'Pen and Notebook', detail: 'For taking notes during the assessment.' },
];
