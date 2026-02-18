-- 1. Create custom ENUM types for better data integrity.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'level_enum') THEN CREATE TYPE public.level_enum AS ENUM ('Beginner', 'Elementary', 'Intermediate', 'Advanced'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN CREATE TYPE public.gender_enum AS ENUM ('Male', 'Female'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN CREATE TYPE public.role_enum AS ENUM ('Super Admin', 'male_section_Admin', 'female_section_Admin', 'male_Front Desk', 'female_Front Desk'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status_enum') THEN CREATE TYPE public.student_status_enum AS ENUM ('booked', 'checked-in'); END IF; END $$;

-- 2. Create the appointment_slots table.
CREATE TABLE IF NOT EXISTS public.appointment_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INT NOT NULL CHECK (capacity >= 0),
    booked INT NOT NULL DEFAULT 0 CHECK (booked >= 0),
    level level_enum NOT NULL,
    date DATE NOT NULL
);
COMMENT ON TABLE public.appointment_slots IS 'Stores available time slots for student assessments.';

-- 3. Create the students table.
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surname TEXT NOT NULL,
    firstname TEXT NOT NULL,
    othername TEXT,
    whatsapp TEXT NOT NULL,
    email TEXT NOT NULL,
    gender gender_enum NOT NULL,
    address TEXT NOT NULL,
    level level_enum NOT NULL,
    intake_date DATE NOT NULL,
    registration_code TEXT NOT NULL UNIQUE,
    appointment_slot_id UUID NOT NULL,
    status student_status_enum NOT NULL DEFAULT 'booked',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.students IS 'Stores registered student information.';

-- Add foreign key constraint separately to avoid issues on re-runs
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_appointment_slot_id_fkey') THEN
      ALTER TABLE public.students ADD CONSTRAINT students_appointment_slot_id_fkey FOREIGN KEY (appointment_slot_id) REFERENCES public.appointment_slots(id);
   END IF;
END;
$$;


-- 4. Create the profiles table for admin users, linked to Supabase Auth.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role role_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);
COMMENT ON TABLE public.profiles IS 'Stores profile information for admin users.';

-- 5. Create singleton table for app_settings.
CREATE TABLE IF NOT EXISTS public.app_settings (
    id INT PRIMARY KEY DEFAULT 1,
    registration_open BOOLEAN NOT NULL DEFAULT true,
    max_daily_capacity INT NOT NULL DEFAULT 100,
    CONSTRAINT single_row CHECK (id = 1)
);
COMMENT ON TABLE public.app_settings IS 'Stores global application settings.';

-- Insert the single settings row.
INSERT INTO public.app_settings (id, registration_open, max_daily_capacity)
VALUES (1, true, 100)
ON CONFLICT (id) DO NOTHING;

-- 6. Create singleton table for notification_settings.
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id INT PRIMARY KEY DEFAULT 1,
    settings JSONB NOT NULL,
    CONSTRAINT single_row CHECK (id = 1)
);
COMMENT ON TABLE public.notification_settings IS 'Stores email notification templates.';

-- Insert the single notification settings row.
INSERT INTO public.notification_settings (id, settings)
VALUES (1, '{
    "confirmation": {
        "enabled": true,
        "subject": "Your Al-Ibaanah Assessment is Confirmed!",
        "body": "As-salamu ''alaykum {{studentName}},\\n\\nYour assessment for {{level}} has been successfully booked for {{appointmentDate}} at {{appointmentTime}}.\\nYour registration code is {{registrationCode}}.\\n\\nPlease find your admission slip attached."
    },
    "reminder24h": {
        "enabled": true,
        "subject": "Reminder: Your Al-Ibaanah Assessment is Tomorrow",
        "body": "As-salamu ''alaykum {{studentName}},\\n\\nThis is a reminder that your assessment for {{level}} is scheduled for tomorrow, {{appointmentDate}} at {{appointmentTime}}.\\n\\nWe look forward to seeing you."
    },
    "reminderDayOf": {
        "enabled": false,
        "subject": "Reminder: Your Al-Ibaanah Assessment is Today",
        "body": "As-salamu ''alaykum {{studentName}},\\n\\nYour assessment is today at {{appointmentTime}}. Please arrive on time with the required documents.\\n\\nAl-Ibaanah Administration"
    }
}')
ON CONFLICT (id) DO NOTHING;

-- 7. Create a view for available slots to simplify client-side queries.
CREATE OR REPLACE VIEW public.available_appointment_slots AS
  SELECT id, start_time, end_time, capacity, booked, level, date
  FROM public.appointment_slots
  WHERE date >= CURRENT_DATE AND booked < capacity;

COMMENT ON VIEW public.available_appointment_slots IS 'Filters appointment slots to only show those that are in the future and have capacity.';


-- 8. Set up Row Level Security (RLS).
-- Enable RLS for all tables.
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Create helper function to get user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS role_enum AS $$
DECLARE
    user_role role_enum;
BEGIN
    SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), NULL) INTO user_role;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Policies for appointment_slots
DROP POLICY IF EXISTS "Allow public read access to slots" ON public.appointment_slots;
CREATE POLICY "Allow public read access to slots" ON public.appointment_slots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin write access to slots" ON public.appointment_slots;
CREATE POLICY "Allow admin write access to slots" ON public.appointment_slots FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));

-- Grant access to the available slots view
GRANT SELECT ON public.available_appointment_slots TO anon;
GRANT SELECT ON public.available_appointment_slots TO authenticated;

