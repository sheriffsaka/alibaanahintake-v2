
import { supabase, safeRefreshSession, supabaseUrl, supabaseAnonKey } from './supabaseClient';
import { Student, AppointmentSlot, Level, AdminUser, NotificationSettings, AppSettings, SiteContent, Gender, Role, isGenderRegistrationOpen } from '../types';

const getSessionStorageItem = <T>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const item = window.sessionStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

const setSessionStorageItem = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or disabled errors
  }
};

/**
 * Automatically catches expired JWT / 401 errors and transient wake-up network errors from PostgREST/Supabase queries,
 * safely refreshes the authentication session, and re-attempts the operation once.
 */
export const withAutoReauth = async <T>(queryFn: () => Promise<T>): Promise<T> => {
  try {
    return await queryFn();
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string; status?: number; name?: string };
    const isAuthExpired = 
      error?.code === 'PGRST301' || 
      error?.status === 401 ||
      (typeof error?.message === 'string' && (
        error.message.includes('JWT expired') || 
        error.message.includes('token is expired') ||
        error.message.includes('invalid claim') ||
        error.message.includes('sub claim and user id do not match')
      ));

    const isTransientNetworkError =
      error?.name === 'AbortError' ||
      (typeof error?.message === 'string' && (
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('network error') ||
        error.message.includes('signal is aborted') ||
        error.message.includes('Network request failed')
      ));

    if (isAuthExpired || isTransientNetworkError) {
      console.log('[ApiService] Encountered auth expiration or transient connection error. Refreshing session and retrying...', error?.message || error?.code);
      // Brief pause to allow socket and auth state to settle on tab wake-up
      await new Promise((resolve) => setTimeout(resolve, 150));
      const session = await safeRefreshSession(isAuthExpired);
      if (session || isTransientNetworkError) {
        return await queryFn();
      }
    }
    throw err;
  }
};

const fetchWithTimeout = async (resource: string, options: RequestInit & { timeout?: number } = {}) => {
    const { timeout = 20000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(resource, {
          ...options,
          signal: options.signal || controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
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
// export const login is defined below after getAdminUserProfile
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
    return withAutoReauth(async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) {
                if (error.code === 'PGRST301' || error.message?.includes('JWT expired')) {
                    throw error;
                }
                console.error("Error fetching profile:", error);
                return null;
            }
            
            const user = { ...data, isActive: data.is_active };
            if (user.name && typeof user.name === 'string' && user.name.endsWith(' [co_Admin]')) {
                user.name = user.name.replace(' [co_Admin]', '');
                user.role = Role.CoAdmin;
            }
            return user;
        } catch (err) {
            const error = err as { code?: string; message?: string };
            if (error?.code === 'PGRST301' || error?.message?.includes('JWT expired')) {
                throw err;
            }
            console.error("Critical error fetching profile:", err);
            return null;
        }
    });
};

export const login = async (email: string, password: string): Promise<AdminUser> => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) throw error;
    if (!data?.user) throw new Error("No user returned from login.");

    let profile = await getAdminUserProfile(data.user.id);
    if (!profile) {
        // Fallback: brief delay and retry in case auth session is still propagating
        await new Promise(res => setTimeout(res, 350));
        profile = await getAdminUserProfile(data.user.id);
    }
    if (!profile) {
        throw new Error("Admin profile not found. Please contact the system administrator.");
    }
    if (!profile.isActive) {
        await supabase.auth.signOut();
        throw new Error("Your account has been deactivated. Please contact the administrator.");
    }
    return profile;
};


export const requestAdminPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch(`${window.location.origin}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Failed to request password reset.');
    }
    return data;
};

export const confirmAdminPasswordReset = async (email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const res = await fetch(`${window.location.origin}/api/auth/confirm-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: code.trim(), newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
    }
    return data;
};

