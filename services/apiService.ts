
import { supabase } from './supabaseClient';
import { Student, AppointmentSlot, Level, AdminUser, Role, NotificationSettings, AppSettings } from '../types';

// Helper function to convert student data from snake_case to camelCase
const studentFromSupabase = (s: any): Student => ({
    id: s.id,
    surname: s.surname,
    firstname: s.firstname,
    othername: s.othername,
    whatsapp: s.whatsapp,
    email: s.email,
    gender: s.gender,
    address: s.address,
    level: s.level,
    intakeDate: s.intake_date,
    registrationCode: s.registration_code,
    appointmentSlotId: s.appointment_slot_id,
    status: s.status,
    createdAt: s.created_at,
});


// --- Authentication ---
export const login = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
};

export const logout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

export const getAdminUserProfile = async (userId: string): Promise<AdminUser | null> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error("Error fetching profile:", error);
        throw new Error("User profile not found or permission denied.");
    }
    return { ...data, isActive: data.is_active };
}


// --- Student Public API ---
export const getAvailableDatesForLevel = async(level: Level): Promise<string[]> => {
    const settings = await getAppSettings();
    if (!settings.registrationOpen) return [];
    
    // FIX: Replaced the failing RPC call with a query to a new, efficient database VIEW.
    // This is a more robust way to filter for slots with available capacity and avoids
    // potential schema cache issues with PostgREST.
    const { data, error } = await supabase
        .from('available_appointment_slots')
        .select('date')
        .eq('level', level);

    if (error) {
        console.error('Error fetching available dates:', error);
        return [];
    }
    
    if (!data) return [];

    // Process the data to get unique, sorted dates, as this is now done client-side.
    const uniqueDates = [...new Set(data.map(slot => slot.date))] as string[];
    uniqueDates.sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
    return uniqueDates;
}


export const getAvailableSlots = async (date: string, level: Level): Promise<AppointmentSlot[]> => {
    const { data, error } = await supabase
        .from('appointment_slots')
        .select('*')
        .eq('date', date)
        .eq('level', level);

    if (error) {
        console.error('Error fetching slots:', error);
        return [];
    }
    return data.map(d => ({ ...d, startTime: d.start_time, endTime: d.end_time }));
};

export const submitRegistration = async (
    formData: Omit<Student, 'id' | 'registrationCode' | 'status' | 'createdAt'> & { appointmentSlotId: string }
): Promise<Student> => {
    const { appointmentSlotId, ...studentData } = formData;
    
    const { data, error } = await supabase.rpc('submit_student_registration', {
        slot_id: appointmentSlotId,
        student_data: studentData
    });

    if (error) {
        console.error("Error in submit_student_registration RPC:", error);
        throw new Error(error.message || "Failed to submit registration. The slot may have been filled.");
    }

    return data as Student;
};

// --- Admin API ---
export const getAllStudents = async (): Promise<Student[]> => {
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all students:', error);
        return [];
    }
    return data.map(studentFromSupabase);
};

export const getDashboardData = async () => {
    const { data, error } = await supabase.rpc('get_dashboard_statistics');

    if (error || !data) {
        console.error("Dashboard data fetch error:", error);
        throw new Error('Failed to fetch dashboard data.');
    }

    // The RPC function returns a perfectly shaped object, but we map slotUtilization
    // to match the specific format the charting library expects.
    return {
        ...data,
        slotUtilization: Array.isArray(data.slotUtilization) 
            ? data.slotUtilization.map((s: any) => ({
                name: `${s.date} ${s.start_time}`,
                booked: s.booked,
                capacity: s.capacity,
              }))
            : [],
    };
};

export const findStudent = async (query: string): Promise<Student | null> => {
    const lowerCaseQuery = query.toLowerCase();
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .or(`registration_code.ilike.%${lowerCaseQuery}%,email.ilike.%${lowerCaseQuery}%,whatsapp.ilike.%${query}%`)
        .limit(1)
        .maybeSingle(); // Use maybeSingle to avoid error if no row is found
    
    if (!error && data) {
      return studentFromSupabase(data);
    }
    
    const { data: allStudents, error: allErr } = await supabase.from('students').select('*');
    if (allErr) return null;
    const found = allStudents.find(s => `${s.firstname} ${s.surname}`.toLowerCase().includes(lowerCaseQuery));
    return found ? studentFromSupabase(found) : null;
};

