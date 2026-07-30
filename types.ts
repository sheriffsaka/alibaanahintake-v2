
export interface Level {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface BenefitItem {
  title: string;
  description: string;
}

export interface SiteContent {
  logoUrl: string;
  officialSiteUrl: string;
  heroVideoUrl: Record<string, string>;
  faqItems: Record<string, FaqItem[]>;
  benefitItems: Record<string, BenefitItem[]>;
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
    MaleCoAdmin = 'male_co_Admin',
    FemaleCoAdmin = 'female_co_Admin',
    CoAdmin = 'co_Admin',
}

export const getAdminGenderFilter = (role?: Role | string, name?: string): Gender | undefined => {
  if (!role) return undefined;
  if (
    role === Role.MaleAdmin ||
    role === Role.MaleFrontDesk ||
    role === Role.MaleCoAdmin ||
    role === 'male_co_Admin'
  ) {
    return Gender.Male;
  }
  if (
    role === Role.FemaleAdmin ||
    role === Role.FemaleFrontDesk ||
    role === Role.FemaleCoAdmin ||
    role === 'female_co_Admin'
  ) {
    return Gender.Female;
  }
  if (role === Role.CoAdmin || role === 'co_Admin') {
    const lowerName = (name || '').toLowerCase();
    if (lowerName.includes('female')) return Gender.Female;
    if (lowerName.includes('male')) return Gender.Male;
  }
  return undefined;
};

export interface Student {
  id: string;
  surname: string;
  firstname: string;
  othername?: string;
  whatsapp: string;
  email: string;
  gender: Gender;
  address: string;
  buildingNumber?: string;
  flatNumber?: string;
  streetName?: string;
  district?: string;
  state?: string;
  level: Level;
  levelId: string;
  intakeDate: string; // YYYY-MM-DD
  registrationCode: string;
  appointmentSlotId: string;
  status: 'booked' | 'checked-in';
  language: string;
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
  [lang: string]: {
    confirmation: { enabled: boolean; subject: string; body: string; };
    reminder24h: { enabled: boolean; subject: string; body: string; };
    reminderDayOf: { enabled: boolean; subject: string; body: string; };
  };
}

export interface AppSettings {
    isRegistrationOpen: boolean;
    isMaleRegistrationOpen: boolean;
    isFemaleRegistrationOpen: boolean;
    maxDailyCapacity: number;
    closedReasons: Record<string, string>; // Multilingual reasons for closure
    bookingStartTime?: string; // ISO String or null
    bookingEndTime?: string; // ISO String or null
    femaleBookingStartTime?: string; // ISO String or null
    femaleBookingEndTime?: string; // ISO String or null
}

export interface EnrollmentState {
    step: number;
    formData: {
        surname: string;
        firstname: string;
        othername: string;
        whatsappCountryCode: string;
        whatsapp: string;
        email: string;
        gender: Gender;
        buildingNumber: string;
        flatNumber: string;
        streetName: string;
        district: string;
        state: string;
        address: string;
        levelId: string;
        language: string;
    };
    isEmailVerified: boolean;
    selectedSlotId?: string;
    selectedSlotDate?: string;
    confirmedRegistration?: Student;
}

export type EnrollmentAction =
    | { type: 'NEXT_STEP' }
    | { type: 'PREV_STEP' }
    | { type: 'UPDATE_FORM'; payload: Partial<EnrollmentState['formData']> }
    | { type: 'SET_EMAIL_VERIFIED'; payload: boolean }
    | { type: 'SELECT_SLOT'; payload: { id: string, date: string } }
    | { type: 'CONFIRM_REGISTRATION'; payload: Student }
    | { type: 'RESET'; payload?: { gender?: Gender, levelId?: string } };