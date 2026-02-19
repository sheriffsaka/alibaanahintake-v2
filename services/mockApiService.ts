import { Student, AppointmentSlot, Level, Gender, AdminUser, Role, NotificationSettings, AppSettings, Program, SiteContent } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Mock Database
let students: Student[] = [];
let appointmentSlots: AppointmentSlot[] = [];
let levels: Level[] = [
    { id: 'level-1', name: 'Beginner', isActive: true, sortOrder: 1 },
    { id: 'level-2', name: 'Elementary', isActive: true, sortOrder: 2 },
    { id: 'level-3', name: 'Intermediate', isActive: true, sortOrder: 3 },
    { id: 'level-4', name: 'Advanced', isActive: false, sortOrder: 4 },
];
let programs: Program[] = [
    { id: 'prog-1', name: 'Calligraphy Classes', isActive: true, isArchived: false, sortOrder: 1, children: [] },
    { id: 'prog-2', name: 'Mutoon Class', isActive: true, isArchived: false, sortOrder: 2, children: [] },
    { id: 'prog-3', name: 'Advanced Grammar', parentId: 'prog-2', isActive: true, isArchived: false, sortOrder: 1, children: [] },
    { id: 'prog-4', name: 'Archived Program', isActive: true, isArchived: true, sortOrder: 3, children: [] },
];
let adminUsers: AdminUser[] = [
    { id: 'user-1', name: 'Super Admin', email: 'super@al-ibaanah.com', role: Role.SuperAdmin, isActive: true },
    { id: 'user-2', name: 'Ahmed Ali', email: 'male.admin@al-ibaanah.com', role: Role.MaleAdmin, isActive: true },
    { id: 'user-3', name: 'Fatima Zahra', email: 'female.admin@al-ibaanah.com', role: Role.FemaleAdmin, isActive: true },
    { id: 'user-4', name: 'Yusuf Ibrahim', email: 'male.desk@al-ibaanah.com', role: Role.MaleFrontDesk, isActive: true },
    { id: 'user-5', name: 'Aisha Omar', email: 'female.desk@al-ibaanah.com', role: Role.FemaleFrontDesk, isActive: false },
];
let siteContent: SiteContent = {
    logoUrl: "https://res.cloudinary.com/di7okmjsx/image/upload/v1772398555/Al-Ibaanah_Vertical_Logo_pf389m.svg",
    officialSiteUrl: "https://ibaanah.com/",
    heroVideoUrl: { 
        en: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        ar: "https://www.youtube.com/embed/CenZeeJ3m_4"
    },
    faqItems: {
        en: [
            { question: "Do I need to register on the main site first?", answer: "Yes, the first step is always to complete the main registration on the official Al-Ibaanah website. This portal is for booking your mandatory on-campus assessment slot after you have registered." },
            { question: "What happens during the assessment?", answer: "The on-campus assessment is a friendly meeting with one of our instructors to gauge your current Arabic language proficiency. This helps us place you in the perfect level to ensure your success." }
        ],
        ar: [
            { question: "هل يجب أن أسجل في الموقع الرئيسي أولاً؟", answer: "نعم، الخطوة الأولى دائمًا هي إكمال التسجيل الرئيسي على موقع الإبانة الرسمي. هذه البوابة مخصصة لحجز موعد التقييم الإلزامي في الحرم الجامعي بعد التسجيل." },
        ],
        fr: [
            { question: "Dois-je m'inscrire d'abord sur le site principal ?", answer: "Oui, la première étape est toujours de compléter l'inscription principale sur le site officiel d'Al-Ibaanah. Ce portail sert à réserver votre créneau d'évaluation obligatoire sur le campus après votre inscription." }
        ],
        zh: [
            { question: "我需要先在主站点注册吗？", answer: "是的，第一步总是在 Al-Ibaanah 官方网站上完成主注册。此门户用于在您注册后预订您的强制性校内评估时段。" }
        ],
        ru: [
            { question: "Нужно ли мне сначала регистрироваться на основном сайте?", answer: "Да, первым шагом всегда является завершение основной регистрации на официальном сайте Al-Ibaanah. Этот портал предназначен для бронирования обязательного времени для оценки в кампусе после вашей регистрации." }
        ],
        uz: [
            { question: "Avval asosiy saytda roʻyxatdan oʻtishim kerakmi?", answer: "Ha, birinchi qadam har doim Al-Ibaanah rasmiy veb-saytida asosiy ro'yxatdan o'tishni yakunlashdir. Ushbu portal ro'yxatdan o'tganingizdan so'ng majburiy kampusda baholash vaqtini bron qilish uchun mo'ljallangan." }
        ]
    },
    campusAddress: "Block 12, Rd 18, Nasr City, Cairo, Egypt",
    campusHours: "Sunday - Thursday, 9:00 AM - 2:00 PM"
};
let notificationSettings: NotificationSettings = {
    confirmation: {
        enabled: true,
        subject: 'Your Al-Ibaanah Assessment is Confirmed!',
        body: 'As-salamu \'alaykum {{studentName}},\n\nYour assessment for {{level}} has been successfully booked for {{appointmentDate}} at {{appointmentTime}}.\nYour registration code is {{registrationCode}}.\n\nPlease find your admission slip attached.',
    },
    reminder24h: { enabled: true, subject: 'Reminder: Your Al-Ibaanah Assessment is Tomorrow', body: '...' },
    reminderDayOf: { enabled: false, subject: 'Reminder: Your Al-Ibaanah Assessment is Today', body: '...' },
};
let appSettings: AppSettings = { registrationOpen: true, maxDailyCapacity: 100 };

