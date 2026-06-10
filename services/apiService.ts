
import { supabase } from './supabaseClient';
import { Student, AppointmentSlot, Level, AdminUser, NotificationSettings, AppSettings, SiteContent, Gender } from '../types';


const fetchWithTimeout = async (resource: string, options: RequestInit & { timeout?: number } = {}) => {
    const { timeout = 15000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(resource, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);
    return response;
};

// Helper function to convert student data from snake_case to camelCase
const studentFromSupabase = (s: Record<string, unknown>): Student => ({ // Using unknown is safer than any
    id: s.id,
    surname: s.surname,
    firstname: s.firstname,
    othername: s.othername,
    whatsapp: s.whatsapp,
    email: s.email,
    gender: s.gender,
    address: s.address,
    buildingNumber: s.building_number,
    flatNumber: s.flat_number,
    streetName: s.street_name,
    district: s.district,
    state: s.state,
    level: s.levels, // Supabase returns joined table as plural 'levels'
    levelId: s.level_id || '',
    intakeDate: s.intake_date,
    registrationCode: s.registration_code,
    appointmentSlotId: s.appointment_slot_id,
    status: s.status,
    language: s.language || 'en',
    createdAt: s.created_at,
});

const slotFromSupabase = (d: Record<string, unknown>): AppointmentSlot => ({ // Using unknown is safer than any
    id: d.id,
    startTime: d.start_time,
    endTime: d.end_time,
    capacity: d.capacity,
    booked: d.booked,
    level: d.levels, // Joined table data
    levelId: d.level_id,
    gender: d.gender,
    date: d.date,
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

export const sendOTP = async (email: string): Promise<Record<string, unknown>> => {
    console.log('>>> Sending custom 6-digit OTP to:', email);
    const response = await fetch(`${window.location.origin}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        let errorMessage = 'Failed to send verification code';
        
        if (response.status === 429) {
            errorMessage = data.error || 'Daily email quota reached';
        } else {
            errorMessage = data.details || data.error || data.message || errorMessage;
        }

        const error = new Error(errorMessage) as Error & { status?: number; code?: string };
        error.status = response.status;
        error.code = data.code; // Development OTP if provided
        throw error;
    }

    return data;
};

export const verifyOTP = async (email: string, token: string): Promise<void> => {
    console.log('>>> Verifying custom OTP for:', email);
    const response = await fetch(`${window.location.origin}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: token }),
    });

    if (!response.ok) {
        let errorMessage = 'Invalid or expired verification code';
        const text = await response.text();
        console.error(`>>> verifyOTP failed with status ${response.status}:`, text);
        try {
            const errorData = JSON.parse(text);
            // Prefer details for debugging, then error, then message
            errorMessage = errorData.details || errorData.error || errorData.message || errorMessage;
        } catch (e) {
            const cleanText = text.length > 100 ? text.substring(0, 100) + '...' : text;
            errorMessage = `Server error (${response.status}): ${cleanText || response.statusText || 'Unknown error'}. Please ensure the backend is running and configured correctly.`;
            console.error('>>> Non-JSON error response in verifyOTP:', e, text);
        }
        throw new Error(errorMessage);
    }
};

/**
 * Saves student data as a "pre-registration" before slot booking.
 * This ensures we have the student's details even if they don't finish booking.
 */
export const savePreRegistration = async (studentData: Record<string, unknown>): Promise<void> => {
    console.log('>>> Saving pre-registration data to Supabase:', studentData);
    
    const { error } = await supabase
        .from('pre_registrations')
        .upsert({
            email: (studentData.email as string).toLowerCase(),
            first_name: studentData.firstname,
            surname: studentData.surname,
            form_data: studentData,
            language: studentData.language || 'en',
            verified_at: new Date().toISOString()
        }, { onConflict: 'email' });

    if (error) {
        console.error('>>> savePreRegistration error:', error);
        // We don't throw here to avoid blocking the user if the pre-registration table doesn't exist yet
        // or has RLS issues, as the final registration is the most important.
    }
};

