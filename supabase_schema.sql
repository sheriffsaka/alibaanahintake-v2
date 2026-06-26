-- 1. DROP custom ENUM type for levels to be replaced by a table.
DROP TYPE IF EXISTS public.level_enum CASCADE;
-- Create other ENUM types.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN CREATE TYPE public.gender_enum AS ENUM ('Male', 'Female'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN CREATE TYPE public.role_enum AS ENUM ('Super Admin', 'male_section_Admin', 'female_section_Admin', 'male_Front Desk', 'female_Front Desk', 'co_Admin'); END IF; END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.role_enum'::regtype AND enumlabel = 'co_Admin') THEN
            ALTER TYPE public.role_enum ADD VALUE 'co_Admin';
        END IF;
    END IF;
END $$;
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status_enum') THEN 
        CREATE TYPE public.student_status_enum AS ENUM ('booked', 'checked-in', 'archived'); 
    ELSE
        -- Add 'archived' if it doesn't exist in the enum
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.student_status_enum'::regtype AND enumlabel = 'archived') THEN
            ALTER TYPE public.student_status_enum ADD VALUE 'archived';
        END IF;
    END IF; 
END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resource_type_enum') THEN CREATE TYPE public.resource_type_enum AS ENUM ('book', 'video', 'image', 'document'); END IF; END $$;

-- 2. Create the new `levels` table.
CREATE TABLE IF NOT EXISTS public.levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.levels IS 'Stores dynamic academic levels for student booking.';

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
COMMENT ON TABLE public.appointment_slots IS 'Stores available time slots for student bookings.';

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
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.appointment_slots'::regclass AND attname = 'gender') THEN
        ALTER TABLE public.appointment_slots ADD COLUMN gender gender_enum;
    END IF;
END;
$$;


-- 4. Create the students table.
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surname TEXT NOT NULL,
    firstname TEXT NOT NULL,
    othername TEXT,
    whatsapp TEXT NOT NULL,
    email TEXT NOT NULL,
    gender gender_enum NOT NULL,
    address TEXT NOT NULL,
    building_number TEXT,
    flat_number TEXT,
    street_name TEXT,
    district TEXT,
    state TEXT,
    intake_date DATE NOT NULL,
    registration_code TEXT NOT NULL UNIQUE,
    appointment_slot_id UUID NOT NULL,
    status student_status_enum NOT NULL DEFAULT 'booked',
    language TEXT NOT NULL DEFAULT 'en',
    reminded_24h BOOLEAN NOT NULL DEFAULT false,
    reminded_day_of BOOLEAN NOT NULL DEFAULT false,
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
    -- Add new address columns if they don't exist
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.students'::regclass AND attname = 'building_number') THEN
        ALTER TABLE public.students ADD COLUMN building_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.students'::regclass AND attname = 'flat_number') THEN
        ALTER TABLE public.students ADD COLUMN flat_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.students'::regclass AND attname = 'street_name') THEN
        ALTER TABLE public.students ADD COLUMN street_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.students'::regclass AND attname = 'district') THEN
        ALTER TABLE public.students ADD COLUMN district TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.students'::regclass AND attname = 'state') THEN
        ALTER TABLE public.students ADD COLUMN state TEXT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.students'::regclass AND attname = 'reminder_24h_sent') THEN
        ALTER TABLE public.students ADD COLUMN reminder_24h_sent BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.students'::regclass AND attname = 'reminder_day_of_sent') THEN
        ALTER TABLE public.students ADD COLUMN reminder_day_of_sent BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.students'::regclass AND attname = 'language') THEN
        ALTER TABLE public.students ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
    END IF;
    
    -- Add indexes for dashboard performance
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'students' AND indexname = 'idx_students_intake_date') THEN
        CREATE INDEX idx_students_intake_date ON public.students(intake_date);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'students' AND indexname = 'idx_students_gender') THEN
        CREATE INDEX idx_students_gender ON public.students(gender);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'students' AND indexname = 'idx_students_status') THEN
        CREATE INDEX idx_students_status ON public.students(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'students' AND indexname = 'idx_students_level_id') THEN
        CREATE INDEX idx_students_level_id ON public.students(level_id);
    END IF;
END;
$$;

-- Add indexes for appointment_slots performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'appointment_slots' AND indexname = 'idx_appointment_slots_date') THEN
        CREATE INDEX idx_appointment_slots_date ON public.appointment_slots(date);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'appointment_slots' AND indexname = 'idx_appointment_slots_gender') THEN
        CREATE INDEX idx_appointment_slots_gender ON public.appointment_slots(gender);
    END IF;
END;
$$;

-- 4b. Create the pre_registrations table for leads who verified email but haven't booked a slot.
CREATE TABLE IF NOT EXISTS public.pre_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    form_data JSONB NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    verified_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.pre_registrations IS 'Stores student data after email verification but before final slot booking.';
ALTER TABLE public.pre_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert to pre_registrations" ON public.pre_registrations;
CREATE POLICY "Allow public insert to pre_registrations" ON public.pre_registrations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow admin read access to pre_registrations" ON public.pre_registrations;
CREATE POLICY "Allow admin read access to pre_registrations" ON public.pre_registrations FOR SELECT USING (get_my_role() IS NOT NULL);

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
    CONSTRAINT single_row CHECK (id = 1)
);
COMMENT ON TABLE public.app_settings IS 'Stores global application settings.';