export const getAvailableDatesForLevel = async(levelId: string, gender: Gender): Promise<string[]> => {
    console.log('>>> Fetching dates for level:', levelId, 'gender:', gender);
    const settings = await getAppSettings();
    console.log('>>> App settings:', settings);
    
    const regStatus = isGenderRegistrationOpen(settings, gender);
    if (!regStatus.open) {
        console.warn('>>> Registration is CLOSED for gender:', gender, 'Reason:', regStatus.reason);
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
    const settings = await getAppSettings();
    const regStatus = isGenderRegistrationOpen(settings, gender);
    if (!regStatus.open) {
        console.warn('>>> Registration is CLOSED for gender:', gender, 'Reason:', regStatus.reason);
        return [];
    }

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
const fetchStudentsFromApi = async (
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
): Promise<{ students: Student[]; count: number } | null> => {
    try {
        let session = (await supabase.auth.getSession()).data?.session;
        let token = session?.access_token;
        if (!token) {
            session = await safeRefreshSession(true);
            token = session?.access_token;
        }
        if (!token) return null;

        const params = new URLSearchParams({
            page: page.toString(),
            pageSize: pageSize.toString(),
            sortKey: sortKey || 'created_at',
            sortDirection: sortDirection || 'desc',
        });
        if (searchTerm) params.set('searchTerm', searchTerm);
        if (filters?.intakeDate) params.set('intakeDate', filters.intakeDate);
        if (filters?.appointmentSlotId) {
            const slotIdStr = Array.isArray(filters.appointmentSlotId)
                ? filters.appointmentSlotId.join(',')
                : filters.appointmentSlotId;
            params.set('appointmentSlotId', slotIdStr);
        }
        if (filters?.gender) params.set('gender', filters.gender);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        let response = await fetch(`${window.location.origin}/api/admin/students?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        // Auto-refresh token if 401
        if (response.status === 401) {
            const freshSession = await safeRefreshSession(true);
            if (freshSession?.access_token) {
                const retryController = new AbortController();
                const retryTimeoutId = setTimeout(() => retryController.abort(), 6000);
                response = await fetch(`${window.location.origin}/api/admin/students?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${freshSession.access_token}`
                    },
                    signal: retryController.signal
                });
                clearTimeout(retryTimeoutId);
            }
        }

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${response.status}: Failed to fetch student records`);
        }

        const data = await response.json();
        return {
            students: (data.students || []).map(studentFromSupabase),
            count: data.count ?? 0
        };
    } catch (apiErr) {
        console.warn('API /api/admin/students failed or unavailable, falling back to direct query:', apiErr);
        return null;
    }
};

const fetchStudentsExportFromApi = async (
    searchTerm: string,
    sortKey: string,
    sortDirection: string,
    filters?: {
        intakeDate?: string;
        appointmentSlotId?: string | string[];
        gender?: Gender;
    }
): Promise<Student[] | null> => {
    try {
        let session = (await supabase.auth.getSession()).data?.session;
        let token = session?.access_token;
        if (!token) {
            session = await safeRefreshSession(true);
            token = session?.access_token;
        }
        if (!token) return null;

        const params = new URLSearchParams({
            sortKey: sortKey || 'created_at',
            sortDirection: sortDirection || 'desc',
        });
        if (searchTerm) params.set('searchTerm', searchTerm);
        if (filters?.intakeDate) params.set('intakeDate', filters.intakeDate);
        if (filters?.appointmentSlotId) {
            const slotIdStr = Array.isArray(filters.appointmentSlotId)
                ? filters.appointmentSlotId.join(',')
                : filters.appointmentSlotId;
            params.set('appointmentSlotId', slotIdStr);
        }
        if (filters?.gender) params.set('gender', filters.gender);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        let response = await fetch(`${window.location.origin}/api/admin/students/export?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.status === 401) {
            const freshSession = await safeRefreshSession(true);
            if (freshSession?.access_token) {
                const retryController = new AbortController();
                const retryTimeoutId = setTimeout(() => retryController.abort(), 6000);
                response = await fetch(`${window.location.origin}/api/admin/students/export?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${freshSession.access_token}`
                    },
                    signal: retryController.signal
                });
                clearTimeout(retryTimeoutId);
            }
        }

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${response.status}: Failed to export student records`);
        }

        const data = await response.json();
        return (data.students || []).map(studentFromSupabase);
    } catch (apiErr) {
        console.warn('API /api/admin/students/export failed, falling back to direct query:', apiErr);
        return null;
    }
};

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
    // 1. High performance server-side route (immune to iframe latency, CORS and lock deadlocks)
    const apiResult = await fetchStudentsFromApi(page, pageSize, searchTerm, sortKey, sortDirection, filters);
    if (apiResult) {
        return apiResult;
    }

    // 2. Resilient fallback to direct Supabase PostgREST
    return withAutoReauth(async () => {
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

        if (sortKey === 'level' || sortKey === 'levels(name)') {
            query = query.order('name', { foreignTable: 'levels', ascending: sortDirection === 'asc' });
        } else if (sortKey) {
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
        return { students: (data || []).map(studentFromSupabase), count: count ?? 0 };
    });
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
    // 1. High performance server-side route
    const apiResult = await fetchStudentsExportFromApi(searchTerm, sortKey, sortDirection, filters);
    if (apiResult) {
        return apiResult;
    }

    // 2. Fallback to direct client-side query
    return withAutoReauth(async () => {
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

        if (sortKey === 'level' || sortKey === 'levels(name)') {
            query = query.order('name', { foreignTable: 'levels', ascending: sortDirection === 'asc' });
        } else if (sortKey) {
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
        return (data || []).map(studentFromSupabase);
    });
};

export const getDashboardData = async (genderFilter?: Gender) => {
    return withAutoReauth(async () => {
        if (genderFilter) {
            const todayStr = new Date().toISOString().split('T')[0];
            const [totalRes, todayRes, levelsRes, slotsRes] = await Promise.all([
                supabase.from('students').select('id', { count: 'exact', head: true }).eq('gender', genderFilter),
                supabase.from('students').select('id, status', { count: 'exact' }).eq('intake_date', todayStr).eq('gender', genderFilter),
                supabase.from('levels').select('id, name, sort_order').eq('is_active', true).order('sort_order'),
                supabase.from('appointment_slots').select('date, start_time, booked, capacity').gte('date', todayStr).eq('gender', genderFilter).order('date').order('start_time').limit(10)
            ]);

            const studentsByLevelRes = await supabase.from('students').select('level_id').eq('gender', genderFilter);

            const subqueryError = totalRes.error || todayRes.error || levelsRes.error || slotsRes.error || studentsByLevelRes.error;
            if (subqueryError) {
                console.error("Dashboard subquery error encountered:", subqueryError);
                throw subqueryError;
            }

            const levelCounts: Record<string, number> = {};
            (studentsByLevelRes.data || []).forEach(s => {
                if (s.level_id) levelCounts[s.level_id] = (levelCounts[s.level_id] || 0) + 1;
            });

            const breakdownByLevel = (levelsRes.data || []).map(l => ({
                name: l.name,
                value: levelCounts[l.id] || 0
            }));

            const slotUtilization = (slotsRes.data || []).map(s => ({
                name: `${s.date || ''} ${s.start_time || ''}`.trim() || 'Unknown Slot',
                booked: Number(s.booked) || 0,
                capacity: Number(s.capacity) || 0
            }));

            const todayExpected = todayRes.count || 0;
            const checkedIn = (todayRes.data || []).filter(s => {
                const status = (s as { status?: string }).status;
                return status === 'Checked-in' || status === 'Completed';
            }).length;

            return {
                totalRegistered: totalRes.count || 0,
                todayExpected,
                checkedIn,
                breakdownByLevel,
                slotUtilization
            };
        }

        const { data, error } = await supabase.rpc('get_dashboard_statistics');

        if (error || !data) {
            console.error("Dashboard data fetch error:", error);
            throw error || new Error('Failed to fetch dashboard data.');
        }

        return {
            ...data,
            slotUtilization: Array.isArray(data.slotUtilization) 
                ? data.slotUtilization.map((s: Record<string, unknown>) => ({
                    name: `${s.date || ''} ${s.start_time || ''}`.trim() || 'Unknown Slot',
                    booked: Number(s.booked) || 0,
                    capacity: Number(s.capacity) || 0,
                  }))
                : [],
        };
    });
};

export const findStudent = async (query: string): Promise<Student | null> => {
    if (!query) return null;

    return withAutoReauth(async () => {
        const { data, error } = await supabase
          .rpc('search_students', { search_term: query })
          .select('*, levels(name)')
          .limit(1)
          .maybeSingle();

        if (error) {
            if (error.code === 'PGRST301' || error.message?.includes('JWT expired')) {
                throw error;
            }
            console.error("Error finding student via RPC:", error);
            return null;
        }

        return data ? studentFromSupabase(data) : null;
    });
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
    return withAutoReauth(async () => {
        const { data, error } = await supabase
            .from('appointment_slots')
            .select('date');
        
        if (error) {
            console.error('Error fetching filter dates:', error);
            return { dates: [] };
        }
        
        const uniqueDates = [...new Set(data.map(d => d.date))].sort();
        return { dates: uniqueDates };
    });
};

export const getAdminSlotsForDate = async (date: string, gender?: Gender): Promise<AppointmentSlot[]> => {
    return withAutoReauth(async () => {
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
    });
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
    return withAutoReauth(async () => {
        const { data, error } = await supabase.rpc('check_in_student_rpc', {
            target_student_id: studentId
        });

        if (error) {
            console.error("Check-in error:", error);
            throw new Error(error.message || "Failed to check in student.");
        }
        
        return studentFromSupabase(data);
    });
};


// --- Schedule Management ---
export const getSchedules = async (page: number, pageSize: number, gender?: Gender): Promise<{ slots: AppointmentSlot[], count: number }> => {
    return withAutoReauth(async () => {
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
        
        return { slots: (data || []).map(slotFromSupabase), count: count ?? 0 };
    });
};


export const getScheduleById = async (slotId: string): Promise<AppointmentSlot | null> => {
    return withAutoReauth(async () => {
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
    });
};

export const createSchedule = async(slot: Omit<AppointmentSlot, 'id' | 'booked' | 'level'>): Promise<AppointmentSlot> => {
    return withAutoReauth(async () => {
        const { startTime, endTime, levelId, gender, date, capacity } = slot;
        const { data, error } = await supabase
            .from('appointment_slots')
            .insert({
                start_time: startTime,
                end_time: endTime,
                level_id: levelId,
                gender,
                date,
                capacity
            })
            .select('*, levels(id, name)')
            .single();
        if (error) throw error;
        return slotFromSupabase(data);
    });
};

export const createSchedulesBulk = async(slots: Omit<AppointmentSlot, 'id' | 'booked' | 'level'>[]): Promise<void> => {
    return withAutoReauth(async () => {
        const dataToInsert = slots.map(slot => {
            const { startTime, endTime, levelId, gender, date, capacity } = slot;
            return {
                start_time: startTime,
                end_time: endTime,
                level_id: levelId,
                gender,
                date,
                capacity
            };
        });
        
        const { error } = await supabase.from('appointment_slots').insert(dataToInsert);
        if (error) throw error;
    });
};

export const updateSchedule = async(slot: Omit<AppointmentSlot, 'level'>): Promise<AppointmentSlot> => {
    return withAutoReauth(async () => {
        const { id, startTime, endTime, levelId, gender, date, capacity } = slot;
        const { data, error } = await supabase
            .from('appointment_slots')
            .update({
                start_time: startTime,
                end_time: endTime,
                level_id: levelId,
                gender,
                date,
                capacity
            })
            .eq('id', id)
            .select('*, levels(id, name)')
            .single();
        if (error) throw error;
        return slotFromSupabase(data);
    });
};

export const deleteSchedule = async(slotId: string): Promise<{ success: boolean }> => {
    return withAutoReauth(async () => {
        const { error } = await supabase.from('appointment_slots').delete().eq('id', slotId);
        if (error) throw error;
        return { success: true };
    });
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
    return withAutoReauth(async () => {
        try {
            let query = supabase.from('levels').select('*');
            if (!includeInactive) {
                query = query.eq('is_active', true);
            }
            const { data, error } = await query.order('sort_order', { ascending: true });
            if (error) throw error;
            return data.map(l => ({...l, isActive: l.is_active, sortOrder: l.sort_order}));
        } catch (err) {
            const error = err as { code?: string; message?: string };
            if (error?.code === 'PGRST301' || error?.message?.includes('JWT expired')) {
                throw err;
            }
            console.error("Failed to fetch levels:", err);
            return [];
        }
    });
};

export const createLevel = async(level: Omit<Level, 'id'>): Promise<Level> => {
    return withAutoReauth(async () => {
        const { isActive, sortOrder, ...rest } = level;
        const { data, error } = await supabase.from('levels').insert({ ...rest, is_active: isActive, sort_order: sortOrder }).select().single();
        if (error) throw error;
        return {...data, isActive: data.is_active, sortOrder: data.sort_order};
    });
};

export const updateLevel = async(level: Level): Promise<Level> => {
    return withAutoReauth(async () => {
        const { isActive, sortOrder, ...rest } = level;
        const { data, error } = await supabase.from('levels').update({ ...rest, is_active: isActive, sort_order: sortOrder }).eq('id', level.id).select().single();
        if (error) throw error;
        return {...data, isActive: data.is_active, sortOrder: data.sort_order};
    });
};

export const deleteLevel = async(levelId: string): Promise<{ success: boolean }> => {
    return withAutoReauth(async () => {
        const { error } = await supabase.from('levels').delete().eq('id', levelId);
        if (error) throw error;
        return { success: true };
    });
};


let cachedSiteContent: SiteContent | null = getSessionStorageItem<SiteContent>('ib_cached_site_content');

// --- Site Content Management ---
export const getSiteContent = async (): Promise<SiteContent> => {
    return withAutoReauth(async () => {
        const defaultContent: SiteContent = {
            logoUrl: 'https://res.cloudinary.com/di7okmjsx/image/upload/v1771428370/alibaanahlogo1_iprhyj.png',
            officialSiteUrl: 'https://ibaanah.com/',
            heroVideoUrl: {},
            faqItems: {},
            benefitItems: {},
            campusAddress: '',
            campusHours: ''
        };

        const fallbackDirectFetch = async (): Promise<SiteContent | null> => {
            try {
                const res = await fetchWithTimeout(`${supabaseUrl}/rest/v1/asset_settings?select=key,value`, {
                    headers: {
                        apikey: supabaseAnonKey,
                        Authorization: `Bearer ${supabaseAnonKey}`,
                        Accept: 'application/json'
                    },
                    timeout: 4000
                });
                if (res.ok) {
                    const rows = await res.json();
                    if (Array.isArray(rows) && rows.length > 0) {
                        const fetchedContent = rows.reduce((acc: Record<string, unknown>, { key, value }: { key: string; value: unknown }) => {
                            acc[key] = value;
                            return acc;
                        }, {});
                        const resolved = { ...defaultContent, ...fetchedContent };
                        cachedSiteContent = resolved;
                        setSessionStorageItem('ib_cached_site_content', resolved);
                        return resolved;
                    }
                }
            } catch (fallbackErr) {
                console.warn("[ApiService] Direct fallback fetch for asset_settings failed:", fallbackErr);
            }
            return null;
        };

        try {
            const { data, error } = await supabase
                .from('asset_settings')
                .select('key, value');
            
            if (error) {
                const err = error as { code?: string; message?: string };
                if (err?.code === 'PGRST301' || err?.message?.includes('JWT expired')) {
                    throw error;
                }
                console.error("Error fetching site content, trying direct fallback:", error);
                const directFallback = await fallbackDirectFetch();
                if (directFallback) return directFallback;
                return cachedSiteContent || defaultContent;
            }

            if (!data || data.length === 0) {
                const directFallback = await fallbackDirectFetch();
                if (directFallback) return directFallback;
                return cachedSiteContent || defaultContent;
            }
            
            const fetchedContent = data.reduce((acc, { key, value }) => {
                acc[key] = value;
                return acc;
            }, {} as Record<string, unknown>);

            const resolvedContent = { ...defaultContent, ...fetchedContent };
            cachedSiteContent = resolvedContent;
            setSessionStorageItem('ib_cached_site_content', resolvedContent);
            return resolvedContent;
        } catch (err) {
            const error = err as { code?: string; message?: string };
            if (error?.code === 'PGRST301' || error?.message?.includes('JWT expired')) {
                throw err;
            }
            console.error("Exception fetching site content, trying direct fallback:", err);
            const directFallback = await fallbackDirectFetch();
            if (directFallback) return directFallback;
            return cachedSiteContent || defaultContent;
        }
    });
};

export const updateSiteContent = async (key: keyof SiteContent, value: unknown): Promise<void> => {
    return withAutoReauth(async () => {
        const { error } = await supabase
            .from('asset_settings')
            .update({ value: value })
            .eq('key', key);

        if (error) throw error;
    });
};


// --- User Management ---
export const getAdminUsers = async (): Promise<AdminUser[]> => {
    return withAutoReauth(async () => {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        return data.map(u => {
            const user = { ...u, isActive: u.is_active };
            if (user.name && typeof user.name === 'string' && user.name.endsWith(' [co_Admin]')) {
                user.name = user.name.replace(' [co_Admin]', '');
                user.role = Role.CoAdmin;
            }
            return user;
        });
    });
};

export const createAdminUser = async(user: Omit<AdminUser, 'id'>, password: string): Promise<AdminUser> => {
    let session = (await supabase.auth.getSession()).data?.session;
    let token = session?.access_token;

    if (!token) {
        session = await safeRefreshSession(true);
        token = session?.access_token;
    }

    if (!token) {
        throw new Error("You must be logged in to create admin users.");
    }

    const response = await fetch(`${window.location.origin}/api/admin/create-user`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            password
        }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Failed to create admin user');
    }

    return data.user;
};

