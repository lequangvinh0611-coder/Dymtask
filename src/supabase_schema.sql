-- 1. Create Custom Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('master', 'admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'SUBMITTED', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ONETIME');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enable status 'SKIPPED' if it was missing in ENUM (for existing DBs)
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'SKIPPED';

-- 2. Create Users Table (Essential for Profile & Roles)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role DEFAULT 'user' NOT NULL,
    teams TEXT[] DEFAULT '{}', -- Legacy
    team_ids TEXT[] DEFAULT '{}', -- New standard
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure team_ids exists if table was created previously
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_ids TEXT[] DEFAULT '{}';

-- 2.1 Master Data Tables
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Tasks Table (Simplified and Robust)
-- Note: Adjusted to include all missing columns seen in code
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_id SERIAL UNIQUE, -- Auto-incrementing readable ID
    task_name TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id),
    tag_id UUID REFERENCES public.tags(id),
    project_id UUID REFERENCES public.projects(id),
    team_id UUID REFERENCES public.teams(id),
    team_ids TEXT[] DEFAULT '{}', -- Multi-team support
    type task_type DEFAULT 'ONETIME' NOT NULL,
    deadline_time TIME,
    deadline_days TEXT[],
    deadline_date DATE,
    deadline_day_num INTEGER,
    estimated_minutes INTEGER DEFAULT 0,
    actual_minutes INTEGER DEFAULT 0,
    status task_status DEFAULT 'NEW' NOT NULL,
    subtasks JSONB DEFAULT '[]'::jsonb,
    assignees TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- If table already exists, ensure columns are present
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS team_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS display_id SERIAL; -- Note: Adding SERIAL to existing column is tricky, usually better to create with it.
ALTER TABLE public.tasks ADD CONSTRAINT tasks_display_id_unique UNIQUE (display_id);

-- 7. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    description TEXT,
    user_id UUID REFERENCES public.users(id),
    user_name TEXT, -- Denormalized for quick display
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Row Level Security (RLS)

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 9. Task Access Policy
-- Chỉ những user có role = 'master' hoặc email nằm trong danh sách assignees của task đó mới được quyền xem/sửa.

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Policy for tasks: SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "Task Access Policy" ON public.tasks
FOR ALL
USING (
  (SELECT public.get_current_user_role()) = 'master' 
  OR 
  (auth.jwt() ->> 'email') = ANY(assignees)
);

-- 10. Policies for users table
-- Use a more direct check for roles to avoid recursion if possible, 
-- or ensure the helper function is robust.
CREATE POLICY "Users can see all other users" ON public.users
FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.users
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can edit their own profile" ON public.users
FOR UPDATE USING (auth.uid() = id);

-- Master/Admin policy for managing other users
CREATE POLICY "Admins manage all users" ON public.users
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('master', 'admin')
  )
);

-- Functions & Triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 11. Enable Realtime (Idempotent)
DO $$
BEGIN
    -- This section ensures the publication exists and tables are added.
    -- Note: This is an example approach, some Supabase environments handle this differently.
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add tables safely
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
