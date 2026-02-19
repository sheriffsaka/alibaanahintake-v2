
export interface Level {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Program {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  isActive: boolean;
  isArchived: boolean;
  sortOrder: number;
  children?: Program[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SiteContent {
  logoUrl: string;
  officialSiteUrl: string;
  heroVideoUrl: Record<string, string>;
  faqItems: FaqItem[];
  campusAddress: string;
  campusHours: string;
}

export enum Gender {
  Male = 'Male',
  Female = 'Female',
}

export enum Role {
    SuperAdmin = 'Super Admin',
    MaleAdmin = 'male_section_Admin',
    FemaleAdmin = 'female_section_Admin',
    MaleFrontDesk = 'male_Front Desk',
    FemaleFrontDesk = 'female_Front Desk',
}

export interface Student {
  id: string;
  surname: string;
  firstname: string;
  othername?: string;
  whatsapp: string;
  email: string;
  gender: Gender;
  address: string;
  level: Level; // Changed from enum to interface
  levelId: string;
  intakeDate: string; // YYYY-MM-DD
  registrationCode: string;
  appointmentSlotId: string;
  status: 'booked' | 'checked-in';
  createdAt: string; 
}

export interface AppointmentSlot {
  id: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  capacity: number;
  booked: number;
  level: Level; // Changed from enum to interface
  levelId: string;
  gender: Gender;
  date: string; // YYYY-MM-DD
}

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
}

export interface NotificationSettings {
  confirmation: { enabled: boolean; subject: string; body: string; };
  reminder24h: { enabled: boolean; subject: string; body: string; };
  reminderDayOf: { enabled: boolean; subject: string; body: string; };
}

export interface AppSettings {
    registrationOpen: boolean;
    maxDailyCapacity: number;
}

export interface EnrollmentState {
    step: number;
    formData: {
        surname: string;
        firstname: string;
        othername: string;
        whatsapp: string;
        email: string;
        gender: Gender;
        address: string;
        levelId: string;
    };
    selectedSlotId?: string;
    selectedSlotDate?: string;
    confirmedRegistration?: Student;
}

export type EnrollmentAction =
    | { type: 'NEXT_STEP' }
    | { type: 'PREV_STEP' }
    | { type: 'UPDATE_FORM'; payload: Partial<EnrollmentState['formData']> }
    | { type: 'SELECT_SLOT'; payload: { id: string, date: string } }
    | { type: 'CONFIRM_REGISTRATION'; payload: Student }
    | { type: 'RESET' };