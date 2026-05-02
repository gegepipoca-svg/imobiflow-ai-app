-- ─────────────────────────────────────────────────────────────────────────────
-- Fix definitivo: consultor cadastra venda via RPC create_operation_with_distributions
--
-- Descoberta após auditoria com 5 agents (debugger, security-auditor,
-- frontend-developer, backend-architect, Explore):
--
-- A RPC create_operation_with_distributions é SECURITY DEFINER (owner postgres
-- com BYPASSRLS), MAS o Postgres NÃO bypassa RLS automaticamente em
-- SECURITY DEFINER quando o caller é authenticated/anon — RLS continua sendo
-- avaliada no contexto da role chamadora. Logo, INSERT dentro da RPC era
-- bloqueado por:
--   operations_insert            WITH CHECK is_admin_or_manager()
--   op_participants_insert       WITH CHECK is_admin_or_manager()
--   installments_insert          WITH CHECK is_admin_or_manager()
--   distributions_insert         WITH CHECK is_admin_or_manager()
--
-- Resultado: 42501 dentro da RPC, frontend mostrava "Erro ao criar operação"
-- com toast genérico — Thalles ficou em looping sem entender a causa.
--
-- Tentativa A (rejeitada): PERFORM set_config('row_security','off',true) na
-- RPC. Falhou: o role authenticated não tem privilégio pra desligar row_security.
--
-- Solução: ajustar policies INSERT pra aceitar admin OU criador legítimo da
-- operação. Validação de integridade já vem da RPC (soma 100% dos shares,
-- soma das parcelas = commission_model, etc) — RLS só precisa garantir que
-- o caller é o dono.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── operations: admin OU created_by = auth.uid() ────────────────────────
DROP POLICY IF EXISTS operations_insert ON public.operations;
CREATE POLICY operations_insert ON public.operations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR created_by = auth.uid()
  );

-- ─── operation_participants: admin OU criador da operação ────────────────
DROP POLICY IF EXISTS op_participants_insert ON public.operation_participants;
CREATE POLICY op_participants_insert ON public.operation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR public.is_creator_of_op(operation_id)
  );

-- ─── commission_installments: admin OU criador da operação ────────────────
DROP POLICY IF EXISTS installments_insert ON public.commission_installments;
CREATE POLICY installments_insert ON public.commission_installments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR public.is_creator_of_op(operation_id)
  );

-- ─── commission_distributions: admin OU criador via installment → op ─────
DROP POLICY IF EXISTS distributions_insert ON public.commission_distributions;
CREATE POLICY distributions_insert ON public.commission_distributions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1 FROM public.commission_installments ci
      WHERE ci.id = installment_id
        AND public.is_creator_of_op(ci.operation_id)
    )
  );

-- ─── Hardening adicional: get_user_role com search_path ───────────────────
ALTER FUNCTION public.get_user_role() SET search_path = public, pg_temp;

-- ─── Adicionar SET search_path na RPC (consistência com outras) ──────────
ALTER FUNCTION public.create_operation_with_distributions(jsonb)
  SET search_path = public, pg_temp;