-- This block makes the schema migration idempotent for the app_settings table.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.app_settings'::regclass AND attname = 'male_registration_open') THEN
        ALTER TABLE public.app_settings ADD COLUMN male_registration_open BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.app_settings'::regclass AND attname = 'female_registration_open') THEN
        ALTER TABLE public.app_settings ADD COLUMN female_registration_open BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.app_settings'::regclass AND attname = 'max_daily_capacity') THEN
        ALTER TABLE public.app_settings ADD COLUMN max_daily_capacity INT NOT NULL DEFAULT 100;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.app_settings'::regclass AND attname = 'closed_reasons') THEN
        ALTER TABLE public.app_settings ADD COLUMN closed_reasons JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.app_settings'::regclass AND attname = 'booking_start_time') THEN
        ALTER TABLE public.app_settings ADD COLUMN booking_start_time TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.app_settings'::regclass AND attname = 'booking_end_time') THEN
        ALTER TABLE public.app_settings ADD COLUMN booking_end_time TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.app_settings'::regclass AND attname = 'female_booking_start_time') THEN
        ALTER TABLE public.app_settings ADD COLUMN female_booking_start_time TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.app_settings'::regclass AND attname = 'female_booking_end_time') THEN
        ALTER TABLE public.app_settings ADD COLUMN female_booking_end_time TIMESTAMPTZ;
    END IF;
END;
$$;

-- Insert the single settings row.
INSERT INTO public.app_settings (id, registration_open, male_registration_open, female_registration_open, max_daily_capacity, closed_reasons)
VALUES (1, true, true, true, 100, '{}')
ON CONFLICT (id) DO NOTHING;

-- 7. Create singleton table for notification_settings.
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id INT PRIMARY KEY DEFAULT 1,
    settings JSONB NOT NULL,
    CONSTRAINT single_row CHECK (id = 1)
);
COMMENT ON TABLE public.notification_settings IS 'Stores email notification templates per language.';