export const checkSession = async (email?: string): Promise<boolean> => {
    // 1. Check local session (most reliable if in same browser/tab)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email?.toLowerCase() === email?.toLowerCase()) return true;

    // 2. If no local session and email provided, check server-side confirmation status
    // This handles the case where the user verified in a different tab/context
    if (email) {
        try {
            // Check both admin confirmation and student verification
            const [confirmedRes, verifiedRes] = await Promise.all([
                fetch(`${window.location.origin}/api/auth/is-confirmed?email=${encodeURIComponent(email)}`),
                fetch(`${window.location.origin}/api/auth/is-verified?email=${encodeURIComponent(email)}`)
            ]);

            if (confirmedRes.ok) {
                const data = await confirmedRes.json();
                if (data.confirmed) return true;
            }

            if (verifiedRes.ok) {
                const data = await verifiedRes.json();
                if (data.verified) return true;
            }
        } catch (err) {
            console.error('Error checking confirmation status:', err);
        }
    }

    return false;
};

export const getAdminUserProfile = async (userId: string): Promise<AdminUser | null> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error("Error fetching profile:", error);
            return null;
        }
        return { ...data, isActive: data.is_active };
    } catch (err) {
        console.error("Critical error fetching profile:", err);
        return null;
    }
}


// --- Student Public API ---
export const getAvailableDatesForLevel = async(levelId: string, gender: Gender): Promise<string[]> => {
    console.log('>>> Fetching dates for level:', levelId, 'gender:', gender);
    const settings = await getAppSettings();
    console.log('>>> App settings:', settings);
    if (!settings.isRegistrationOpen) {
        console.warn('>>> Registration is CLOSED');
        return [];
    }
    
    const { data, error } = await supabase
        .from('available_appointment_slots')
        .select('date')
        .eq('level_id', levelId)
        .eq('gender', gender);
    
    console.log('>>> Supabase response (dates):', { data, error });

    if (error) {
        console.error('Error fetching available dates:', error);
        return [];
    }
    
    if (!data) return [];

    const uniqueDates = [...new Set(data.map(slot => slot.date))] as string[];
    uniqueDates.sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
    return uniqueDates;
}


export const getAvailableSlots = async (date: string, levelId: string, gender: Gender): Promise<AppointmentSlot[]> => {
    const { data, error } = await supabase
        .from('appointment_slots')
        .select('*, levels(name)')
        .eq('date', date)
        .eq('level_id', levelId)
        .eq('gender', gender);

    if (error) {
        console.error('Error fetching slots:', error);
        return [];
    }
    return data.map(slotFromSupabase);
};