export const checkInStudent = async (studentId: string): Promise<Student> => {
    const { data, error } = await supabase
        .from('students')
        .update({ status: 'checked-in' })
        .eq('id', studentId)
        .select()
        .single();

    if (error) throw new Error("Failed to check in student.");
    return studentFromSupabase(data);
};


// --- Schedule Management ---
export const getSchedules = async (page: number, pageSize: number): Promise<{ slots: AppointmentSlot[], count: number }> => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
        .from('appointment_slots')
        .select('*', { count: 'exact' })
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .range(from, to);

    if (error) throw error;
    
    const slots = data.map(d => ({ ...d, startTime: d.start_time, endTime: d.end_time }));
    
    return { slots, count: count ?? 0 };
};


export const getScheduleById = async (slotId: string): Promise<AppointmentSlot | null> => {
    const { data, error } = await supabase
        .from('appointment_slots')
        .select('*')
        .eq('id', slotId)
        .single();

    if (error) {
        console.error("Error fetching schedule by ID:", error);
        return null;
    }
    
    return data ? { ...data, startTime: data.start_time, endTime: data.end_time } : null;
};

export const createSchedule = async(slot: Omit<AppointmentSlot, 'id' | 'booked'>): Promise<AppointmentSlot> => {
    const { startTime, endTime, ...rest } = slot;
    const { data, error } = await supabase.from('appointment_slots').insert({ ...rest, start_time: startTime, end_time: endTime }).select().single();
    if (error) throw error;
    return { ...data, startTime: data.start_time, endTime: data.end_time };
};

export const updateSchedule = async(slot: AppointmentSlot): Promise<AppointmentSlot> => {
    const { startTime, endTime, ...rest } = slot;
    const { data, error } = await supabase.from('appointment_slots').update({ ...rest, start_time: startTime, end_time: endTime }).eq('id', slot.id).select().single();
    if (error) throw error;
    return { ...data, startTime: data.start_time, endTime: data.end_time };
};

export const deleteSchedule = async(slotId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('appointment_slots').delete().eq('id', slotId);
    if (error) throw error;
    return { success: true };
};


// --- User Management ---
export const getAdminUsers = async (): Promise<AdminUser[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return data.map(u => ({ ...u, isActive: u.is_active }));
};

export const createAdminUser = async(user: Omit<AdminUser, 'id'>, password: string): Promise<AdminUser> => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: user.email,
        password: password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Could not create user account.");

    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: authData.user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            is_active: user.isActive,
        })
        .select()
        .single();
    
    if (profileError) {
        throw profileError;
    }

    return { ...profileData, isActive: profileData.is_active };
};

export const updateAdminUser = async(user: AdminUser): Promise<AdminUser> => {
    const { isActive, ...rest } = user;
    const { data, error } = await supabase.from('profiles').update({ ...rest, is_active: isActive }).eq('id', user.id).select().single();
    if (error) throw error;
    return { ...data, isActive: data.is_active };
};

export const deleteAdminUser = async(userId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    return { success: true };
};


// --- Notification Settings ---
export const getNotificationSettings = async(): Promise<NotificationSettings> => {
    const { data, error } = await supabase.from('notification_settings').select('settings').eq('id', 1).single();
    if (error) throw error;
    return data.settings;
};
export const updateNotificationSettings = async(settings: NotificationSettings): Promise<NotificationSettings> => {
    const { data, error } = await supabase.from('notification_settings').update({ settings }).eq('id', 1).select('settings').single();
    if (error) throw error;
    return data.settings;
};


// --- App Settings ---
export const getAppSettings = async(): Promise<AppSettings> => {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (error) throw error;
    return { registrationOpen: data.registration_open, maxDailyCapacity: data.max_daily_capacity };
};
export const updateAppSettings = async(settings: AppSettings): Promise<AppSettings> => {
    const { registrationOpen, maxDailyCapacity } = settings;
    const { data, error } = await supabase.from('app_settings').update({ registration_open: registrationOpen, max_daily_capacity: maxDailyCapacity }).eq('id', 1).select().single();
    if (error) throw error;
    return { registrationOpen: data.registration_open, maxDailyCapacity: data.max_daily_capacity };
};
