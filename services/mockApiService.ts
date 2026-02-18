import { Student, AppointmentSlot, Level, Gender, AdminUser, Role, NotificationSettings, AppSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Mock Database
let students: Student[] = [];
let appointmentSlots: AppointmentSlot[] = [];
// FIX: Level is an interface, not an enum. Provide mock data for levels.
// FIX: Changed from const to let to allow modification.
let levels: Level[] = [
    { id: 'level-1', name: 'Beginner', isActive: true, sortOrder: 1 },
    { id: 'level-2', name: 'Elementary', isActive: true, sortOrder: 2 },
    { id: 'level-3', name: 'Intermediate', isActive: true, sortOrder: 3 },
    { id: 'level-4', name: 'Advanced', isActive: true, sortOrder: 4 },
];
let adminUsers: AdminUser[] = [
    { id: 'user-1', name: 'Super Admin', email: 'super@al-ibaanah.com', role: Role.SuperAdmin, isActive: true },
    { id: 'user-2', name: 'Ahmed Ali', email: 'male.admin@al-ibaanah.com', role: Role.MaleAdmin, isActive: true },
    { id: 'user-3', name: 'Fatima Zahra', email: 'female.admin@al-ibaanah.com', role: Role.FemaleAdmin, isActive: true },
    { id: 'user-4', name: 'Yusuf Ibrahim', email: 'male.desk@al-ibaanah.com', role: Role.MaleFrontDesk, isActive: true },
    { id: 'user-5', name: 'Aisha Omar', email: 'female.desk@al-ibaanah.com', role: Role.FemaleFrontDesk, isActive: false },
];
let notificationSettings: NotificationSettings = {
    confirmation: {
        enabled: true,
        subject: 'Your Al-Ibaanah Assessment is Confirmed!',
        body: 'As-salamu \'alaykum {{studentName}},\n\nYour assessment for {{level}} has been successfully booked for {{appointmentDate}} at {{appointmentTime}}.\nYour registration code is {{registrationCode}}.\n\nPlease find your admission slip attached.',
    },
    reminder24h: {
        enabled: true,
        subject: 'Reminder: Your Al-Ibaanah Assessment is Tomorrow',
        body: 'As-salamu \'alaykum {{studentName}},\n\nThis is a reminder that your assessment for {{level}} is scheduled for tomorrow, {{appointmentDate}} at {{appointmentTime}}.\n\nWe look forward to seeing you.',
    },
    reminderDayOf: {
        enabled: false,
        subject: 'Reminder: Your Al-Ibaanah Assessment is Today',
        body: 'As-salamu \'alaykum {{studentName}},\n\nYour assessment is today at {{appointmentTime}}. Please arrive on time with the required documents.\n\nAl-Ibaanah Administration',
    },
};
let appSettings: AppSettings = {
    registrationOpen: true,
    maxDailyCapacity: 100,
};

// Helper to generate mock data
const generateMockData = () => {
  if (appointmentSlots.length > 0) return;
  const today = new Date();
  const dates = [0, 1, 2, 7, 8].map(d => {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    return date.toISOString().split('T')[0];
  });

  // FIX: 'Level' is a type, not a value. The `levels` array should be used instead.
  // const levels = [Level.Beginner, Level.Elementary, Level.Intermediate, Level.Advanced];
  const times = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '13:00', end: '14:00' },
  ];

  dates.forEach(date => {
    levels.forEach(level => {
      times.forEach(time => {
        const capacity = Math.floor(Math.random() * 5) + 5; // 5-9
        // FIX: Add missing 'levelId' property to the AppointmentSlot object.
        appointmentSlots.push({
          id: uuidv4(),
          date,
          level,
          levelId: level.id,
          startTime: time.start,
          endTime: time.end,
          capacity,
          booked: Math.floor(Math.random() * capacity), // Randomly booked slots
        });
      });
    });
  });
};

generateMockData();

const simulateDelay = <T,>(data: T): Promise<T> => 
    new Promise(resolve => setTimeout(() => resolve(data), 500));

// --- Student Public API ---
// FIX: Update function to accept levelId string and filter accordingly.
export const getAvailableDatesForLevel = async(levelId: string): Promise<string[]> => {
    if (!appSettings.registrationOpen) return simulateDelay([]);
    const availableDates = appointmentSlots
        .filter(slot => slot.levelId === levelId && slot.booked < slot.capacity)
        .map(slot => slot.date);
    
    const uniqueDates = [...new Set(availableDates)];
    uniqueDates.sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
    
    return simulateDelay(uniqueDates);
}


// FIX: Update function to accept levelId string and filter accordingly.
export const getAvailableSlots = async (date: string, levelId: string): Promise<AppointmentSlot[]> => {
    if (!appSettings.registrationOpen) return simulateDelay([]);
    const filteredSlots = appointmentSlots.filter(slot => slot.date === date && slot.levelId === levelId);
    return simulateDelay(filteredSlots);
};