export const submitRegistration = async (
    formData: Omit<Student, 'id' | 'registrationCode' | 'status' | 'createdAt' | 'level'> & { appointmentSlotId: string }
): Promise<Student> => {
    const { appointmentSlotId, ...studentData } = formData;
    
    console.log('>>> Submitting registration via backend API...');
    const response = await fetch(`${window.location.origin}/api/enroll/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slotId: appointmentSlotId,
            studentData
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit registration. Please try again.");
    }

    const { student } = await response.json();
    return studentFromSupabase(student);
};

// --- Admin API ---
export const getAllStudents = async (
    page: number,
    pageSize: number,
    searchTerm: string,
    sortKey: string,
    sortDirection: string,
    filters?: {
        intakeDate?: string;
        appointmentSlotId?: string | string[];
        gender?: Gender;
    }
): Promise<{ students: Student[], count: number }> => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('students')
        .select('*, levels(name)', { count: 'exact' });

    if (searchTerm) {
        const searchIlke = `%${searchTerm}%`;
        query = query.or(`firstname.ilike.${searchIlke},surname.ilike.${searchIlke},email.ilike.${searchIlke},registration_code.ilike.${searchIlke}`);
    }

    if (filters?.intakeDate) {
        query = query.eq('intake_date', filters.intakeDate);
    }

    if (filters?.appointmentSlotId) {
        if (Array.isArray(filters.appointmentSlotId)) {
            query = query.in('appointment_slot_id', filters.appointmentSlotId);
        } else {
            query = query.eq('appointment_slot_id', filters.appointmentSlotId);
        }
    }

    if (filters?.gender) {
        query = query.eq('gender', filters.gender);
    }

    if (sortKey) {
        const dbSortKey = sortKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        query = query.order(dbSortKey, { ascending: sortDirection === 'asc' });
    } else {
        query = query.order('created_at', { ascending: false });
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching students:', error);
        throw error;
    }
    return { students: data.map(studentFromSupabase), count: count ?? 0 };
};

export const getAllStudentsForExport = async (
    searchTerm: string,
    sortKey: string,
    sortDirection: string,
    filters?: {
        intakeDate?: string;
        appointmentSlotId?: string | string[];
        gender?: Gender;
    }
): Promise<Student[]> => {
    let query = supabase
        .from('students')
        .select('*, levels(name)');

    if (searchTerm) {
        const searchIlke = `%${searchTerm}%`;
        query = query.or(`firstname.ilike.${searchIlke},surname.ilike.${searchIlke},email.ilike.${searchIlke},registration_code.ilike.${searchIlke}`);
    }

    if (filters?.intakeDate) {
        query = query.eq('intake_date', filters.intakeDate);
    }

    if (filters?.appointmentSlotId) {
        if (Array.isArray(filters.appointmentSlotId)) {
            query = query.in('appointment_slot_id', filters.appointmentSlotId);
        } else {
            query = query.eq('appointment_slot_id', filters.appointmentSlotId);
        }
    }

    if (filters?.gender) {
        query = query.eq('gender', filters.gender);
    }

    if (sortKey) {
        const dbSortKey = sortKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        query = query.order(dbSortKey, { ascending: sortDirection === 'asc' });
    } else {
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching students for export:', error);
        throw error;
    }
    return data.map(studentFromSupabase);
};

export const getDashboardData = async () => {
    const { data, error } = await supabase.rpc('get_dashboard_statistics');

    if (error || !data) {
        console.error("Dashboard data fetch error:", error);
        throw new Error('Failed to fetch dashboard data.');
    }

    return {
        ...data,
        slotUtilization: Array.isArray(data.slotUtilization) 
            ? data.slotUtilization.map((s: Record<string, unknown>) => ({ // Using unknown is safer than any
                name: `${s.date || ''} ${s.start_time || ''}`.trim() || 'Unknown Slot',
                booked: Number(s.booked) || 0,
                capacity: Number(s.capacity) || 0,
              }))
            : [],
    };
};

export const findStudent = async (query: string): Promise<Student | null> => {
    if (!query) return null;

    const { data, error } = await supabase
      .rpc('search_students', { search_term: query })
      .select('*, levels(name)')
      .limit(1)
      .maybeSingle();

    if (error) {
        console.error("Error finding student via RPC:", error);
        return null;
    }

    return data ? studentFromSupabase(data) : null;
};

export const requestManageBookingOTP = async (email: string): Promise<Record<string, unknown>> => {
    const response = await fetch(`${window.location.origin}/api/manage/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error || 'Failed to send verification code') as Error & { status?: number };
        error.status = response.status;
        throw error;
    }

    return data;
};

export const verifyManageBookingOTP = async (email: string, code: string): Promise<Student> => {
    const response = await fetch(`${window.location.origin}/api/manage/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid or expired verification code');
    }
    const data = await response.json();
    return studentFromSupabase(data.student);
};

export const getLevelsWithSlots = async(gender: Gender): Promise<Level[]> => {
    try {
        // First get levels that are active
        const { data: levels, error: levelsError } = await supabase
            .from('levels')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
        
        if (levelsError) throw levelsError;

        // Then get level IDs that have slots for this gender with remaining capacity
        const { data: activeSlots, error: slotsError } = await supabase
            .from('appointment_slots')
            .select('level_id, capacity, booked')
            .eq('gender', gender);
        
        if (slotsError) throw slotsError;

        const levelIdsWithSlots = new Set(
            activeSlots
                .filter(s => (s.capacity || 0) > (s.booked || 0))
                .map(s => s.level_id)
        );
        
        return levels
            .filter(l => levelIdsWithSlots.has(l.id))
            .map(l => ({...l, isActive: l.is_active, sortOrder: l.sort_order}));
    } catch (err) {
        console.error("Failed to fetch levels with slots:", err);
        return [];
    }
};

export const renewSession = async (): Promise<void> => {
    const response = await fetch(`${window.location.origin}/api/manage/renew-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to renew session');
    }
};