export const updateAdminUser = async(user: AdminUser, password?: string): Promise<AdminUser> => {
    let session = (await supabase.auth.getSession()).data?.session;
    let token = session?.access_token;

    if (!token) {
        session = await safeRefreshSession(true);
        token = session?.access_token;
    }

    if (!token) {
        throw new Error("You must be logged in to update admin users.");
    }

    const response = await fetch(`${window.location.origin}/api/admin/update-user`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            password: password ? password : undefined
        }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Failed to update admin user');
    }

    return data.user;
};

export const deleteAdminUser = async(userId: string): Promise<{ success: boolean }> => {
    return withAutoReauth(async () => {
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        if (error) throw error;
        return { success: true };
    });
};


// --- Notification Settings ---
export const getNotificationSettings = async(): Promise<NotificationSettings> => {
    return withAutoReauth(async () => {
        const { data, error } = await supabase.from('notification_settings').select('settings').eq('id', 1).single();
        if (error) throw error;
        return data.settings;
    });
};
export const updateNotificationSettings = async(settings: NotificationSettings): Promise<NotificationSettings> => {
    return withAutoReauth(async () => {
        const { data, error } = await supabase.from('notification_settings').update({ settings }).eq('id', 1).select('settings').single();
        if (error) throw error;
        return data.settings;
    });
};