-- Policies for students
DROP POLICY IF EXISTS "Allow admin read access to students" ON public.students;
CREATE POLICY "Allow admin read access to students" ON public.students FOR SELECT USING (get_my_role() IS NOT NULL);
DROP POLICY IF EXISTS "Allow front desk to update status" ON public.students;
CREATE POLICY "Allow front desk to update status" ON public.students FOR UPDATE USING (get_my_role() IN ('Super Admin', 'male_Front Desk', 'female_Front Desk')) WITH CHECK (get_my_role() IN ('Super Admin', 'male_Front Desk', 'female_Front Desk'));

-- Policies for profiles
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.profiles;
CREATE POLICY "Allow users to read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow admins to manage profiles" ON public.profiles;
CREATE POLICY "Allow admins to manage profiles" ON public.profiles FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));

-- Policies for settings tables
DROP POLICY IF EXISTS "Allow public read access to app settings" ON public.app_settings;
CREATE POLICY "Allow public read access to app settings" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin write access to app settings" ON public.app_settings;
CREATE POLICY "Allow admin write access to app settings" ON public.app_settings FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));
DROP POLICY IF EXISTS "Allow admin access to notification settings" ON public.notification_settings;
CREATE POLICY "Allow admin access to notification settings" ON public.notification_settings FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));


-- 9. Create database functions for application logic.

-- Transactional function for submitting registration.
CREATE OR REPLACE FUNCTION submit_student_registration(
    slot_id UUID,
    student_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
-- SECURITY DEFINER is important to bypass RLS for the transaction.
SECURITY DEFINER
AS $$
DECLARE
    selected_slot RECORD;
    new_student_record RECORD;
    registration_is_open BOOLEAN;
BEGIN
    -- Check if registrations are open
    SELECT registration_open INTO registration_is_open FROM public.app_settings WHERE id = 1;
    IF NOT registration_is_open THEN
        RAISE EXCEPTION 'Registrations are currently closed.';
    END IF;

    -- Lock the slot row to prevent race conditions
    SELECT * INTO selected_slot FROM public.appointment_slots WHERE id = slot_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment slot not found';
    END IF;

    IF selected_slot.booked >= selected_slot.capacity THEN
        RAISE EXCEPTION 'Appointment slot is full';
    END IF;

    -- Update the booked count
    UPDATE public.appointment_slots
    SET booked = selected_slot.booked + 1
    WHERE id = slot_id;

    -- Insert the new student and return the new record
    INSERT INTO public.students (surname, firstname, othername, whatsapp, email, gender, address, level, intake_date, appointment_slot_id, registration_code)
    VALUES (
        student_data->>'surname',
        student_data->>'firstname',
        student_data->>'othername',
        student_data->>'whatsapp',
        student_data->>'email',
        (student_data->>'gender')::gender_enum,
        student_data->>'address',
        (student_data->>'level')::level_enum,
        (student_data->>'intakeDate')::date,
        slot_id,
        'AI-' || upper(substr(md5(random()::text), 0, 9))
    ) RETURNING * INTO new_student_record;

    -- Return the full new student record as JSONB, matching frontend types
    RETURN jsonb_build_object(
        'id', new_student_record.id,
        'surname', new_student_record.surname,
        'firstname', new_student_record.firstname,
        'othername', new_student_record.othername,
        'whatsapp', new_student_record.whatsapp,
        'email', new_student_record.email,
        'gender', new_student_record.gender,
        'address', new_student_record.address,
        'level', new_student_record.level,
        'intakeDate', new_student_record.intake_date,
        'registrationCode', new_student_record.registration_code,
        'appointmentSlotId', new_student_record.appointment_slot_id,
        'status', new_student_record.status,
        'createdAt', new_student_record.created_at
    );
END;
$$;

-- Grant execute permission on the function to the anon and authenticated roles.
GRANT EXECUTE ON FUNCTION public.submit_student_registration(UUID, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_student_registration(UUID, JSONB) TO authenticated;


-- RPC function for fetching all dashboard data in a single, efficient query.
CREATE OR REPLACE FUNCTION get_dashboard_statistics()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    total_registered BIGINT;
    today_expected BIGINT;
    checked_in BIGINT;
    breakdown JSONB;
    utilization JSONB;
BEGIN
    -- Total registered students
    SELECT count(*) INTO total_registered FROM public.students;

    -- Today's bookings
    SELECT
        count(*),
        count(*) FILTER (WHERE status = 'checked-in')
    INTO today_expected, checked_in
    FROM public.students
    WHERE intake_date = CURRENT_DATE;

    -- Breakdown by level
    SELECT COALESCE(jsonb_agg(levels), '[]'::jsonb) INTO breakdown FROM (
        SELECT level AS name, count(*) AS value
        FROM public.students
        GROUP BY level
    ) AS levels;

    -- Slot utilization (upcoming 10 slots)
    SELECT COALESCE(jsonb_agg(slots), '[]'::jsonb) INTO utilization FROM (
        SELECT date, start_time, booked, capacity
        FROM public.appointment_slots
        WHERE date >= CURRENT_DATE
        ORDER BY date, start_time
        LIMIT 10
    ) AS slots;

    -- Combine and return as a single JSON object
    RETURN jsonb_build_object(
        'totalRegistered', total_registered,
        'todayExpected', today_expected,
        'checkedIn', checked_in,
        'breakdownByLevel', breakdown,
        'slotUtilization', utilization
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics TO authenticated;