-- Insert the single notification settings row with multilingual support.
INSERT INTO public.notification_settings (id, settings)
VALUES (1, '{
    "en": {
        "confirmation": {
            "enabled": true,
            "subject": "Your Al-Ibaanah Booking is Confirmed!",
            "body": "## **Registration Confirmation**\n\n**Dear {{studentName}},**\n\nYour slot booking for **{{level}}** registration on campus has been successfully confirmed.\n\n* **Date:** {{appointmentDate}}\n* **Time:** {{appointmentTime}}\n* **Booking Code:** {{registrationCode}}\n\nPlease find your **Admission Slip** attached. Kindly bring all required documents and fees with you to proceed with your registration. \n\n> **Important Note:** Registration cannot be processed for students who do not provide all required documentation at the time of their appointment.\n\n---\n\n### **Quick Checklist (Based on your slip):**\n* **Identification:** 3 copies of your international passport and 3 copies of a valid visa.\n* **Photos:** 3 passport-size photographs (or 1 if you are a returning student).\n* **Payment:** Tuition fee payment or proof of payment if already paid.\n\n---\n\n### **Contact Information:**\n* **Male / Brothers Section:** +201112335628\n* **Female / Sisters Section:** +201009537909"
        },
        "reminder24h": {
            "enabled": true,
            "subject": "Reminder: Your Al-Ibaanah Booking is Tomorrow",
            "body": "## **Registration Reminder**\n\n**Dear {{studentName}},**\n\nThis is a reminder that your slot booking for **{{level}}** registration on campus is scheduled for tomorrow.\n\n* **Date:** {{appointmentDate}}\n* **Time:** {{appointmentTime}}\n* **Booking Code:** {{registrationCode}}\n\nPlease find your **Admission Slip** attached. Kindly bring all required documents and fees with you to proceed with your registration. \n\n> **Important Note:** Registration cannot be processed for students who do not provide all required documentation at the time of their appointment.\n\n---\n\n### **Quick Checklist (Based on your slip):**\n* **Identification:** 3 copies of your international passport and 3 copies of a valid visa.\n* **Photos:** 3 passport-size photographs (or 1 if you are a returning student).\n* **Payment:** Tuition fee payment or proof of payment if already paid.\n\n---\n\n### **Contact Information:**\n* **Male / Brothers Section:** +201112335628\n* **Female / Sisters Section:** +201009537909"
        },
        "reminderDayOf": {
            "enabled": false,
            "subject": "Reminder: Your Al-Ibaanah Booking is Today",
            "body": "## **Registration Reminder**\n\n**Dear {{studentName}},**\n\nThis is a reminder that your slot booking for **{{level}}** registration on campus is scheduled for today.\n\n* **Date:** {{appointmentDate}}\n* **Time:** {{appointmentTime}}\n* **Booking Code:** {{registrationCode}}\n\nPlease find your **Admission Slip** attached. Kindly bring all required documents and fees with you to proceed with your registration. \n\n> **Important Note:** Registration cannot be processed for students who do not provide all required documentation at the time of their appointment.\n\n---\n\n### **Quick Checklist (Based on your slip):**\n* **Identification:** 3 copies of your international passport and 3 copies of a valid visa.\n* **Photos:** 3 passport-size photographs (or 1 if you are a returning student).\n* **Payment:** Tuition fee payment or proof of payment if already paid.\n\n---\n\n### **Contact Information:**\n* **Male / Brothers Section:** +201112335628\n* **Female / Sisters Section:** +201009537909"
        }
    },
    "ar": {
        "confirmation": {
            "enabled": true,
            "subject": "تم تأكيد حجزك في معهد الإبانة!",
            "body": "## **تأكيد التسجيل**\n\n**عزيزي {{studentName}}،**\n\nتم تأكيد حجز موعدك لتسجيل **{{level}}** في الحرم الجامعي بنجاح.\n\n* **التاريخ:** {{appointmentDate}}\n* **الوقت:** {{appointmentTime}}\n* **كود الحجز:** {{registrationCode}}\n\nيرجى تجد **بطاقة القبول** مرفقة. يرجى إحضار جميع المستندات والرسوم المطلوبة معك لإتمام عملية التسجيل.\n\n> **ملاحظة هامة:** لا يمكن إتمام عملية التسجيل للطلاب الذين لا يقدمون جميع المستندات المطلوبة في وقت موعدهم.\n\n---\n\n### **قائمة مراجعة سريعة (بناءً على بطاقتك):**\n* **الهوية:** 3 نسخ من جواز سفرك الدولي و3 نسخ من تأشيرة صالحة.\n* **الصور:** 3 صور شخصية بحجم جواز السفر (أو صورة واحدة إذا كنت طالباً عائداً).\n* **الدفع:** دفع الرسوم الدراسية أو إثبات الدفع إذا تم الدفع مسبقاً.\n\n---\n\n### **معلومات التواصل:**\n* **قسم الرجال / الإخوة:** +201112335628\n* **قسم النساء / الأخوات:** +201009537909"
        },
        "reminder24h": {
            "enabled": true,
            "subject": "تذكير: موعد حجزك في معهد الإبانة غداً",
            "body": "## **تذكير بالتسجيل**\n\n**عزيزي {{studentName}}،**\n\nهذا تذكير بأن حجز موعدك لتسجيل **{{level}}** في الحرم الجامعي مقرر غداً.\n\n* **التاريخ:** {{appointmentDate}}\n* **الوقت:** {{appointmentTime}}\n* **كود الحجز:** {{registrationCode}}\n\nيرجى تجد **بطاقة القبول** مرفقة. يرجى إحضار جميع المستندات والرسوم المطلوبة معك لإتمام عملية التسجيل.\n\n> **ملاحظة هامة:** لا يمكن إتمام عملية التسجيل للطلاب الذين لا يقدمون جميع المستندات المطلوبة في وقت موعدهم.\n\n---\n\n### **قائمة مراجعة سريعة (بناءً على بطاقتك):**\n* **الهوية:** 3 نسخ من جواز سفرك الدولي و3 نسخ من تأشيرة صالحة.\n* **الصور:** 3 صور شخصية بحجم جواز السفر (أو صورة واحدة إذا كنت طالباً عائداً).\n* **الدفع:** دفع الرسوم الدراسية أو إثبات الدفع إذا تم الدفع مسبقاً.\n\n---\n\n### **معلومات التواصل:**\n* **قسم الرجال / الإخوة:** +201112335628\n* **قسم النساء / الأخوات:** +201009537909"
        },
        "reminderDayOf": {
            "enabled": false,
            "subject": "تذكير: موعد حجزك في معهد الإبانة اليوم",
            "body": "## **تذكير بالتسجيل**\n\n**عزيزي {{studentName}}،**\n\nهذا تذكير بأن حجز موعدك لتسجيل **{{level}}** في الحرم الجامعي مقرر اليوم.\n\n* **التاريخ:** {{appointmentDate}}\n* **الوقت:** {{appointmentTime}}\n* **كود الحجز:** {{registrationCode}}\n\nيرجى تجد **بطاقة القبول** مرفقة. يرجى إحضار جميع المستندات والرسوم المطلوبة معك لإتمام عملية التسجيل.\n\n> **ملاحظة هامة:** لا يمكن إتمام عملية التسجيل للطلاب الذين لا يقدمون جميع المستندات المطلوبة في وقت موعدهم.\n\n---\n\n### **قائمة مراجعة سريعة (بناءً على بطاقتك):**\n* **الهوية:** 3 نسخ من جواز سفرك الدولي و3 نسخ من تأشيرة صالحة.\n* **الصور:** 3 صور شخصية بحجم جواز السفر (أو صورة واحدة إذا كنت طالباً عائداً).\n* **الدفع:** دفع الرسوم الدراسية أو إثبات الدفع إذا تم الدفع مسبقاً.\n\n---\n\n### **معلومات التواصل:**\n* **قسم الرجال / الإخوة:** +201112335628\n* **قسم النساء / الأخوات:** +201009537909"
        }
    },
    "fr": {
        "confirmation": {
            "enabled": true,
            "subject": "Votre réservation Al-Ibaanah est confirmée !",
            "body": "## **Confirmation d''inscription**\n\n**Cher {{studentName}},**\n\nVotre créneau pour l''inscription au **{{level}}** sur le campus a été confirmé avec succès.\n\n* **Date :** {{appointmentDate}}\n* **Heure :** {{appointmentTime}}\n* **Code de réservation :** {{registrationCode}}\n\nVeuillez trouver votre **fiche d''admission** ci-jointe. Nous vous prions d''apporter tous les documents requis ainsi que les frais de scolarité pour procéder à l''inscription.\n\n> **Note importante :** L''inscription ne pourra pas être effectuée pour les étudiants qui ne présentent pas l''intégralité des documents requis lors de leur rendez-vous.\n\n---\n\n### **Liste de contrôle rapide (Basée sur votre fiche) :**\n* **Identification :** 3 copies de votre passeport international et 3 copies d''un visa valide.\n* **Photos :** 3 photographies de format passeport (ou 1 si vous êtes un étudiant de retour).\n* **Paiement :** Paiement des frais de scolarité ou preuve de paiement si déjà payé.\n\n---\n\n### **Informations de contact :**\n* **Section Hommes / Frères :** +201112335628\n* **Section Femmes / Sœurs :** +201009537909"
        },
        "reminder24h": {
            "enabled": true,
            "subject": "Rappel : Votre réservation Al-Ibaanah est demain",
            "body": "## **Rappel d''inscription**\n\n**Cher {{studentName}},**\n\nCeci est un rappel que votre créneau pour l''inscription au **{{level}}** sur le campus est prévu pour demain.\n\n* **Date :** {{appointmentDate}}\n* **Heure :** {{appointmentTime}}\n* **Code de réservation :** {{registrationCode}}\n\nVeuillez trouver votre **fiche d''admission** ci-jointe. Nous vous prions d''apporter tous les documents requis ainsi que les frais de scolarité pour procéder à l''inscription.\n\n> **Note importante :** L''inscription ne pourra pas être effectuée pour les étudiants qui ne présentent pas l''intégralité des documents requis lors de leur rendez-vous.\n\n---\n\n### **Liste de contrôle rapide (Basée sur votre fiche) :**\n* **Identification :** 3 copies de votre passeport international et 3 copies d''un visa valide.\n* **Photos :** 3 photographies de format passeport (ou 1 si vous êtes un étudiant de retour).\n* **Paiement :** Paiement des frais de scolarité ou preuve de paiement si déjà payé.\n\n---\n\n### **Informations de contact :**\n* **Section Hommes / Frères :** +201112335628\n* **Section Femmes / Sœurs :** +201009537909"
        },
        "reminderDayOf": {
            "enabled": false,
            "subject": "Rappel : Votre réservation Al-Ibaanah est aujourd''hui",
            "body": "## **Rappel d''inscription**\n\n**Cher {{studentName}},**\n\nCeci est un rappel que votre créneau pour l''inscription au **{{level}}** sur le campus est prévu pour aujourd''hui.\n\n* **Date :** {{appointmentDate}}\n* **Heure :** {{appointmentTime}}\n* **Code de réservation :** {{registrationCode}}\n\nVeuillez trouver votre **fiche d''admission** ci-jointe. Nous vous prions d''apporter tous les documents requis ainsi que les frais de scolarité pour procéder à l''inscription.\n\n> **Note importante :** L''inscription ne pourra pas être effectuée pour les étudiants qui ne présentent pas l''intégralité des documents requis lors de leur rendez-vous.\n\n---\n\n### **Liste de contrôle rapide (Basée sur votre fiche) :**\n* **Identification :** 3 copies de votre passeport international et 3 copies d''un visa valide.\n* **Photos :** 3 photographies de format passeport (ou 1 si vous êtes un étudiant de retour).\n* **Paiement :** Paiement des frais de scolarité ou preuve de paiement si déjà payé.\n\n---\n\n### **Informations de contact :**\n* **Section Hommes / Frères :** +201112335628\n* **Section Femmes / Sœurs :** +201009537909"
        }
    },
    "zh": {
        "confirmation": {
            "enabled": true,
            "subject": "您的 Al-Ibaanah 预约已确认！",
            "body": "## **注册确认**\n\n**亲爱的 {{studentName}}：**\n\n您在校园进行的 **{{level}}** 注册预约已确认成功。\n\n* **日期：** {{appointmentDate}}\n* **时间：** {{appointmentTime}}\n* **预约代码：** {{registrationCode}}\n\n请查收随信附上的**入学通知单**。请务必携带所有必需文件及学费以办理注册手续。\n\n> **重要提示：** 若学生在预约时间内未能提供齐备的所有证明文件，将无法办理注册。\n\n---\n\n### **快速检查清单（根据您的通知单）：**\n* **身份证明：** 3份国际护照复印件和3份有效签证复印件。\n* **照片：** 3张护照尺寸照片（如果是返校学生，则只需1张）。\n* **费用：** 缴纳学费或提供已缴费证明。\n\n---\n\n### **联系信息：**\n* **男部 / 兄弟部：** +201112335628\n* **女部 / 姐妹部：** +201009537909"
        },
        "reminder24h": {
            "enabled": true,
            "subject": "提醒：您的 Al-Ibaanah 预约在明天",
            "body": "## **注册提醒**\n\n**亲爱的 {{studentName}}：**\n\n提醒您，您在校园进行的 **{{level}}** 注册预约定于明天。\n\n* **日期：** {{appointmentDate}}\n* **时间：** {{appointmentTime}}\n* **预约代码：** {{registrationCode}}\n\n请查收随信附上的**入学通知单**。请务必携带所有必需文件及学费以办理注册手续。\n\n> **重要提示：** 若学生在预约时间内未能提供齐备的所有证明文件，将无法办理注册。\n\n---\n\n### **快速检查清单（根据您的通知单）：**\n* **身份证明：** 3份国际护照复印件和3份有效签证复印件。\n* **照片：** 3张护照尺寸照片（如果是返校学生，则只需1张）。\n* **费用：** 缴纳学费或提供已缴费证明。\n\n---\n\n### **联系信息：**\n* **男部 / 兄弟部：** +201112335628\n* **女部 / 姐妹部：** +201009537909"
        },
        "reminderDayOf": {
            "enabled": false,
            "subject": "提醒：您的 Al-Ibaanah 预约在今天",
            "body": "## **注册提醒**\n\n**亲爱的 {{studentName}}：**\n\n提醒您，您在校园进行的 **{{level}}** 注册预约定于今天。\n\n* **日期：** {{appointmentDate}}\n* **时间：** {{appointmentTime}}\n* **预约代码：** {{registrationCode}}\n\n请查收随信附上的**入学通知单**。请务必携带所有必需文件及学费以办理注册手续。\n\n> **重要提示：** 若学生在预约时间内未能提供齐备的所有证明文件，将无法办理注册。\n\n---\n\n### **快速检查清单（根据您的通知单）：**\n* **身份证明：** 3份国际护照复印件和3份有效签证复印件。\n* **照片：** 3张护照尺寸照片（如果是返校学生，则只需1张）。\n* **费用：** 缴纳学费或提供已缴费证明。\n\n---\n\n### **联系信息：**\n* **男部 / 兄弟部：** +201112335628\n* **女部 / 姐妹部：** +201009537909"
        }
    },
    "uz": {
        "confirmation": {
            "enabled": true,
            "subject": "Al-Ibaanah band qilinganligingiz tasdiqlandi!",
            "body": "## **Ro''yxatdan o''tishni tasdiqlash**\n\n**Hurmatli {{studentName}},**\n\nKampusda **{{level}}** uchun ro''yxatdan o''tish vaqtingiz muvaffaqiyatli tasdiqlandi.\n\n* **Sana:** {{appointmentDate}}\n* **Vaqt:** {{appointmentTime}}\n* **Band qilish kodi:** {{registrationCode}}\n\nIlova qilingan **qabul varaqasini** ko''rib chiqing. Ro''yxatdan o''tishni davom ettirish uchun barcha kerakli hujjatlarni va to''lovlarni o''zingiz bilan olib kelishingizni so''raymiz.\n\n> **Muhim eslatma:** Belgilangan vaqtda barcha kerakli hujjatlarni to''liq taqdim etmagan talabalar ro''yxatdan o''tkazilmaydi.\n\n---\n\n### **Tezkor nazorat ro''yxati (Qabul varaqangiz asosida):**\n* **Shaxsni tasdiqlash:** Xalqaro pasportingizning 3 nusxasi va amaldagi vizaning 3 nusxasi.\n* **Fotosuratlar:** 3 ta pasport o''lchamidagi fotosurat (agar siz qaytib kelgan talaba bo''lsangiz, 1 ta).\n* **To''lov:** O''quv to''lovi yoki allaqachon to''langan bo''lsa, to''lovni tasdiqlovchi hujjat.\n\n---\n\n### **Bog''lanish uchun ma''lumotlar:**\n* **Erkaklar / Birodarlar bo''limi:** +201112335628\n* **Ayollar / Opa-singillar bo''limi:** +201009537909"
        },
        "reminder24h": {
            "enabled": true,
            "subject": "Eslatma: Al-Ibaanah band qilinganligingiz ertaga",
            "body": "## **Ro''yxatdan o''tish haqida eslatma**\n\n**Hurmatli {{studentName}},**\n\nBu kampusdagi **{{level}}** uchun ro''yxatdan o''tish vaqtingiz ertaga ekanligi haqida eslatma.\n\n* **Sana:** {{appointmentDate}}\n* **Vaqt:** {{appointmentTime}}\n* **Band qilish kodi:** {{registrationCode}}\n\nIlova qilingan **qabul varaqasini** ko''rib chiqing. Ro''yxatdan o''tishni davom ettirish uchun barcha kerakli hujjatlarni va to''lovlarni o''zingiz bilan olib kelishingizni so''raymiz.\n\n> **Muhim eslatma:** Belgilangan vaqtda barcha kerakli hujjatlarni to''liq taqdim etmagan talabalar ro''yxatdan o''tkazilmaydi.\n\n---\n\n### **Tezkor nazorat ro''yxati (Qabul varaqangiz asosida):**\n* **Shaxsni tasdiqlash:** Xalqaro pasportingizning 3 nusxasi va amaldagi vizaning 3 nusxasi.\n* **Fotosuratlar:** 3 ta pasport o''lchamidagi fotosurat (agar siz qaytib kelgan talaba bo''lsangiz, 1 ta).\n* **To''lov:** O''quv to''lovi yoki allaqachon to''langan bo''lsa, to''lovni tasdiqlovchi hujjat.\n\n---\n\n### **Bog''lanish uchun ma''lumotlar:**\n* **Erkaklar / Birodarlar bo''limi:** +201112335628\n* **Ayollar / Opa-singillar bo''limi:** +201009537909"
        },
        "reminderDayOf": {
            "enabled": false,
            "subject": "Eslatma: Al-Ibaanah band qilinganligingiz bugun",
            "body": "## **Ro''yxatdan o''tish haqida eslatma**\n\n**Hurmatli {{studentName}},**\n\nBu kampusdagi **{{level}}** uchun ro''yxatdan o''tish vaqtingiz bugun ekanligi haqida eslatma.\n\n* **Sana:** {{appointmentDate}}\n* **Vaqt:** {{appointmentTime}}\n* **Band qilish kodi:** {{registrationCode}}\n\nIlova qilingan **qabul varaqasini** ko''rib chiqing. Ro''yxatdan o''tishni davom ettirish uchun barcha kerakli hujjatlarni va to''lovlarni o''zingiz bilan olib kelishingizni so''raymiz.\n\n> **Muhim eslatma:** Belgilangan vaqtda barcha kerakli hujjatlarni to''liq taqdim etmagan talabalar ro''yxatdan o''tkazilmaydi.\n\n---\n\n### **Tezkor nazorat ro''yxati (Qabul varaqangiz asosida):**\n* **Shaxsni tasdiqlash:** Xalqaro pasportingizning 3 nusxasi va amaldagi vizaning 3 nusxasi.\n* **Fotosuratlar:** 3 ta pasport o''lchamidagi fotosurat (agar siz qaytib kelgan talaba bo''lsangiz, 1 ta).\n* **To''lov:** O''quv to''lovi yoki allaqachon to''langan bo''lsa, to''lovni tasdiqlovchi hujjat.\n\n---\n\n### **Bog''lanish uchun ma''lumotlar:**\n* **Erkaklar / Birodarlar bo''limi:** +201112335628\n* **Ayollar / Opa-singillar bo''limi:** +201009537909"
        }
    },
    "ru": {
        "confirmation": {
            "enabled": true,
            "subject": "Ваше бронирование в Al-Ibaanah подтверждено!",
            "body": "## **Подтверждение регистрации**\n\n**Уважаемый {{studentName}}!**\n\nВаша запись на регистрацию на **{{level}}** успешно подтверждена.\n\n* **Дата:** {{appointmentDate}}\n* **Время:** {{appointmentTime}}\n* **Код бронирования:** {{registrationCode}}\n\nВаш **бланк допуска** находится во вложении. Пожалуйста, возьмите с собой все необходимые документы и оплату для завершения регистрации.\n\n> **Важное примечание:** Регистрация не будет осуществлена для студентов, которые не предоставят полный пакет документов во время приема.\n\n---\n\n### **Краткий контрольный список (на основании вашего бланка):**\n* **Идентификация:** 3 копии вашего заграничного паспорта и 3 копии действующей визы.\n* **Фотографии:** 3 фотографии паспортного размера (или 1, если вы являетесь восстановившимся студентом).\n* **Оплата:** Оплата за обучение или подтверждение оплаты, если она уже произведена.\n\n---\n\n### **Контактная информация:**\n* **Мужская секция / Братья:** +201112335628\n* **Женская секция / Сестры:** +201009537909"
        },
        "reminder24h": {
            "enabled": true,
            "subject": "Напоминание: Ваше бронирование в Al-Ibaanah завтра",
            "body": "## **Напоминание о регистрации**\n\n**Уважаемый {{studentName}}!**\n\nЭто напоминание о том, что ваша запись на регистрацию на **{{level}}** запланирована на завтра.\n\n* **Дата:** {{appointmentDate}}\n* **Время:** {{appointmentTime}}\n* **Код бронирования:** {{registrationCode}}\n\nВаш **бланк допуска** находится во вложении. Пожалуйста, возьмите с собой все необходимые документы и оплату для завершения регистрации.\n\n> **Важное примечание:** Регистрация не будет осуществлена для студентов, которые не предоставят полный пакет документов во время приема.\n\n---\n\n### **Краткий контрольный список (на основании вашего бланка):**\n* **Идентификация:** 3 копии вашего заграничного паспорта и 3 копии действующей визы.\n* **Фотографии:** 3 фотографии паспортного размера (или 1, если вы являетесь восстановившимся студентом).\n* **Оплата:** Оплата за обучение или подтверждение оплаты, если она уже произведена.\n\n---\n\n### **Контактная информация:**\n* **Мужская секция / Братья:** +201112335628\n* **Женская секция / Сестры:** +201009537909"
        },
        "reminderDayOf": {
            "enabled": false,
            "subject": "Напоминание: Ваше бронирование в Al-Ibaanah сегодня",
            "body": "## **Напоминание о регистрации**\n\n**Уважаемый {{studentName}}!**\n\nЭто напоминание о том, что ваша запись на регистрацию на **{{level}}** запланирована на сегодня.\n\n* **Дата:** {{appointmentDate}}\n* **Время:** {{appointmentTime}}\n* **Код бронирования:** {{registrationCode}}\n\nВаш **бланк допуска** находится во вложении. Пожалуйста, возьмите с собой все необходимые документы и оплату для завершения регистрации.\n\n> **Важное примечание:** Регистрация не будет осуществлена для студентов, которые не предоставят полный пакет документов во время приема.\n\n---\n\n### **Краткий контрольный список (на основании вашего бланка):**\n* **Идентификация:** 3 копии вашего заграничного паспорта и 3 копии действующей визы.\n* **Фотографии:** 3 фотографии паспортного размера (или 1, если вы являетесь восстановившимся студентом).\n* **Оплата:** Оплата за обучение или подтверждение оплаты, если она уже произведена.\n\n---\n\n### **Контактная информация:**\n* **Мужская секция / Братья:** +201112335628\n* **Женская секция / Сестры:** +201009537909"
        }
    }
}')
ON CONFLICT (id) DO NOTHING;

