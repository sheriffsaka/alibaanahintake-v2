-- 1. DROP custom ENUM type for levels to be replaced by a table.
DROP TYPE IF EXISTS public.level_enum CASCADE;
-- Create other ENUM types.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN CREATE TYPE public.gender_enum AS ENUM ('Male', 'Female'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN CREATE TYPE public.role_enum AS ENUM ('Super Admin', 'male_section_Admin', 'female_section_Admin', 'male_Front Desk', 'female_Front Desk'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status_enum') THEN CREATE TYPE public.student_status_enum AS ENUM ('booked', 'checked-in'); END IF; END $$;

-- 2. Create the new `levels` table.
CREATE TABLE IF NOT EXISTS public.levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.levels IS 'Stores dynamic academic levels for student registration.';

-- Insert default levels
INSERT INTO public.levels (name, sort_order) VALUES
('Beginner', 1),
('Elementary', 2),
('Intermediate', 3),
('Advanced', 4)
ON CONFLICT (name) DO NOTHING;


-- 3. Create the appointment_slots table, making it safe for re-runs.
CREATE TABLE IF NOT EXISTS public.appointment_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INT NOT NULL CHECK (capacity >= 0),
    booked INT NOT NULL DEFAULT 0 CHECK (booked >= 0),
    date DATE NOT NULL
);
COMMENT ON TABLE public.appointment_slots IS 'Stores available time slots for student assessments.';

-- This block makes the schema migration idempotent. It adds the level_id column
-- and its foreign key if they're missing, which happens when re-running this script
-- on a DB created with an older schema.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.appointment_slots'::regclass AND attname = 'level_id') THEN
        ALTER TABLE public.appointment_slots ADD COLUMN level_id UUID;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = 'public.appointment_slots'::regclass AND conname = 'appointment_slots_level_id_fkey') THEN
        ALTER TABLE public.appointment_slots 
            ADD CONSTRAINT appointment_slots_level_id_fkey 
            FOREIGN KEY (level_id) REFERENCES public.levels(id) ON DELETE RESTRICT;
    END IF;
END;
$$;


-- 4. Create the students table, referencing `levels`.
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surname TEXT NOT NULL,
    firstname TEXT NOT NULL,
    othername TEXT,
    whatsapp TEXT NOT NULL,
    email TEXT NOT NULL,
    gender gender_enum NOT NULL,
    address TEXT NOT NULL,
    level_id UUID NOT NULL REFERENCES public.levels(id) ON DELETE RESTRICT,
    intake_date DATE NOT NULL,
    registration_code TEXT NOT NULL UNIQUE,
    appointment_slot_id UUID NOT NULL,
    status student_status_enum NOT NULL DEFAULT 'booked',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.students IS 'Stores registered student information.';

-- This block makes the schema migration idempotent for the students table.
-- It adds the level_id column and its foreign key if they're missing.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.students'::regclass AND attname = 'level_id') THEN
        ALTER TABLE public.students ADD COLUMN level_id UUID;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = 'public.students'::regclass AND conname = 'students_level_id_fkey') THEN
        ALTER TABLE public.students 
            ADD CONSTRAINT students_level_id_fkey 
            FOREIGN KEY (level_id) REFERENCES public.levels(id) ON DELETE RESTRICT;
    END IF;
END;
$$;

-- Add foreign key constraint separately to avoid issues on re-runs
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_appointment_slot_id_fkey') THEN
      ALTER TABLE public.students ADD CONSTRAINT students_appointment_slot_id_fkey FOREIGN KEY (appointment_slot_id) REFERENCES public.appointment_slots(id);
   END IF;
END;
$$;


-- 5. Create the profiles table for admin users, linked to Supabase Auth.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role role_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);
COMMENT ON TABLE public.profiles IS 'Stores profile information for admin users.';

-- 6. Create singleton table for app_settings.
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

-- 7. Create singleton table for notification_settings.
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

-- Create programs table
CREATE TABLE IF NOT EXISTS public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.programs IS 'Stores dynamic academic programs and their hierarchy.';

-- Insert initial programs
INSERT INTO public.programs (name, sort_order) VALUES
('Calligraphy Classes', 1),
('Mutoon Class', 2)
ON CONFLICT (name) DO NOTHING;


-- Create asset_settings table for dynamic site content
CREATE TABLE IF NOT EXISTS public.asset_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);
COMMENT ON TABLE public.asset_settings IS 'Stores dynamic site content like logos, links, and FAQs.';

-- Insert default site content
INSERT INTO public.asset_settings (key, value) VALUES
('logoUrl', '"https://res.cloudinary.com/di7okmjsx/image/upload/v1772398555/Al-Ibaanah_Vertical_Logo_pf389m.svg"'),
('officialSiteUrl', '"https://ibaanah.com/"'),
('heroVideoUrl', '"https://www.youtube.com/embed/dQw4w9WgXcQ"'),
('faqItems', '[{"question": "Do I need to register on the main site first?", "answer": "Yes, the first step is always to complete the main registration on the official Al-Ibaanah website. This portal is for booking your mandatory on-campus assessment slot after you have registered."}, {"question": "What happens during the assessment?", "answer": "The on-campus assessment is a friendly meeting with one of our instructors to gauge your current Arabic language proficiency. This helps us place you in the perfect level to ensure your success."}, {"question": "Can I reschedule my slot?", "answer": "Once a slot is booked, it is confirmed. If you have an emergency and need to reschedule, please contact our administration office directly at least 48 hours before your appointment."}]'),
('campusAddress', '"Block 12, Rd 18, Nasr City, Cairo, Egypt"'),
('campusHours', '"Sunday - Thursday, 9:00 AM - 2:00 PM"')
ON CONFLICT (key) DO NOTHING;