let cachedAppSettings: AppSettings | null = getSessionStorageItem<AppSettings>('ib_cached_app_settings');

// --- App Settings ---
export const getAppSettings = async(): Promise<AppSettings> => {
    return withAutoReauth(async () => {
        const fallbackDefaults: AppSettings = {
            isRegistrationOpen: false, 
            isMaleRegistrationOpen: false,
            isFemaleRegistrationOpen: false,
            maxDailyCapacity: 50,
            closedReasons: {},
            bookingStartTime: undefined,
            bookingEndTime: undefined,
            femaleBookingStartTime: undefined,
            femaleBookingEndTime: undefined
        };

        const fallbackDirectFetch = async (): Promise<AppSettings | null> => {
            try {
                const res = await fetchWithTimeout(`${supabaseUrl}/rest/v1/app_settings?id=eq.1&select=*`, {
                    headers: {
                        apikey: supabaseAnonKey,
                        Authorization: `Bearer ${supabaseAnonKey}`,
                        Accept: 'application/json'
                    },
                    timeout: 4000
                });
                if (res.ok) {
                    const rows = await res.json();
                    if (Array.isArray(rows) && rows.length > 0) {
                        const data = rows[0];
                        const settings: AppSettings = {
                            isRegistrationOpen: data.registration_open,
                            isMaleRegistrationOpen: data.male_registration_open,
                            isFemaleRegistrationOpen: data.female_registration_open,
                            maxDailyCapacity: data.max_daily_capacity,
                            closedReasons: data.closed_reasons || {},
                            bookingStartTime: data.booking_start_time,
                            bookingEndTime: data.booking_end_time,
                            femaleBookingStartTime: data.female_booking_start_time,
                            femaleBookingEndTime: data.female_booking_end_time
                        };
                        cachedAppSettings = settings;
                        setSessionStorageItem('ib_cached_app_settings', settings);
                        return settings;
                    }
                }
            } catch (fallbackErr) {
                console.warn("[ApiService] Direct fallback fetch for app_settings failed:", fallbackErr);
            }
            return null;
        };

        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .single();
            
            if (error) {
                const err = error as { code?: string; message?: string };
                if (err?.code === 'PGRST301' || err?.message?.includes('JWT expired')) {
                    throw error;
                }
                console.error("Failed to fetch app settings, trying direct fallback:", error);
                const directFallback = await fallbackDirectFetch();
                if (directFallback) return directFallback;
                return cachedAppSettings || fallbackDefaults;
            }
            const settings: AppSettings = { 
                isRegistrationOpen: data.registration_open, 
                isMaleRegistrationOpen: data.male_registration_open,
                isFemaleRegistrationOpen: data.female_registration_open,
                maxDailyCapacity: data.max_daily_capacity,
                closedReasons: data.closed_reasons || {},
                bookingStartTime: data.booking_start_time,
                bookingEndTime: data.booking_end_time,
                femaleBookingStartTime: data.female_booking_start_time,
                femaleBookingEndTime: data.female_booking_end_time
            };
            cachedAppSettings = settings;
            setSessionStorageItem('ib_cached_app_settings', settings);
            return settings;
        } catch (err) {
            const error = err as { code?: string; message?: string };
            if (error?.code === 'PGRST301' || error?.message?.includes('JWT expired')) {
                throw err;
            }
            console.error("Failed to fetch app settings, trying direct fallback:", err);
            const directFallback = await fallbackDirectFetch();
            if (directFallback) return directFallback;
            return cachedAppSettings || fallbackDefaults;
        }
    });
};

