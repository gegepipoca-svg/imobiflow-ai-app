-- ─────────────────────────────────────────────────────────────────────────────
-- Permite consultor (role='consultant') cadastrar venda e confirmar recebimento
-- da PRÓPRIA comissão sem afrouxar o controle das demais ações.
--
-- Aplicado em prod 2026-05-02 via Management API após Thalles relatar que só
-- conseguia consultar, não conseguia movimentar nada (Opção B "granular").
--
-- Cobertura:
--   1) Consultor cadastra venda → via RPC create_operation_with_distributions
--      (já SECURITY DEFINER, GRANT EXECUTE pra authenticated).
--      Adiciona SET search_path nas 3 RPCs SECURITY DEFINER pra evitar o bug
--      "type X does not exist" que matou handle_new_user em 2026-05-01.
--   2) Consultor confirma pagamento próprio → INSERT em payments + UPDATE em
--      commission_distributions.status. Policies relaxam pra distribuição onde
--      o consultor é participant. Trigger BEFORE UPDATE garante que consultor
--      só pode mudar o campo `status` (jamais value, paid_amount, percentage_share).
--      Bypassa em chamadas de triggers encadeados (pg_trigger_depth > 1) pra não
--      bloquear o trigger update_distribution_after_payment legítimo que mantém
--      paid_amount em sync após INSERT em payments.
--
-- Não afrouxa:
--   - operations_*, operation_participants_*, commission_installments_*
--   - payments_update, payments_delete (consultor não edita/deleta pagamento)
--   - admin/manager continuam com CRUD total
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1) Fix search_path em RPCs SECURITY DEFINER (preventivo) ────────────
ALTER FUNCTION public.create_operation_with_distributions(jsonb)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.reverse_operation(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin_or_manager()
  SET search_path = public, pg_temp;

-- ─── 2) INSERT em payments: admin OU dono da distribuição ────────────────
DROP POLICY IF EXISTS payments_insert ON public.payments;
CREATE POLICY payments_insert ON public.payments
  FOR INSERT
  WITH CHECK (
    public.is_admin_or_manager()
    OR distribution_id IN (
      SELECT cd.id
      FROM public.commission_distributions cd
      JOIN public.participants p ON p.id = cd.participant_id
      WHERE p.email = auth.email()
    )
  );

-- ─── 3) UPDATE em commission_distributions: admin OU dono ────────────────
DROP POLICY IF EXISTS distributions_update ON public.commission_distributions;
CREATE POLICY distributions_update ON public.commission_distributions
  FOR UPDATE
  USING (
    public.is_admin_or_manager()
    OR participant_id IN (
      SELECT id FROM public.participants WHERE email = auth.email()
    )
  )
  WITH CHECK (
    public.is_admin_or_manager()
    OR participant_id IN (
      SELECT id FROM public.participants WHERE email = auth.email()
    )
  );

-- ─── 4) Trigger guard: não-admin só pode mudar status ────────────────────
CREATE OR REPLACE FUNCTION public.guard_distribution_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
BEGIN
  -- Updates encadeados (ex: trigger update_distribution_after_payment) passam
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF public.is_admin_or_manager() THEN
    RETURN NEW;
  END IF;
  IF NEW.installment_id IS DISTINCT FROM OLD.installment_id
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.operation_participant_id IS DISTINCT FROM OLD.operation_participant_id
     OR NEW.percentage_share IS DISTINCT FROM OLD.percentage_share
     OR NEW.value IS DISTINCT FROM OLD.value
     OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
    RAISE EXCEPTION 'Consultor só pode alterar o campo status da distribuição'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$func$;

DROP TRIGGER IF EXISTS trg_guard_distribution_update ON public.commission_distributions;
CREATE TRIGGER trg_guard_distribution_update
  BEFORE UPDATE ON public.commission_distributions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_distribution_update();
