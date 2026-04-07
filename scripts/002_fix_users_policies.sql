-- Fix infinite recursion in users table policies
-- Drop existing policies that may cause recursion
DROP POLICY IF EXISTS "authenticated_can_view_users" ON public.users;
DROP POLICY IF EXISTS "authenticated_can_manage_own_user" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

-- Recreate safe policies that avoid recursion
CREATE POLICY "authenticated_can_view_users" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_manage_own_user" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Allow insert for authenticated users (needed for auth triggers)
CREATE POLICY "authenticated_can_insert_users" ON public.users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow delete for own user or admin (but to avoid recursion, simplify)
CREATE POLICY "authenticated_can_delete_own_user" ON public.users
  FOR DELETE USING (auth.uid() = id);