export const resendConfirmationEmail = async (studentId: string): Promise<void> => {
    const response = await fetch(`${window.location.origin}/api/manage/resend-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to resend confirmation email');
    }
};

export const updateStudentDetails = async (studentId: string, updates: Partial<Student>): Promise<Student> => {
    // Map camelCase to snake_case for database
    const dbUpdates: Record<string, unknown> = {};
    if (updates.firstname) dbUpdates.firstname = updates.firstname;
    if (updates.othername !== undefined) dbUpdates.othername = updates.othername;
    if (updates.surname) dbUpdates.surname = updates.surname;
    if (updates.whatsapp) dbUpdates.whatsapp = updates.whatsapp;
    if (updates.address) dbUpdates.address = updates.address;
    if (updates.buildingNumber) dbUpdates.building_number = updates.buildingNumber;
    if (updates.flatNumber) dbUpdates.flat_number = updates.flatNumber;
    if (updates.streetName) dbUpdates.street_name = updates.streetName;
    if (updates.district) dbUpdates.district = updates.district;
    if (updates.state) dbUpdates.state = updates.state;
    if (updates.levelId) dbUpdates.level_id = updates.levelId;
    if (updates.gender) dbUpdates.gender = updates.gender;
    if (updates.intakeDate) dbUpdates.intake_date = updates.intakeDate;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.email) dbUpdates.email = updates.email;

    if (Object.keys(dbUpdates).length === 0) {
        throw new Error("No changes detected.");
    }

    const response = await fetch(`${window.location.origin}/api/manage/update-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, updates: dbUpdates }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update details');
    }

    const data = await response.json();
    return studentFromSupabase(data.student);
};

export const deleteStudent = async (studentId: string): Promise<void> => {
    const response = await fetch(`${window.location.origin}/api/manage/delete-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete student record');
    }
};

export const getAdminFilterOptions = async (): Promise<{ dates: string[] }> => {
    const { data, error } = await supabase
        .from('appointment_slots')
        .select('date');
    
    if (error) {
        console.error('Error fetching filter dates:', error);
        return { dates: [] };
    }
    
    const uniqueDates = [...new Set(data.map(d => d.date))].sort();
    return { dates: uniqueDates };
};

export const getAdminSlotsForDate = async (date: string, gender?: Gender): Promise<AppointmentSlot[]> => {
    let query = supabase
        .from('appointment_slots')
        .select('*, levels(name)')
        .eq('date', date);

    if (gender) {
        query = query.eq('gender', gender);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching admin slots for date:', error);
        return [];
    }
    return data.map(slotFromSupabase);
};

export const bulkDeleteStudents = async (studentIds: string[]): Promise<void> => {
    const response = await fetch(`${window.location.origin}/api/manage/bulk-delete-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete student records');
    }
};

export const checkInStudent = async (studentId: string): Promise<Student> => {
    const { data, error } = await supabase.rpc('check_in_student_rpc', {
        target_student_id: studentId
    });

    if (error) {
        console.error("Check-in error:", error);
        throw new Error(error.message || "Failed to check in student.");
    }
    
    return studentFromSupabase(data);
};


// --- Schedule Management ---
export const getSchedules = async (page: number, pageSize: number, gender?: Gender): Promise<{ slots: AppointmentSlot[], count: number }> => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('appointment_slots')
        .select('*, levels(id, name)', { count: 'exact' });

    if (gender) {
        query = query.eq('gender', gender);
    }

    const { data, error, count } = await query
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .range(from, to);

    if (error) throw error;
    
    return { slots: data.map(slotFromSupabase), count: count ?? 0 };
};


export const getScheduleById = async (slotId: string): Promise<AppointmentSlot | null> => {
    const { data, error } = await supabase
        .from('appointment_slots')
        .select('*, levels(id, name)')
        .eq('id', slotId)
        .single();

    if (error) {
        console.error("Error fetching schedule by ID:", error);
        return null;
    }
    
    return data ? slotFromSupabase(data) : null;
};