-- 8. Create programs table
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


-- 9. Create asset_settings table for dynamic site content
CREATE TABLE IF NOT EXISTS public.asset_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);
COMMENT ON TABLE public.asset_settings IS 'Stores dynamic site content like logos, links, and FAQs.';

-- Insert default site content
INSERT INTO public.asset_settings (key, value) VALUES
('logoUrl', '"https://res.cloudinary.com/di7okmjsx/image/upload/v1771428370/alibaanahlogo1_iprhyj.png"'),
('officialSiteUrl', '"https://ibaanah.com/"'),
('heroVideoUrl', '{"en": "https://www.youtube.com/embed/dQw4w9WgXcQ", "ar": "https://www.youtube.com/embed/CenZeeJ3m_4", "fr": "https://www.youtube.com/embed/s2qg2x-NYyE"}'),
('faqItems', '{
    "en": [
        {"question": "Do I need to register on the main site first?", "answer": "Yes, the first step is always to complete the main registration on the official Al-Ibaanah website. This portal is for booking your mandatory on-campus booking slot after you have registered."}
    ],
    "ar": [
        {"question": "هل يجب أن أسجل في الموقع الرئيسي أولاً؟", "answer": "نعم، الخطوة الأولى دائمًا هي إكمال التسجيل الرئيسي على موقع الإبانة الرسمي. هذه البوابة مخصصة لحجز موعد التقييم الإلزامي في الحرم الجامعي بعد التسجيل."}
    ],
    "fr": [
        {"question": "Dois-je m''inscrire d''abord sur le site principal ?", "answer": "Oui, la première étape est toujours de compléter l''inscription principale sur le site officiel d''Al-Ibaanah. Ce portail sert à réserver votre créneau d''évaluation obligatoire sur le campus après votre inscription."}
    ],
    "zh": [
        {"question": "我需要先在主站点注册吗？", "answer": "是的，第一步总是在 Al-Ibaanah 官方网站上完成主注册。此门户用于在您注册后预订您的强制性校内评估时段。"}
    ],
    "ru": [
        {"question": "Нужно ли мне сначала регистрироваться на основном сайте?", "answer": "Да, первым шагом всегда является завершение основной регистрации на официальном сайте Al-Ibaanah. Этот портал предназначен для бронирования обязательного времени для оценки в кампусе после вашей регистрации."}
    ],
    "uz": [
        {"question": "Avval asosiy saytda roʻyxatdan oʻtishim kerakmi?", "answer": "Ha, birinchi qadam har doim Al-Ibaanah rasmiy veb-saytida asosiy ro''yxatdan o''tishni yakunlashdir. Ushbu portal ro''yxatdan o''tganingizdan so''ng majburiy kampusda baholash vaqtini bron qilish uchun mo''ljallangan."}
    ]
}'),
('campusAddress', '"Block 12, Rd 18, Nasr City, Cairo, Egypt"'),
('campusHours', '"Sunday - Thursday, 9:00 AM - 2:00 PM"')
ON CONFLICT (key) DO NOTHING;


