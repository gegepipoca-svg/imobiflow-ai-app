-- ─────────────────────────────────────────────────────────────────────────────
-- Complementa 20260502_consultor_can_register_and_record_payments.sql
--
-- Problemas remanescentes após a migration anterior:
--   (a) Consultor só via 1 participant (ele mesmo) → não conseguia selecionar
--       outro consultor pra dividir comissão na hora de cadastrar venda.
--   (b) Após criar operação via RPC, o frontend faz SELECT da row criada.
--       Esse SELECT batia em RLS pq operations_select_admin exige admin e
--       operations_select_participant exige que o caller seja participant.
--       Quando o consultor cadastra venda pra outro consultor (ele mesmo
--       não entra em operation_participants), nenhuma das policies passava
--       e o frontend devolvia "not found" mesmo a operação tendo sido criada.
--
-- Fix:
--   1) participants_select libera todos authenticated verem todos participants
--      (anon segue REVOKE'd da tabela via hardening Fase 0). Risco baixo no
--      contexto de equipe interna; CPF não é exposto a externos.
--   2) Nova policy operations_select_creator: created_by = auth.uid().
--   3) Idem em commission_installments, commission_distributions e
--      operation_participants — usando função SECURITY DEFINER
--      is_creator_of_op() pra evitar recursão entre policies (RLS infinita
--      detectada quando policies subordinadas re-faziam SELECT em operations).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helper: bypassa RLS no check (evita recursão entre policies) ──────────
CREATE OR REPLACE FUNCTION public.is_creator_of_op(p_op_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operations
    WHERE id = p_op_id AND created_by = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_creator_of_op(uuid) TO authenticated;

-- ─── 1) Participants visíveis a qualquer authenticated ─────────────────────
DROP POLICY IF EXISTS participants_select ON public.participants;
CREATE POLICY participants_select ON public.participants
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── 2) Operations: quem criou também consegue ler ─────────────────────────
DROP POLICY IF EXISTS operations_select_creator ON public.operations;
CREATE POLICY operations_select_creator ON public.operations
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- ─── 3) commission_installments visíveis ao creator da op ──────────────────
DROP POLICY IF EXISTS installments_select_creator ON public.commission_installments;
CREATE POLICY installments_select_creator ON public.commission_installments
  FOR SELECT
  TO authenticated
  USING (public.is_creator_of_op(operation_id));

-- ─── 4) commission_distributions visíveis ao creator da op ─────────────────
DROP POLICY IF EXISTS distributions_select_creator ON public.commission_distributions;
CREATE POLICY distributions_select_creator ON public.commission_distributions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commission_installments ci
      WHERE ci.id = installment_id
        AND public.is_creator_of_op(ci.operation_id)
    )
  );

-- ─── 5) operation_participants visíveis ao creator da op ───────────────────
DROP POLICY IF EXISTS op_participants_select_creator ON public.operation_participants;
CREATE POLICY op_participants_select_creator ON public.operation_participants
  FOR SELECT
  TO authenticated
  USING (public.is_creator_of_op(operation_id));