export const createSchedule = async(slot: Omit<AppointmentSlot, 'id' | 'booked' | 'level'>): Promise<AppointmentSlot> => {
    const { startTime, endTime, levelId, gender, ...rest } = slot;
    const { data, error } = await supabase.from('appointment_slots').insert({ ...rest, start_time: startTime, end_time: endTime, level_id: levelId, gender }).select('*, levels(id, name)').single();
    if (error) throw error;
    return slotFromSupabase(data);
};

export const createSchedulesBulk = async(slots: Omit<AppointmentSlot, 'id' | 'booked' | 'level'>[]): Promise<void> => {
    const dataToInsert = slots.map(slot => {
        const { startTime, endTime, levelId, gender, ...rest } = slot;
        return {
            ...rest,
            start_time: startTime,
            end_time: endTime,
            level_id: levelId,
            gender
        };
    });
    
    const { error } = await supabase.from('appointment_slots').insert(dataToInsert);
    if (error) throw error;
};

export const updateSchedule = async(slot: Omit<AppointmentSlot, 'level'>): Promise<AppointmentSlot> => {
    const { startTime, endTime, levelId, gender, ...rest } = slot;
    const { data, error } = await supabase.from('appointment_slots').update({ ...rest, start_time: startTime, end_time: endTime, level_id: levelId, gender }).eq('id', slot.id).select('*, levels(id, name)').single();
    if (error) throw error;
    return slotFromSupabase(data);
};

export const deleteSchedule = async(slotId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('appointment_slots').delete().eq('id', slotId);
    if (error) throw error;
    return { success: true };
};