-- 10. Create program_resources table
CREATE TABLE IF NOT EXISTS public.program_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    resource_type resource_type_enum NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.program_resources IS 'Stores educational resources linked to specific programs.';

-- 11. Create a view for available slots to simplify client-side queries.
DROP VIEW IF EXISTS public.available_appointment_slots;
CREATE VIEW public.available_appointment_slots AS
  SELECT id, start_time, end_time, capacity, booked, level_id, gender, date
  FROM public.appointment_slots
  WHERE date >= CURRENT_DATE AND booked < capacity;
COMMENT ON VIEW public.available_appointment_slots IS 'Filters appointment slots to only show those that are in the future and have capacity.';

-- 11b. Create otp_codes table for custom OTP verification to bypass Supabase Auth rate limits.
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON public.otp_codes(email);
COMMENT ON TABLE public.otp_codes IS 'Stores custom 6-digit OTP codes for email verification.';
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- No public access to this table, only server-side via service role.
DROP POLICY IF EXISTS "No public access to otp_codes" ON public.otp_codes;
CREATE POLICY "No public access to otp_codes" ON public.otp_codes FOR ALL USING (false);


-- 12. Set up Storage Bucket for Program Resources
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('program_resources', 'program_resources', true, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;


-- 13. Set up Row Level Security (RLS).
-- Enable RLS for all tables.
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_resources ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "Allow admin write access to levels" ON public.levels FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin', 'co_Admin'));

-- Policies for programs
DROP POLICY IF EXISTS "Allow public read access to active programs" ON public.programs;
CREATE POLICY "Allow public read access to active programs" ON public.programs FOR SELECT USING (is_active = true AND is_archived = false);
DROP POLICY IF EXISTS "Allow admin write access to programs" ON public.programs;
CREATE POLICY "Allow admin write access to programs" ON public.programs FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));