const generateMockData = () => {
  if (appointmentSlots.length > 0) return;
  const today = new Date();
  const dates = [0, 1, 2, 7, 8].map(d => {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    return date.toISOString().split('T')[0];
  });
  const times = [ { start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }];
  const genders = [Gender.Male, Gender.Female];
  dates.forEach(date => levels.forEach(level => times.forEach(time => genders.forEach(gender => {
    const capacity = Math.floor(Math.random() * 5) + 5;
    appointmentSlots.push({
      id: uuidv4(), date, level, levelId: level.id, startTime: time.start, endTime: time.end, capacity,
      booked: Math.floor(Math.random() * capacity),
      gender: gender,
    });
  }))));
};
generateMockData();

const simulateDelay = <T,>(data: T): Promise<T> => 
    new Promise(resolve => setTimeout(() => resolve(data === undefined ? data : JSON.parse(JSON.stringify(data))), 300));

// --- Auth ---
export const login = async (email: string, password: string): Promise<void> => {
    if (password === 'password123') {
        const user = adminUsers.find(u => u.email === email);
        if (user) return simulateDelay(undefined);
    }
    throw new Error('Invalid credentials.');
}
export const logout = async (): Promise<void> => simulateDelay(undefined);
export const getAdminUserProfile = async (userId: string): Promise<AdminUser | null> => simulateDelay(adminUsers.find(u => u.id === userId) || null);


// --- Public API ---
export const getAvailableDatesForLevel = async(levelId: string, gender: Gender): Promise<string[]> => {
    if (!appSettings.registrationOpen) return simulateDelay([]);
    const availableDates = appointmentSlots.filter(s => s.levelId === levelId && s.gender === gender && s.booked < s.capacity).map(s => s.date);
    return simulateDelay([...new Set(availableDates)].sort());
}

export const getAvailableSlots = async (date: string, levelId: string, gender: Gender): Promise<AppointmentSlot[]> => {
    if (!appSettings.registrationOpen) return simulateDelay([]);
    return simulateDelay(appointmentSlots.filter(s => s.date === date && s.levelId === levelId && s.gender === gender));
};

export const submitRegistration = async (formData: Omit<Student, 'id' | 'registrationCode' | 'appointmentSlotId' | 'status' | 'createdAt' | 'level'> & { appointmentSlotId: string }): Promise<Student> => {
    const slot = appointmentSlots.find(s => s.id === formData.appointmentSlotId);
    if (!slot || slot.booked >= slot.capacity) throw new Error("Slot is full or does not exist.");
    const studentLevel = levels.find(l => l.id === formData.levelId);
    if (!studentLevel) throw new Error("Invalid level ID provided.");

    const newStudent: Student = { ...formData, level: studentLevel, id: uuidv4(), registrationCode: `AI-${uuidv4().slice(0, 8).toUpperCase()}`, status: 'booked', createdAt: new Date().toISOString() };
    slot.booked++;
    students.push(newStudent);
    return simulateDelay(newStudent);
};


