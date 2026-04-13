-- ============================================================================
-- ComissãoPro — Phase 0 + Phase 1 hardening
-- Aplicado em produção em 2026-04-11 via Supabase Management API
-- ============================================================================
--
-- Contexto: a auditoria de 2026-04-10 encontrou:
--   1. Vazamento ativo de PII (CPFs) via REST anon — 3 policies USING(true)
--   2. Privilege escalation: AuthProvider auto-cria profile com role='admin'
--   3. Trigger handle_new_user() ausente em produção (presente no schema.sql)
--   4. Validações de soma de % frouxas (aceita < 100%)
--   5. Signups Supabase abertos
--
-- Este arquivo é a migration que reproduz exatamente o que foi rodado.
-- ============================================================================


-- ─── BLOCO 0: trigger handle_new_user (estava ausente em prod) ─────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'consultant'::user_role  -- IMPORTANTE: novos usuários são consultor por padrão
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── BLOCO 1: fechar SELECT policies que vazavam (USING true) ───────────────

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (id = auth.uid() OR is_admin_or_manager());

DROP POLICY IF EXISTS participants_select ON public.participants;
CREATE POLICY participants_select ON public.participants
  FOR SELECT USING (
    is_admin_or_manager()
    OR email = (auth.email())::text
  );

DROP POLICY IF EXISTS commission_rules_select ON public.commission_rules;
CREATE POLICY commission_rules_select ON public.commission_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- ─── BLOCO 2: fechar privilege escalation no insert de profiles ─────────────

DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT WITH CHECK (is_admin_or_manager());


-- ─── BLOCO 3: defesa em profundidade — REVOKE no role anon ─────────────────

REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.participants FROM anon;
REVOKE ALL ON public.commission_rules FROM anon;
REVOKE ALL ON public.v_participant_earnings FROM anon;
REVOKE ALL ON public.v_operation_summary FROM anon;
REVOKE ALL ON public.v_monthly_commissions FROM anon;
REVOKE ALL ON public.v_future_flow FROM anon;


-- ─── BLOCO 5: validação estrita de soma de % (Phase 1) ─────────────────────

-- Trigger BEFORE UPDATE em operations: bloqueia ativação se participantes
-- não somam exatamente 100%
CREATE OR REPLACE FUNCTION public.validate_operation_shares_complete()
RETURNS TRIGGER AS $$
DECLARE
  total_share NUMERIC;
BEGIN
  IF NEW.status IN ('active','completed') AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    SELECT COALESCE(SUM(percentage_share), 0)
    INTO total_share
    FROM operation_participants
    WHERE operation_id = NEW.id;

    IF ABS(total_share - 1.0) > 0.0001 THEN
      RAISE EXCEPTION 'Operação % não pode ser ativada: soma das fatias dos participantes é %, deve ser 100%%.',
        NEW.code, ROUND(total_share * 100, 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_operation_shares_complete ON public.operations;
CREATE TRIGGER trg_validate_operation_shares_complete
  BEFORE UPDATE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.validate_operation_shares_complete();

-- Constraint trigger DEFERRED: valida soma das parcelas após o batch insert
CREATE OR REPLACE FUNCTION public.validate_installment_credit_sum_row()
RETURNS TRIGGER AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(percentage_of_credit), 0)
  INTO total
  FROM commission_installments
  WHERE operation_id = NEW.operation_id;

  IF ABS(total - 1.0) > 0.0001 THEN
    RAISE EXCEPTION 'Soma de percentage_of_credit das parcelas é %, deve ser 100%%.',
      ROUND(total * 100, 4);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_installment_credit_sum ON public.commission_installments;
CREATE CONSTRAINT TRIGGER trg_validate_installment_credit_sum
  AFTER INSERT ON public.commission_installments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.validate_installment_credit_sum_row();


-- ─── Auth config aplicado fora deste SQL via Management API ─────────────────
-- PATCH /v1/projects/{ref}/config/auth  { "disable_signup": true }