-- Policies for program_resources
DROP POLICY IF EXISTS "Allow public read access to program resources" ON public.program_resources;
CREATE POLICY "Allow public read access to program resources" ON public.program_resources FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin write access to program resources" ON public.program_resources;
CREATE POLICY "Allow admin write access to program resources" ON public.program_resources FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));


-- Policies for asset_settings
DROP POLICY IF EXISTS "Allow public read access to site assets" ON public.asset_settings;
CREATE POLICY "Allow public read access to site assets" ON public.asset_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin write access to site assets" ON public.asset_settings;
CREATE POLICY "Allow admin write access to site assets" ON public.asset_settings FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin'));

-- Policies for appointment_slots
DROP POLICY IF EXISTS "Allow public read access to slots" ON public.appointment_slots;
CREATE POLICY "Allow public read access to slots" ON public.appointment_slots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow admin write access to slots" ON public.appointment_slots;
CREATE POLICY "Allow admin write access to slots" ON public.appointment_slots FOR ALL USING (get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin', 'co_Admin'));

-- Grant access to the available slots view
GRANT SELECT ON public.available_appointment_slots TO anon, authenticated;


-- Policies for students
DROP POLICY IF EXISTS "Allow admin read access to students" ON public.students;
CREATE POLICY "Allow admin read access to students" ON public.students FOR SELECT USING (
    (get_my_role() IN ('Super Admin', 'co_Admin')) OR
    (get_my_role() IN ('male_section_Admin', 'male_Front Desk') AND gender = 'Male') OR
    (get_my_role() IN ('female_section_Admin', 'female_Front Desk') AND gender = 'Female')
);
DROP POLICY IF EXISTS "Allow front desk to update status" ON public.students;
CREATE POLICY "Allow front desk to update status" ON public.students FOR UPDATE USING (get_my_role() IN ('Super Admin', 'male_Front Desk', 'female_Front Desk', 'co_Admin')) WITH CHECK (get_my_role() IN ('Super Admin', 'male_Front Desk', 'female_Front Desk', 'co_Admin'));

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


-- Storage Bucket Policies
DROP POLICY IF EXISTS "Allow public read access on program_resources" ON storage.objects;
CREATE POLICY "Allow public read access on program_resources"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'program_resources');

