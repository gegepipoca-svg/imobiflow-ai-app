-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: handle_new_user() falhava com "type user_role does not exist"
-- ao ser disparado pelo GoTrue (supabase_auth_admin) durante auth.admin.createUser
--
-- Causa: função SECURITY DEFINER sem SET search_path → cast 'consultant'::user_role
-- não resolve o tipo (vive em public) quando search_path do role do auth está enxuto
--
-- Aplicado em prod 2026-05-01 via Management API após bloqueio total de criação
-- de usuários (admin não conseguia criar consultor pela UI).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'consultant'::public.user_role
  );
  RETURN NEW;
END;
$func$;
