-- 1. Create Custom Types
CREATE TYPE user_role AS ENUM ('master', 'admin', 'user');
CREATE TYPE task_status AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'SUBMITTED');
CREATE TYPE task_type AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ONETIME');

-- 2. Create Users Table
-- Note: In Supabase, usually users are managed via auth.users, 
-- but we create a public.users table to store profile info and custom roles.
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role DEFAULT 'user' NOT NULL,
    teams TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Projects Table
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Teams Table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Tags Table
CREATE TABLE public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Tasks Table
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id), -- Creator
    tag_id UUID REFERENCES public.tags(id),
    project_id UUID REFERENCES public.projects(id),
    team_id UUID REFERENCES public.teams(id),
    type task_type DEFAULT 'ONETIME' NOT NULL,
    deadline_time TIME, -- Changed from TEXT to TIME
    deadline_days TEXT[], -- For WEEKLY: ['Mon', 'Tue']
    deadline_date DATE, -- For ONETIME
    deadline_day_num INTEGER, -- For MONTHLY
    estimated_minutes INTEGER DEFAULT 0,
    actual_minutes INTEGER DEFAULT 0,
    status task_status DEFAULT 'NEW' NOT NULL,
    subtasks JSONB DEFAULT '[]'::jsonb, -- Integrated steps/subtasks
    assignees TEXT[] DEFAULT '{}', -- Array of user emails for easy filtering
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create Audit Logs Table
CREATE TABLE public.audit_logs (
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
CREATE POLICY "Master/Admin manage all users" ON public.users
FOR ALL USING (
  (SELECT public.get_current_user_role()) IN ('master', 'admin')
);

CREATE POLICY "Users can see all other users" ON public.users
FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.users
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can edit their own profile" ON public.users
FOR UPDATE USING (auth.uid() = id);

-- Functions & Triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_modtime BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