export const updateAppSettings = async(settings: AppSettings): Promise<AppSettings> => {
    return withAutoReauth(async () => {
        const { isRegistrationOpen, isMaleRegistrationOpen, isFemaleRegistrationOpen, maxDailyCapacity, closedReasons, bookingStartTime, bookingEndTime, femaleBookingStartTime, femaleBookingEndTime } = settings;
        const { data, error } = await supabase.from('app_settings').update({ 
            registration_open: isRegistrationOpen, 
            male_registration_open: isMaleRegistrationOpen,
            female_registration_open: isFemaleRegistrationOpen,
            max_daily_capacity: maxDailyCapacity,
            closed_reasons: closedReasons,
            booking_start_time: bookingStartTime || null,
            booking_end_time: bookingEndTime || null,
            female_booking_start_time: femaleBookingStartTime || null,
            female_booking_end_time: femaleBookingEndTime || null
        }).eq('id', 1).select().single();
        if (error) throw error;
        const updated: AppSettings = { 
            isRegistrationOpen: data.registration_open, 
            isMaleRegistrationOpen: data.male_registration_open,
            isFemaleRegistrationOpen: data.female_registration_open,
            maxDailyCapacity: data.max_daily_capacity,
            closedReasons: data.closed_reasons || {},
            bookingStartTime: data.booking_start_time,
            bookingEndTime: data.booking_end_time,
            femaleBookingStartTime: data.female_booking_start_time,
            femaleBookingEndTime: data.female_booking_end_time
        };
        cachedAppSettings = updated;
        return updated;
    });
};

export const updateAppSetting = async (key: keyof AppSettings, value: unknown): Promise<AppSettings> => {
    const dbKeyMap: Record<string, string> = {
        isRegistrationOpen: 'registration_open',
        isMaleRegistrationOpen: 'male_registration_open',
        isFemaleRegistrationOpen: 'female_registration_open',
        maxDailyCapacity: 'max_daily_capacity',
        closedReasons: 'closed_reasons',
        bookingStartTime: 'booking_start_time',
        bookingEndTime: 'booking_end_time',
        femaleBookingStartTime: 'female_booking_start_time',
        femaleBookingEndTime: 'female_booking_end_time'
    };

    const updates = {
        [dbKeyMap[key as string]]: value === "" ? null : value
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
        bookingEndTime: data.booking_end_time,
        femaleBookingStartTime: data.female_booking_start_time,
        femaleBookingEndTime: data.female_booking_end_time
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