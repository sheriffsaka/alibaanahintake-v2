
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

export const MANDATORY_REQUIREMENTS: string[] = [
    'Original Passport and 2 Photocopies',
    'Four passport-sized photographs (White background)',
    'Proof of initial registration from ibaanah.com',
    'Previous Arabic study certificates (if any)',
    'A printout or digital copy of your Intake Slip',
];