-- 8. Create a view for available slots to simplify client-side queries.
CREATE OR REPLACE VIEW public.available_appointment_slots AS
  SELECT id, start_time, end_time, capacity, booked, level_id, date
  FROM public.appointment_slots
  WHERE date >= CURRENT_DATE AND booked < capacity;

COMMENT ON VIEW public.available_appointment_slots IS 'Filters appointment slots to only show those that are in the future and have capacity.';


-- 9. Set up Row Level Security (RLS).
-- Enable RLS for all tables.
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_settings ENABLE ROW LEVEL SECURITY;
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


-- Policies for levels
DROP POLICY IF EXISTS "Allow public read access to active levels" ON public.levels;
CREATE POLICY "Allow public read access to active levels" ON public.levels FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Allow admin write access to levels" ON public.levels;
CREATE POLICY "Allow admin write access to levels" ON public.levels FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));

-- Policies for programs
DROP POLICY IF EXISTS "Allow public read access to active programs" ON public.programs;
CREATE POLICY "Allow public read access to active programs" ON public.programs FOR SELECT USING (is_active = true AND is_archived = false);
DROP POLICY IF EXISTS "Allow admin write access to programs" ON public.programs;
CREATE POLICY "Allow admin write access to programs" ON public.programs FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));

-- Policies for asset_settings
DROP POLICY IF EXISTS "Allow public read access to site assets" ON public.asset_settings;
CREATE POLICY "Allow public read access to site assets" ON public.asset_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin write access to site assets" ON public.asset_settings;
CREATE POLICY "Allow admin write access to site assets" ON public.asset_settings FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));

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


-- 10. Create database functions for application logic.

-- Transactional function for submitting registration.
CREATE OR REPLACE FUNCTION submit_student_registration(
    slot_id UUID,
    student_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    selected_slot RECORD;
    new_student_record RECORD;
    registration_is_open BOOLEAN;
    level_name_text TEXT;
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
    
    -- Get level name for the response
    SELECT name INTO level_name_text FROM public.levels WHERE id = (student_data->>'levelId')::UUID;

    -- Update the booked count
    UPDATE public.appointment_slots SET booked = selected_slot.booked + 1 WHERE id = slot_id;

    -- Insert the new student and return the new record
    INSERT INTO public.students (surname, firstname, othername, whatsapp, email, gender, address, level_id, intake_date, appointment_slot_id, registration_code)
    VALUES (
        student_data->>'surname',
        student_data->>'firstname',
        student_data->>'othername',
        student_data->>'whatsapp',
        student_data->>'email',
        (student_data->>'gender')::gender_enum,
        student_data->>'address',
        (student_data->>'levelId')::UUID,
        (student_data->>'intakeDate')::date,
        slot_id,
        'AI-' || upper(substr(md5(random()::text), 0, 9))
    ) RETURNING * INTO new_student_record;

    -- Return the full new student record as JSONB, including the level name
    RETURN jsonb_build_object(
        'id', new_student_record.id,
        'surname', new_student_record.surname,
        'firstname', new_student_record.firstname,
        'othername', new_student_record.othername,
        'whatsapp', new_student_record.whatsapp,
        'email', new_student_record.email,
        'gender', new_student_record.gender,
        'address', new_student_record.address,
        'levelId', new_student_record.level_id,
        'level', jsonb_build_object('id', new_student_record.level_id, 'name', level_name_text),
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
    SELECT count(*) INTO total_registered FROM public.students;

    SELECT count(*), count(*) FILTER (WHERE status = 'checked-in')
    INTO today_expected, checked_in
    FROM public.students
    WHERE intake_date = CURRENT_DATE;

    -- Breakdown by level: Show all active levels, even if they have 0 students.
    SELECT COALESCE(jsonb_agg(level_breakdown), '[]'::jsonb)
    INTO breakdown
    FROM (
        SELECT
            l.name,
            COUNT(s.id) AS value
        FROM public.levels l
        LEFT JOIN public.students s ON s.level_id = l.id
        WHERE l.is_active = true
        GROUP BY l.id, l.name, l.sort_order
        ORDER BY l.sort_order
    ) AS level_breakdown;

    SELECT COALESCE(jsonb_agg(slots), '[]'::jsonb) INTO utilization FROM (
        SELECT
            date,
            to_char(start_time, 'HH24:MI') as start_time,
            booked,
            capacity
        FROM public.appointment_slots
        WHERE date >= CURRENT_DATE
        ORDER BY date, start_time
        LIMIT 10
    ) AS slots;

    RETURN jsonb_build_object(
        'totalRegistered', total_registered,
        'todayExpected', today_expected,
        'checkedIn', checked_in,
        'breakdownByLevel', breakdown,
        'slotUtilization', utilization
    );
END;
$$;

-- Function to search students by a single query term across multiple fields
CREATE OR REPLACE FUNCTION search_students(search_term TEXT)
RETURNS SETOF students AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.students
    WHERE
        search_term IS NULL OR search_term = '' OR
        (firstname || ' ' || surname) ILIKE ('%' || search_term || '%') OR
        (surname || ' ' || firstname) ILIKE ('%' || search_term || '%') OR
        email ILIKE ('%' || search_term || '%') OR
        whatsapp ILIKE ('%' || search_term || '%') OR
        registration_code ILIKE ('%' || search_term || '%');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_students(TEXT) TO authenticated;