DROP POLICY IF EXISTS "Allow admin inserts on program_resources" ON storage.objects;
CREATE POLICY "Allow admin inserts on program_resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'program_resources' AND
    get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin')
);

DROP POLICY IF EXISTS "Allow admin updates on program_resources" ON storage.objects;
CREATE POLICY "Allow admin updates on program_resources"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'program_resources' AND
    get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin')
);

DROP POLICY IF EXISTS "Allow admin deletes on program_resources" ON storage.objects;
CREATE POLICY "Allow admin deletes on program_resources"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'program_resources' AND
    get_my_role() IN ('Super Admin', 'male_section_Admin', 'female_section_Admin')
);


-- 14. Create database functions for application logic.
-- Transactional function for submitting booking.
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
    booking_is_open BOOLEAN;
    male_open BOOLEAN;
    female_open BOOLEAN;
    level_name_text TEXT;
BEGIN
    -- Check if bookings are open
    SELECT registration_open, male_registration_open, female_registration_open 
    INTO booking_is_open, male_open, female_open 
    FROM public.app_settings WHERE id = 1;
    
    IF NOT booking_is_open THEN
        RAISE EXCEPTION 'Bookings are currently closed.';
    END IF;

    IF (student_data->>'gender')::gender_enum = 'Male' AND NOT male_open THEN
        RAISE EXCEPTION 'Registration for the Brothers section is currently closed.';
    END IF;

    IF (student_data->>'gender')::gender_enum = 'Female' AND NOT female_open THEN
        RAISE EXCEPTION 'Registration for the Sisters section is currently closed.';
    END IF;

    -- Check 6-week rule: A student can only book again after 6 weeks
    -- We ignore 'archived' students to allow re-registration after a session renewal
    IF EXISTS (
        SELECT 1 FROM public.students 
        WHERE lower(email) = lower(student_data->>'email') 
        AND status != 'archived'
        AND created_at > now() - interval '6 weeks'
    ) THEN
        RAISE EXCEPTION 'You have already booked a slot recently. Please wait 6 weeks between bookings.';
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
    INSERT INTO public.students (
        surname, firstname, othername, whatsapp, email, gender, address, 
        building_number, flat_number, street_name, district, state,
        level_id, intake_date, appointment_slot_id, registration_code, language
    )
    VALUES (
        student_data->>'surname',
        student_data->>'firstname',
        student_data->>'othername',
        student_data->>'whatsapp',
        student_data->>'email',
        (student_data->>'gender')::gender_enum,
        student_data->>'address',
        student_data->>'buildingNumber',
        student_data->>'flatNumber',
        student_data->>'streetName',
        student_data->>'district',
        student_data->>'state',
        (student_data->>'levelId')::UUID,
        (student_data->>'intakeDate')::date,
        slot_id,
        'AI-' || upper(substr(md5(random()::text), 0, 9)),
        COALESCE(student_data->>'language', 'en')
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
        'buildingNumber', new_student_record.building_number,
        'flatNumber', new_student_record.flat_number,
        'streetName', new_student_record.street_name,
        'district', new_student_record.district,
        'state', new_student_record.state,
        'levelId', new_student_record.level_id,
        'level', jsonb_build_object('id', new_student_record.level_id, 'name', level_name_text),
        'intakeDate', new_student_record.intake_date,
        'registrationCode', new_student_record.registration_code,
        'appointmentSlotId', new_student_record.appointment_slot_id,
        'status', new_student_record.status,
        'language', new_student_record.language,
        'createdAt', new_student_record.created_at
    );
