
import { supabase } from './supabaseClient';
import { Student, AppointmentSlot, Level, AdminUser, NotificationSettings, AppSettings, Program, SiteContent, Gender, ProgramResource } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
    level: s.levels, // Supabase returns joined table as plural 'levels'
    levelId: s.level_id || '',
    intakeDate: s.intake_date,
    registrationCode: s.registration_code,
    appointmentSlotId: s.appointment_slot_id,
    status: s.status,
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
export const getAvailableDatesForLevel = async(levelId: string, gender: Gender): Promise<string[]> => {
    const settings = await getAppSettings();
    if (!settings.registrationOpen) return [];
    
    const { data, error } = await supabase
        .from('available_appointment_slots')
        .select('date')
        .eq('level_id', levelId)
        .eq('gender', gender);

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
export const getAllStudents = async (
    page: number,
    pageSize: number,
    searchTerm: string,
    sortKey: string,
    sortDirection: string
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
                name: `${s.date} ${s.start_time}`,
                booked: s.booked,
                capacity: s.capacity,
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

export const checkInStudent = async (studentId: string): Promise<Student> => {
    const { data, error } = await supabase
        .from('students')
        .update({ status: 'checked-in' })
        .eq('id', studentId)
        .select('*, levels(name)')
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
        .select('*, levels(id, name)', { count: 'exact' })
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


// --- Level Management ---
export const getLevels = async(includeInactive = false): Promise<Level[]> => {
    let query = supabase.from('levels').select('*');
    if (!includeInactive) {
        query = query.eq('is_active', true);
    }
    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) throw error;
    return data.map(l => ({...l, isActive: l.is_active, sortOrder: l.sort_order}));
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


// --- Program Management ---
const programFromSupabase = (p: Record<string, unknown>): Program => ({ // Using unknown is safer than any
    id: p.id,
    name: p.name,
    description: p.description,
    parentId: p.parent_id,
    isActive: p.is_active,
    isArchived: p.is_archived,
    sortOrder: p.sort_order
});

export const getPrograms = async(): Promise<Program[]> => {
    const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('*')
        .order('sort_order', { ascending: true });

    if (programError) throw programError;
    
    const programs = programData.map(programFromSupabase);
    const programMap: Map<string, Program> = new Map(programs.map(p => [p.id, { ...p, children: [], resources: [] }]));

    // Fetch all resources for the visible programs
    if (programs.length > 0) {
        const programIds = programs.map(p => p.id);
        const { data: resourceData, error: resourceError } = await supabase
            .from('program_resources')
            .select('*')
            .in('program_id', programIds)
            .order('sort_order', { ascending: true });

        if (resourceError) throw resourceError;
        
        // Attach resources to their programs
        if (resourceData) {
            for (const resource of resourceData) {
                if (programMap.has(resource.program_id)) {
                    programMap.get(resource.program_id)?.resources?.push(resource);
                }
            }
        }
    }

    // Nest programs
    const nestedPrograms: Program[] = [];
    for (const program of programMap.values()) {
        if (program.parentId && programMap.has(program.parentId)) {
            const parent = programMap.get(program.parentId);
            parent?.children?.push(program);
        } else {
            nestedPrograms.push(program);
        }
    }
    
    return nestedPrograms;
};

export const createProgram = async(program: Omit<Program, 'id' | 'children' | 'resources'>): Promise<Program> => {
    const { parentId, isActive, isArchived, sortOrder, ...rest } = program;
    const { data, error } = await supabase.from('programs').insert({ 
        ...rest, 
        parent_id: parentId, 
        is_active: isActive,
        is_archived: isArchived,
        sort_order: sortOrder 
    }).select().single();
    if (error) throw error;
    return programFromSupabase(data);
};

export const updateProgram = async(program: Omit<Program, 'children' | 'resources'>): Promise<Program> => {
    const { id, parentId, isActive, isArchived, sortOrder, ...rest } = program;
    const { data, error } = await supabase.from('programs').update({ 
        ...rest, 
        parent_id: parentId,
        is_active: isActive,
        is_archived: isArchived,
        sort_order: sortOrder
    }).eq('id', id).select().single();
    if (error) throw error;
    return programFromSupabase(data);
};

// --- Program Resource Management ---
const BUCKET_NAME = 'program_resources';

export const getProgramResources = async (programId: string): Promise<ProgramResource[]> => {
    const { data, error } = await supabase
        .from('program_resources')
        .select('*')
        .eq('program_id', programId)
        .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
};

const uploadResourceFile = async (programId: string, file: File): Promise<string> => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `${programId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file);

    if (uploadError) {
        console.error("File upload error:", uploadError);
        throw new Error("Failed to upload file to storage.");
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return data.publicUrl;
};

export const createProgramResource = async (resourceData: Omit<ProgramResource, 'id' | 'created_at'>, file?: File): Promise<ProgramResource> => {
    const resourceToCreate = { ...resourceData };

    if (file) {
        const fileUrl = await uploadResourceFile(resourceData.program_id, file);
        resourceToCreate.url = fileUrl;
    }

    const { data, error } = await supabase.from('program_resources').insert(resourceToCreate).select().single();
    if (error) throw error;
    return data;
};

export const updateProgramResource = async (resourceData: Omit<ProgramResource, 'created_at'>, file?: File): Promise<ProgramResource> => {
    const resourceToUpdate = { ...resourceData };
    
    if (file) {
        const fileUrl = await uploadResourceFile(resourceData.program_id, file);
        resourceToUpdate.url = fileUrl;
    }
    
    const { id, ...updateData } = resourceToUpdate;

    const { data, error } = await supabase.from('program_resources').update(updateData).eq('id', id).select().single();
    if (error) throw error;
    return data;
};

export const deleteProgramResource = async (resource: ProgramResource): Promise<void> => {
    // Delete from DB first
    const { error: dbError } = await supabase.from('program_resources').delete().eq('id', resource.id);
    if (dbError) throw dbError;

    // If it was a file upload (not an external URL), delete from storage
    const supabaseStorageUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl('').data.publicUrl;
    if (resource.url.startsWith(supabaseStorageUrl)) {
        const filePath = resource.url.substring(supabaseStorageUrl.length);
        const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        if (storageError) {
            console.error("Failed to delete from storage, but DB record was removed:", storageError);
        }
    }
};


// --- Site Content Management ---
export const getSiteContent = async (): Promise<SiteContent> => {
    const { data, error } = await supabase.from('asset_settings').select('key, value');
    
    const defaultContent: SiteContent = {
        logoUrl: '',
        officialSiteUrl: '#',
        heroVideoUrl: {},
        faqItems: {},
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
    }, {} as Record<string, unknown>); // Using unknown is safer than any

    return { ...defaultContent, ...fetchedContent };
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