export const bulkDeleteSchedules = async(slotIds: string[]): Promise<void> => {
    const response = await fetch(`${window.location.origin}/api/manage/bulk-delete-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIds }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete schedule slots');
    }
};


// --- Level Management ---
export const testConnection = async () => {
  try {
    // Simple query with no complex abort logic to ensure compatibility
    const { data, error } = await supabase
      .from('app_settings')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error("Supabase connection test failed:", err);
    return { success: false, error: err };
  }
};

export const getLevels = async(includeInactive = false): Promise<Level[]> => {
    try {
        let query = supabase.from('levels').select('*');
        if (!includeInactive) {
            query = query.eq('is_active', true);
        }
        const { data, error } = await query.order('sort_order', { ascending: true });
        if (error) throw error;
        return data.map(l => ({...l, isActive: l.is_active, sortOrder: l.sort_order}));
    } catch (err) {
        console.error("Failed to fetch levels:", err);
        return [];
    }
};

export const createLevel = async(level: Omit<Level, 'id'>): Promise<Level> => {
    const { isActive, sortOrder, ...rest } = level;
    const { data, error } = await supabase.from('levels').insert({ ...rest, is_active: isActive, sort_order: sortOrder }).select().single();
    if (error) throw error;
    return {...data, isActive: data.is_active, sortOrder: data.sort_order};
};

export const updateLevel = async(level: Level): Promise<Level> => {
    const { isActive, sortOrder, ...rest } = level;
    const { data, error } = await supabase.from('levels').update({ ...rest, is_active: isActive, sort_order: sortOrder }).eq('id', level.id).select().single();
    if (error) throw error;
    return {...data, isActive: data.is_active, sortOrder: data.sort_order};
};

export const deleteLevel = async(levelId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('levels').delete().eq('id', levelId);
    if (error) throw error;
    return { success: true };
};


// --- Site Content Management ---
export const getSiteContent = async (): Promise<SiteContent> => {
    try {
        const { data, error } = await supabase
            .from('asset_settings')
            .select('key, value');
        
        const defaultContent: SiteContent = {
            logoUrl: 'https://res.cloudinary.com/di7okmjsx/image/upload/v1771428370/alibaanahlogo1_iprhyj.png',
            officialSiteUrl: 'https://ibaanah.com/',
            heroVideoUrl: {},
            faqItems: {},
            benefitItems: {},
            campusAddress: '',
            campusHours: ''
        };

        if (error) {
            console.error("Error fetching site content, returning default.", error);
            return defaultContent;
        }

        if (!data) {
            return defaultContent;
        }
        
        const fetchedContent = data.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
        }, {} as Record<string, unknown>);

        return { ...defaultContent, ...fetchedContent };
    } catch (err) {
        console.error("Critical error fetching site content:", err);
        return {
            logoUrl: 'https://res.cloudinary.com/di7okmjsx/image/upload/v1771428370/alibaanahlogo1_iprhyj.png',
            officialSiteUrl: 'https://ibaanah.com/',
            heroVideoUrl: {},
            faqItems: {},
            benefitItems: {},
            campusAddress: '',
            campusHours: ''
        };
    }
};

export const updateSiteContent = async (key: keyof SiteContent, value: unknown): Promise<void> => {
    const { error } = await supabase
        .from('asset_settings')
        .update({ value: value })
        .eq('key', key);

    if (error) throw error;
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
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single();
        
        if (error) throw error;
        return { 
            isRegistrationOpen: data.registration_open, 
            isMaleRegistrationOpen: data.male_registration_open,
            isFemaleRegistrationOpen: data.female_registration_open,
            maxDailyCapacity: data.max_daily_capacity,
            closedReasons: data.closed_reasons || {},
            bookingStartTime: data.booking_start_time,
            bookingEndTime: data.booking_end_time
        };
    } catch (err) {
        console.error("Failed to fetch app settings, using defaults.", err);
        return { 
            isRegistrationOpen: false, 
            isMaleRegistrationOpen: false,
            isFemaleRegistrationOpen: false,
            maxDailyCapacity: 50,
            closedReasons: {},
            bookingStartTime: undefined,
            bookingEndTime: undefined
        };
    }
};

export const updateAppSettings = async(settings: AppSettings): Promise<AppSettings> => {
    const { isRegistrationOpen, isMaleRegistrationOpen, isFemaleRegistrationOpen, maxDailyCapacity, closedReasons, bookingStartTime, bookingEndTime } = settings;
    const { data, error } = await supabase.from('app_settings').update({ 
        registration_open: isRegistrationOpen, 
        male_registration_open: isMaleRegistrationOpen,
        female_registration_open: isFemaleRegistrationOpen,
        max_daily_capacity: maxDailyCapacity,
        closed_reasons: closedReasons,
        booking_start_time: bookingStartTime,
        booking_end_time: bookingEndTime
    }).eq('id', 1).select().single();
    if (error) throw error;
    return { 
        isRegistrationOpen: data.registration_open, 
        isMaleRegistrationOpen: data.male_registration_open,
        isFemaleRegistrationOpen: data.female_registration_open,
        maxDailyCapacity: data.max_daily_capacity,
        closedReasons: data.closed_reasons || {},
        bookingStartTime: data.booking_start_time,
        bookingEndTime: data.booking_end_time
    };
};

export const updateAppSetting = async (key: keyof AppSettings, value: unknown): Promise<AppSettings> => {
    const dbKeyMap: Record<string, string> = {
        isRegistrationOpen: 'registration_open',
        isMaleRegistrationOpen: 'male_registration_open',
        isFemaleRegistrationOpen: 'female_registration_open',
        maxDailyCapacity: 'max_daily_capacity',
        closedReasons: 'closed_reasons',
        bookingStartTime: 'booking_start_time',
        bookingEndTime: 'booking_end_time'
    };

    const updates = {
        [dbKeyMap[key as string]]: value
    };
    const { data, error } = await supabase.from('app_settings').update(updates).eq('id', 1).select().single();
    if (error) throw error;
    return { 
        isRegistrationOpen: data.registration_open, 
        isMaleRegistrationOpen: data.male_registration_open,
        isFemaleRegistrationOpen: data.female_registration_open,
        maxDailyCapacity: data.max_daily_capacity,
        closedReasons: data.closed_reasons || {},
        bookingStartTime: data.booking_start_time,
        bookingEndTime: data.booking_end_time
    };
};

export const sendTestEmail = async (to: string, subject: string, html: string): Promise<void> => {
    const response = await fetchWithTimeout(`${window.location.origin}/api/send-email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to, subject, html })
    });
    
    if (!response.ok) {
        let errorMessage = 'Failed to send test email';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
    }
};

export const triggerReminders = async (secret: string): Promise<unknown> => {
    const response = await fetchWithTimeout('/api/cron/reminders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`
        }
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger reminders');
    }
    return response.json();
};