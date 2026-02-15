
import { Student, AppointmentSlot, Level, Gender, AdminUser, Role } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Mock Database
let students: Student[] = [];
let appointmentSlots: AppointmentSlot[] = [];
let adminUsers: AdminUser[] = [
    { id: 'user-1', name: 'Super Admin', email: 'super@al-ibaanah.com', role: Role.SuperAdmin, isActive: true },
    { id: 'user-2', name: 'Ahmed Ali', email: 'ahmed.ali@al-ibaanah.com', role: Role.MaleAdmin, isActive: true },
    { id: 'user-3', name: 'Fatima Zahra', email: 'fatima.zahra@al-ibaanah.com', role: Role.FemaleAdmin, isActive: true },
    { id: 'user-4', name: 'Yusuf Ibrahim', email: 'yusuf.ibrahim@al-ibaanah.com', role: Role.MaleFrontDesk, isActive: true },
    { id: 'user-5', name: 'Aisha Omar', email: 'aisha.omar@al-ibaanah.com', role: Role.FemaleFrontDesk, isActive: false },
];

// Helper to generate mock data
const generateMockData = () => {
  if (appointmentSlots.length > 0) return;
  const today = new Date();
  const dates = [0, 1, 2, 7, 8].map(d => {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    return date.toISOString().split('T')[0];
  });

  const levels = [Level.Beginner, Level.Elementary, Level.Intermediate, Level.Advanced];
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
        appointmentSlots.push({
          id: uuidv4(),
          date,
          level,
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

export const getAvailableSlots = async (date: string, level: Level): Promise<AppointmentSlot[]> => {
    const filteredSlots = appointmentSlots.filter(slot => slot.date === date && slot.level === level);
    return simulateDelay(filteredSlots);
};

export const submitRegistration = async (
    formData: Omit<Student, 'id' | 'registrationCode' | 'appointmentSlotId' | 'status' | 'createdAt'> & { appointmentSlotId: string }
): Promise<Student> => {
    const slot = appointmentSlots.find(s => s.id === formData.appointmentSlotId);
    if (!slot || slot.booked >= slot.capacity) {
        throw new Error("Slot is full or does not exist.");
    }

    const newStudent: Student = {
        ...formData,
        id: uuidv4(),
        registrationCode: `AI-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        status: 'booked',
        createdAt: new Date(),
    };
    
    slot.booked += 1;
    students.push(newStudent);

    return simulateDelay(newStudent);
};

export const getDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const todaysBookings = students.filter(s => {
        const slot = appointmentSlots.find(sl => sl.id === s.appointmentSlotId);
        return slot?.date === today;
    });

    return simulateDelay({
        totalRegistered: students.length,
        breakdownByLevel: Object.values(Level).map(level => ({
            name: level,
            value: students.filter(s => s.level === level).length,
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

export const getAdminUsers = async (): Promise<AdminUser[]> => {
    return simulateDelay(adminUsers);
};

export const updateAdminUser = async(user: AdminUser): Promise<AdminUser> => {
    adminUsers = adminUsers.map(u => u.id === user.id ? user : u);
    return simulateDelay(user);
}

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

export const getSchedules = async (): Promise<AppointmentSlot[]> => {
    return simulateDelay(appointmentSlots);
};

export const updateSchedule = async(slot: AppointmentSlot): Promise<AppointmentSlot> => {
    appointmentSlots = appointmentSlots.map(s => s.id === slot.id ? slot : s);
    return simulateDelay(slot);
}
