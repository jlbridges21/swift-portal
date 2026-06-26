-- Swift Portal Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE user_role AS ENUM ('admin', 'client');
CREATE TYPE project_status AS ENUM (
  'lead_received',
  'scheduled',
  'shot_complete',
  'editing',
  'ready_for_review',
  'awaiting_payment',
  'delivered'
);
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'cancelled');
CREATE TYPE media_type AS ENUM ('photo', 'video', 'document');
CREATE TYPE activity_type AS ENUM (
  'lead_created',
  'project_created',
  'status_updated',
  'media_uploaded',
  'payment_requested',
  'payment_completed',
  'revision_requested'
);
CREATE TYPE revision_status AS ENUM ('pending', 'in_progress', 'completed');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'client',
  client_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key from profiles to clients
ALTER TABLE profiles ADD CONSTRAINT profiles_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  property_address TEXT NOT NULL,
  service_requested TEXT NOT NULL,
  preferred_date DATE,
  notes TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  property_address TEXT NOT NULL,
  project_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  shoot_date DATE,
  delivery_date DATE,
  status project_status NOT NULL DEFAULT 'lead_received',
  notes TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Media Assets
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT NOT NULL,
  media_type media_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 360 Tours
CREATE TABLE tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tour_name TEXT NOT NULL,
  thumbnail_url TEXT,
  kuula_url TEXT NOT NULL,
  embed_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  due_date DATE,
  status payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_link_id TEXT,
  stripe_payment_link_url TEXT,
  stripe_checkout_session_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Revisions
CREATE TABLE revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status revision_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_type activity_type NOT NULL,
  description TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_client_id ON profiles(client_id);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_is_read ON leads(is_read);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_media_assets_project_id ON media_assets(project_id);
CREATE INDEX idx_media_assets_media_type ON media_assets(media_type);
CREATE INDEX idx_tours_project_id ON tours(project_id);
CREATE INDEX idx_payments_project_id ON payments(project_id);
CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_revisions_project_id ON revisions(project_id);
CREATE INDEX idx_revisions_client_id ON revisions(client_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_project_id ON activity_logs(project_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER revisions_updated_at BEFORE UPDATE ON revisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::public.user_role
      ELSE 'client'::public.user_role
    END
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get client_id for current user
CREATE OR REPLACE FUNCTION get_user_client_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT client_id FROM profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (is_admin() OR auth.uid() = id);
CREATE POLICY "Auth service can insert profiles" ON profiles
  FOR INSERT TO supabase_auth_admin
  WITH CHECK (true);

-- Clients policies
CREATE POLICY "Admins full access clients" ON clients
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own record" ON clients
  FOR SELECT USING (id = get_user_client_id());

-- Leads policies (public insert, admin read/update)
CREATE POLICY "Anyone can create leads" ON leads
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view leads" ON leads
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update leads" ON leads
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete leads" ON leads
  FOR DELETE USING (is_admin());

-- Projects policies
CREATE POLICY "Admins full access projects" ON projects
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own projects" ON projects
  FOR SELECT USING (client_id = get_user_client_id());

-- Media assets policies
CREATE POLICY "Admins full access media" ON media_assets
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own media" ON media_assets
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id = get_user_client_id()
    )
  );

-- Tours policies
CREATE POLICY "Admins full access tours" ON tours
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own tours" ON tours
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id = get_user_client_id()
    )
  );

-- Payments policies
CREATE POLICY "Admins full access payments" ON payments
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own payments" ON payments
  FOR SELECT USING (client_id = get_user_client_id());

-- Revisions policies
CREATE POLICY "Admins full access revisions" ON revisions
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own revisions" ON revisions
  FOR SELECT USING (client_id = get_user_client_id());
CREATE POLICY "Clients create revisions" ON revisions
  FOR INSERT WITH CHECK (client_id = get_user_client_id());

-- Activity logs policies
CREATE POLICY "Admins view all activity" ON activity_logs
  FOR SELECT USING (is_admin());
CREATE POLICY "Clients view own activity" ON activity_logs
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id = get_user_client_id()
    )
  );
CREATE POLICY "Authenticated users can log activity" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('project-media', 'project-media', false, 524288000, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('project-documents', 'project-documents', false, 104857600, ARRAY['application/pdf', 'application/zip', 'application/x-zip-compressed']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Avatar storage policies
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Storage policies (project media)
CREATE POLICY "Admins can upload media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('project-media', 'project-documents') AND is_admin()
  );
CREATE POLICY "Admins can update media" ON storage.objects
  FOR UPDATE USING (
    bucket_id IN ('project-media', 'project-documents') AND is_admin()
  );
CREATE POLICY "Admins can delete media" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('project-media', 'project-documents') AND is_admin()
  );
CREATE POLICY "Admins can view all media" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('project-media', 'project-documents') AND is_admin()
  );
CREATE POLICY "Clients can view own media files" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('project-media', 'project-documents') AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM projects WHERE client_id = get_user_client_id()
    )
  );
