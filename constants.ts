import { Role } from './types';

export const ROLES: Role[] = [
  Role.SuperAdmin,
  Role.MaleAdmin,
  Role.FemaleAdmin,
  Role.MaleFrontDesk,
  Role.FemaleFrontDesk,
];

export const MANDATORY_REQUIREMENTS = {
    title: 'REQUIRED DOCUMENTS FOR SCREENING',
    firstTime: {
        title: 'A. First-Time Students must provide:',
        items: [
            '3 copies of international passport',
            '3 copies of valid visa',
            '3 passport-size photographs'
        ]
    },
    returning: {
        title: 'B. CONTINUING / RETURNING STUDENTS MUST PROVIDE:',
        items: [
            '3 copies of international passport',
            '3 copies of valid visa',
            '1 passport-size photograph'
        ]
    },
    additional: [
        'Tuition fee payment (if not yet paid), OR',
        'Proof of payment (if already paid)'
    ]
};