// --- Admin API ---
export const getAllStudents = async (page: number, pageSize: number, searchTerm: string, sortKey: string, sortDirection: string): Promise<{ students: Student[], count: number }> => {
    let filteredStudents = [...students];
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filteredStudents = filteredStudents.filter(s =>
            `${s.firstname} ${s.surname}`.toLowerCase().includes(lowerSearch) ||
            s.email.toLowerCase().includes(lowerSearch) ||
            s.registrationCode.toLowerCase().includes(lowerSearch)
        );
    }
    if (sortKey) {
        filteredStudents.sort((a, b) => {
            const valA = sortKey === 'level' ? a.level.name : a[sortKey as keyof Student];
            const valB = sortKey === 'level' ? b.level.name : b[sortKey as keyof Student];
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
    const count = filteredStudents.length;
    return simulateDelay({ students: filteredStudents.slice((page - 1) * pageSize, page * pageSize), count });
};

export const getDashboardData = async () => ({
    totalRegistered: students.length,
    breakdownByLevel: levels.map(l => ({ name: l.name, value: students.filter(s => s.level.id === l.id).length })),
    todayExpected: students.filter(s => s.intakeDate === new Date().toISOString().split('T')[0]).length,
    checkedIn: students.filter(s => s.intakeDate === new Date().toISOString().split('T')[0] && s.status === 'checked-in').length,
    slotUtilization: appointmentSlots.slice(0,10).map(s => ({ name: `${s.date} ${s.startTime}`, booked: s.booked, capacity: s.capacity })),
});

export const findStudent = async (query: string): Promise<Student | null> => simulateDelay(students.find(s => s.registrationCode.toLowerCase() === query.toLowerCase() || `${s.firstname} ${s.surname}`.toLowerCase().includes(query.toLowerCase())) || null);
export const checkInStudent = async (studentId: string): Promise<Student> => {
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error("Student not found");
    student.status = 'checked-in';
    return simulateDelay(student);
};

// --- Schedule ---
export const getSchedules = async (page: number, pageSize: number): Promise<{ slots: AppointmentSlot[], count: number }> => {
    const sorted = [...appointmentSlots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.startTime.localeCompare(b.startTime));
    return simulateDelay({ slots: sorted.slice((page - 1) * pageSize, page * pageSize), count: sorted.length });
};
export const getScheduleById = async (slotId: string): Promise<AppointmentSlot | null> => simulateDelay(appointmentSlots.find(s => s.id === slotId) || null);
export const createSchedule = async(slot: Omit<AppointmentSlot, 'id' | 'booked' | 'level'>): Promise<AppointmentSlot> => {
    const level = levels.find(l => l.id === slot.levelId);
    if (!level) throw new Error("Level not found");
    const newSlot: AppointmentSlot = { ...slot, id: uuidv4(), booked: 0, level };
    appointmentSlots.push(newSlot);
    return simulateDelay(newSlot);
};
export const updateSchedule = async(slot: Omit<AppointmentSlot, 'level'>): Promise<AppointmentSlot> => {
    const existing = appointmentSlots.find(s => s.id === slot.id);
    if (!existing) throw new Error("Slot not found");
    const level = levels.find(l => l.id === slot.levelId);
    if (!level) throw new Error("Level not found");
    Object.assign(existing, { ...slot, level });
    return simulateDelay(existing);
};
export const deleteSchedule = async(slotId: string): Promise<{ success: boolean }> => {
    appointmentSlots = appointmentSlots.filter(s => s.id !== slotId);
    return simulateDelay({ success: true });
};

// --- Levels ---
export const getLevels = async(includeInactive = false): Promise<Level[]> => simulateDelay([...levels].sort((a, b) => a.sortOrder - b.sortOrder).filter(l => includeInactive || l.isActive));
export const createLevel = async(level: Omit<Level, 'id'>): Promise<Level> => { const newLevel = { ...level, id: uuidv4() }; levels.push(newLevel); return simulateDelay(newLevel); };
export const updateLevel = async(level: Level): Promise<Level> => { levels = levels.map(l => l.id === level.id ? level : l); return simulateDelay(level); };
export const deleteLevel = async(levelId: string): Promise<{ success: boolean }> => { levels = levels.filter(l => l.id !== levelId); return simulateDelay({ success: true }); };

// --- Programs ---
export const getPrograms = async(): Promise<Program[]> => {
    const programsMap = new Map(programs.map(p => [p.id, { ...p, children: [] }]));
    const nested: Program[] = [];
    for (const program of programsMap.values()) {
        if (program.parentId && programsMap.has(program.parentId)) {
            programsMap.get(program.parentId)?.children?.push(program);
        } else {
            nested.push(program);
        }
    }
    return simulateDelay(nested);
};
export const createProgram = async(p: Omit<Program, 'id'>): Promise<Program> => { const newProg = { ...p, id: uuidv4() }; programs.push(newProg); return simulateDelay(newProg); };
export const updateProgram = async(p: Program): Promise<Program> => { programs = programs.map(prog => prog.id === p.id ? p : prog); return simulateDelay(p); };

// --- Site Content ---
export const getSiteContent = async(): Promise<SiteContent> => simulateDelay(siteContent);
export const updateSiteContent = async(key: keyof SiteContent, value: any): Promise<void> => { (siteContent as any)[key] = value; return simulateDelay(undefined); }

// --- Users ---
export const getAdminUsers = async (): Promise<AdminUser[]> => simulateDelay(adminUsers);
export const createAdminUser = async(user: Omit<AdminUser, 'id'>, password?: string): Promise<AdminUser> => { const newUser = { ...user, id: uuidv4() }; adminUsers.push(newUser); return simulateDelay(newUser); };
export const updateAdminUser = async(user: AdminUser): Promise<AdminUser> => { adminUsers = adminUsers.map(u => u.id === user.id ? user : u); return simulateDelay(user); };
export const deleteAdminUser = async(userId: string): Promise<{ success: boolean }> => { adminUsers = adminUsers.filter(u => u.id !== userId); return simulateDelay({ success: true }); };

// --- Settings ---
export const getNotificationSettings = async(): Promise<NotificationSettings> => simulateDelay(notificationSettings);
export const updateNotificationSettings = async(s: NotificationSettings): Promise<NotificationSettings> => { notificationSettings = s; return simulateDelay(s); };
export const getAppSettings = async(): Promise<AppSettings> => simulateDelay(appSettings);
export const updateAppSettings = async(s: AppSettings): Promise<AppSettings> => { appSettings = s; return simulateDelay(s); };