END;
$$;

-- Grant execute permission on the function to the anon and authenticated roles.
GRANT EXECUTE ON FUNCTION public.submit_student_registration(UUID, JSONB) TO anon, authenticated;


-- RPC function for fetching all dashboard data in a single, efficient query.
CREATE OR REPLACE FUNCTION get_dashboard_statistics()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    user_role role_enum;
    gender_filter gender_enum;
    total_registered BIGINT;
    today_expected BIGINT;
    checked_in BIGINT;
    breakdown JSONB;
    utilization JSONB;
BEGIN
    user_role := get_my_role();
    IF user_role IN ('male_section_Admin', 'male_Front Desk') THEN
        gender_filter := 'Male';
    ELSIF user_role IN ('female_section_Admin', 'female_Front Desk') THEN
        gender_filter := 'Female';
    END IF;

    SELECT count(*) INTO total_registered FROM public.students WHERE (gender = gender_filter OR gender_filter IS NULL);

    SELECT count(*), count(*) FILTER (WHERE status = 'checked-in')
    INTO today_expected, checked_in
    FROM public.students
    WHERE intake_date = CURRENT_DATE AND (gender = gender_filter OR gender_filter IS NULL);

    -- Breakdown by level: Show all active levels, even if they have 0 students.
    SELECT COALESCE(jsonb_agg(level_breakdown), '[]'::jsonb)
    INTO breakdown
    FROM (
        SELECT
            l.name,
            COUNT(s.id) AS value
        FROM public.levels l
        LEFT JOIN public.students s ON s.level_id = l.id AND (s.gender = gender_filter OR gender_filter IS NULL)
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
        WHERE date >= CURRENT_DATE AND (gender = gender_filter OR gender_filter IS NULL)
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
DECLARE
    user_role role_enum;
    gender_filter gender_enum;
BEGIN
    user_role := get_my_role();
    IF user_role IN ('male_section_Admin', 'male_Front Desk') THEN
        gender_filter := 'Male';
    ELSIF user_role IN ('female_section_Admin', 'female_Front Desk') THEN
        gender_filter := 'Female';
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.students
    WHERE
        (gender = gender_filter OR gender_filter IS NULL) AND
        (
            search_term IS NULL OR search_term = '' OR
            (firstname || ' ' || surname) ILIKE ('%' || search_term || '%') OR
            (surname || ' ' || firstname) ILIKE ('%' || search_term || '%') OR
            email ILIKE ('%' || search_term || '%') OR
            whatsapp ILIKE ('%' || search_term || '%') OR
            registration_code ILIKE ('%' || search_term || '%')
        );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


GRANT EXECUTE ON FUNCTION public.get_dashboard_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_students(TEXT) TO authenticated;

-- Added RPC for secure check-in with date validation
CREATE OR REPLACE FUNCTION check_in_student_rpc(target_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    found_student_record RECORD;
    output_record RECORD;
    level_name_text TEXT;
BEGIN
    -- 1. Fetch student and check their appointment date
    SELECT s.*, l.name as level_name INTO found_student_record 
    FROM public.students s
    JOIN public.levels l ON l.id = s.level_id
    WHERE s.id = target_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    -- 2. Enforce check-in only on appointment date
    IF found_student_record.intake_date != CURRENT_DATE THEN
        RAISE EXCEPTION 'Check-in failed. This student''s appointment is scheduled for %. Please return on the scheduled date.', found_student_record.intake_date;
    END IF;

    -- 3. Check if already checked in
    IF found_student_record.status = 'checked-in' THEN
        RAISE EXCEPTION 'Student is already checked in.';
    END IF;

    -- 4. Perform update
    UPDATE public.students 
    SET status = 'checked-in' 
    WHERE id = target_student_id 
    RETURNING * INTO output_record;

    -- 5. Return JSON record
    RETURN jsonb_build_object(
        'id', output_record.id,
        'surname', output_record.surname,
        'firstname', output_record.firstname,
        'othername', output_record.othername,
        'whatsapp', output_record.whatsapp,
        'email', output_record.email,
        'gender', output_record.gender,
        'address', output_record.address,
        'buildingNumber', output_record.building_number,
        'flatNumber', output_record.flat_number,
        'streetName', output_record.street_name,
        'district', output_record.district,
        'state', output_record.state,
        'levelId', output_record.level_id,
        'level', jsonb_build_object('id', output_record.level_id, 'name', found_student_record.level_name),
        'intakeDate', output_record.intake_date,
        'registrationCode', output_record.registration_code,
        'appointmentSlotId', output_record.appointment_slot_id,
        'status', output_record.status,
        'language', output_record.language,
        'createdAt', output_record.created_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_student_rpc(UUID) TO authenticated;
