-- ─────────────────────────────────────────────────────────────────────────────
-- user_commission_rules — junction que limita quais regras um consultor vê
-- Admin/manager continuam vendo todas (não precisa de linha nessa tabela)
-- Aplicada em prod 2026-04-27 via MCP apply_migration
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_commission_rules (
  user_id    UUID NOT NULL REFERENCES public.profiles(id)         ON DELETE CASCADE,
  rule_id    UUID NOT NULL REFERENCES public.commission_rules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_user_commission_rules_user
  ON public.user_commission_rules (user_id);

CREATE INDEX IF NOT EXISTS idx_user_commission_rules_rule
  ON public.user_commission_rules (rule_id);

COMMENT ON TABLE public.user_commission_rules IS
  'Regras de comissão visíveis para um consultor/parceiro. Admin/manager ignora isso e vê todas.';

ALTER TABLE public.user_commission_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_commission_rules FROM anon;

-- ─── Policies user_commission_rules ────────────────────────────────────────
DROP POLICY IF EXISTS user_commission_rules_select ON public.user_commission_rules;
DROP POLICY IF EXISTS user_commission_rules_insert ON public.user_commission_rules;
DROP POLICY IF EXISTS user_commission_rules_delete ON public.user_commission_rules;

CREATE POLICY user_commission_rules_select ON public.user_commission_rules
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_admin_or_manager()
  );

CREATE POLICY user_commission_rules_insert ON public.user_commission_rules
  FOR INSERT
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY user_commission_rules_delete ON public.user_commission_rules
  FOR DELETE
  USING (public.is_admin_or_manager());

-- ─── Reescreve commission_rules_select com filtro por consultor ────────────
DROP POLICY IF EXISTS commission_rules_select ON public.commission_rules;

CREATE POLICY commission_rules_select ON public.commission_rules
  FOR SELECT
  USING (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1
      FROM public.user_commission_rules ucr
      WHERE ucr.user_id = auth.uid()
        AND ucr.rule_id = public.commission_rules.id
    )
  );

-- ─── RPC atômica pra reescrever associações de um usuário ──────────────────
CREATE OR REPLACE FUNCTION public.set_user_commission_rules(
  p_user_id  UUID,
  p_rule_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar regras de comissão de usuários'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_commission_rules WHERE user_id = p_user_id;

  IF p_rule_ids IS NOT NULL AND array_length(p_rule_ids, 1) > 0 THEN
    INSERT INTO public.user_commission_rules (user_id, rule_id, created_by)
    SELECT p_user_id, unnest(p_rule_ids), auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_commission_rules(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_commission_rules(UUID, UUID[]) TO authenticated;