export const submitRegistration = async (
    // FIX: Omit `level` as it's not provided in form data; it will be derived from `levelId`.
    formData: Omit<Student, 'id' | 'registrationCode' | 'appointmentSlotId' | 'status' | 'createdAt' | 'level'> & { appointmentSlotId: string }
): Promise<Student> => {
    const slot = appointmentSlots.find(s => s.id === formData.appointmentSlotId);
    if (!slot || slot.booked >= slot.capacity) {
        throw new Error("Slot is full or does not exist.");
    }
    
    const studentLevel = levels.find(l => l.id === formData.levelId);
    if (!studentLevel) {
        throw new Error("Invalid level ID provided.");
    }

    const newStudent: Student = {
        ...formData,
        level: studentLevel,
        id: uuidv4(),
        registrationCode: `AI-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        status: 'booked',
        createdAt: new Date().toISOString(),
    };
    
    slot.booked += 1;
    students.push(newStudent);

    return simulateDelay(newStudent);
};

// --- Admin API ---
export const getAllStudents = async (): Promise<Student[]> => {
    return simulateDelay(students);
};

export const getDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const todaysBookings = students.filter(s => {
        const slot = appointmentSlots.find(sl => sl.id === s.appointmentSlotId);
        return slot?.date === today;
    });

    return simulateDelay({
        totalRegistered: students.length,
        // FIX: 'Level' is a type, not a value. Use the mock `levels` array and compare by ID.
        breakdownByLevel: levels.map(level => ({
            name: level.name,
            value: students.filter(s => s.level.id === level.id).length,
        })),
        todayExpected: todaysBookings.length,
        checkedIn: todaysBookings.filter(s => s.status === 'checked-in').length,
        slotUtilization: appointmentSlots.map(s => ({
            name: `${s.date} ${s.startTime}`,
            booked: s.booked,
            capacity: s.capacity,
        })),
    });
};

export const findStudent = async (query: string): Promise<Student | null> => {
    const lowerCaseQuery = query.toLowerCase();
    const student = students.find(s => 
        s.registrationCode.toLowerCase() === lowerCaseQuery ||
        `${s.firstname} ${s.surname}`.toLowerCase().includes(lowerCaseQuery) ||
        s.whatsapp.includes(query)
    );
    return simulateDelay(student || null);
};

export const checkInStudent = async (studentId: string): Promise<Student> => {
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error("Student not found");
    if (student.status === 'checked-in') throw new Error("Student already checked in");

    student.status = 'checked-in';
    return simulateDelay(student);
};


// --- Schedule Management ---
export const getSchedules = async (): Promise<AppointmentSlot[]> => {
    return simulateDelay([...appointmentSlots].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.startTime.localeCompare(b.startTime)));
};

export const getScheduleById = async (slotId: string): Promise<AppointmentSlot | null> => {
    const slot = appointmentSlots.find(s => s.id === slotId);
    return simulateDelay(slot || null);
}

export const createSchedule = async(slot: Omit<AppointmentSlot, 'id' | 'booked'>): Promise<AppointmentSlot> => {
    const newSlot: AppointmentSlot = {
        ...slot,
        id: uuidv4(),
        booked: 0,
    };
    appointmentSlots.push(newSlot);
    return simulateDelay(newSlot);
};

export const updateSchedule = async(slot: AppointmentSlot): Promise<AppointmentSlot> => {
    appointmentSlots = appointmentSlots.map(s => s.id === slot.id ? slot : s);
    return simulateDelay(slot);
};

export const deleteSchedule = async(slotId: string): Promise<{ success: boolean }> => {
    appointmentSlots = appointmentSlots.filter(s => s.id !== slotId);
    return simulateDelay({ success: true });
};


// --- Level Management (Added mock implementations) ---
export const getLevels = async(includeInactive = false): Promise<Level[]> => {
    const sortedLevels = [...levels].sort((a, b) => a.sortOrder - b.sortOrder);
    if (includeInactive) {
        return simulateDelay(sortedLevels);
    }
    return simulateDelay(sortedLevels.filter(l => l.isActive));
};

export const createLevel = async(level: Omit<Level, 'id'>): Promise<Level> => {
    const newLevel: Level = { ...level, id: uuidv4() };
    levels.push(newLevel);
    return simulateDelay(newLevel);
};

export const updateLevel = async(level: Level): Promise<Level> => {
    levels = levels.map(l => l.id === level.id ? level : l);
    return simulateDelay(level);
};

export const deleteLevel = async(levelId: string): Promise<{ success: boolean }> => {
    levels = levels.filter(l => l.id !== levelId);
    return simulateDelay({ success: true });
};

// --- User Management ---
export const getAdminUsers = async (): Promise<AdminUser[]> => {
    return simulateDelay(adminUsers);
};

export const createAdminUser = async(user: Omit<AdminUser, 'id'>): Promise<AdminUser> => {
    const newUser: AdminUser = {
        ...user,
        id: uuidv4(),
    };
    adminUsers.push(newUser);
    return simulateDelay(newUser);
};

export const updateAdminUser = async(user: AdminUser): Promise<AdminUser> => {
    adminUsers = adminUsers.map(u => u.id === user.id ? user : u);
    return simulateDelay(user);
};

export const deleteAdminUser = async(userId: string): Promise<{ success: boolean }> => {
    const user = adminUsers.find(u => u.id === userId);
    if (user?.role === Role.SuperAdmin) {
        throw new Error("Cannot delete Super Admin account.");
    }
    adminUsers = adminUsers.filter(u => u.id !== userId);
    return simulateDelay({ success: true });
};


// --- Notification Settings ---
export const getNotificationSettings = async(): Promise<NotificationSettings> => {
    return simulateDelay(notificationSettings);
};
export const updateNotificationSettings = async(settings: NotificationSettings): Promise<NotificationSettings> => {
    notificationSettings = settings;
    return simulateDelay(notificationSettings);
};


// --- App Settings ---
export const getAppSettings = async(): Promise<AppSettings> => {
    return simulateDelay(appSettings);
};
export const updateAppSettings = async(settings: AppSettings): Promise<AppSettings> => {
    appSettings = settings;
    return simulateDelay(appSettings);
};