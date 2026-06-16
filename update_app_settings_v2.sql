-- Migration Script: Add Booking Window Columns
-- Description: Adds booking_start_time, booking_end_time, female_booking_start_time and female_booking_end_time to app_settings table
-- Safety: Uses DO blocks and IF NOT EXISTS to prevent errors if columns already exist.

DO $$ 
BEGIN
    -- Add booking_start_time if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM pg_attribute 
        WHERE attrelid = 'public.app_settings'::regclass 
        AND attname = 'booking_start_time'
    ) THEN
        ALTER TABLE public.app_settings ADD COLUMN booking_start_time TIMESTAMPTZ;
    END IF;

    -- Add booking_end_time if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM pg_attribute 
        WHERE attrelid = 'public.app_settings'::regclass 
        AND attname = 'booking_end_time'
    ) THEN
        ALTER TABLE public.app_settings ADD COLUMN booking_end_time TIMESTAMPTZ;
    END IF;

    -- Add female_booking_start_time if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM pg_attribute 
        WHERE attrelid = 'public.app_settings'::regclass 
        AND attname = 'female_booking_start_time'
    ) THEN
        ALTER TABLE public.app_settings ADD COLUMN female_booking_start_time TIMESTAMPTZ;
    END IF;

    -- Add female_booking_end_time if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM pg_attribute 
        WHERE attrelid = 'public.app_settings'::regclass 
        AND attname = 'female_booking_end_time'
    ) THEN
        ALTER TABLE public.app_settings ADD COLUMN female_booking_end_time TIMESTAMPTZ;
    END IF;
END;
$$;

-- Commentary: You can run this script in your Supabase SQL Editor. 
-- It is designed to be idempotent (safe to run multiple times).
