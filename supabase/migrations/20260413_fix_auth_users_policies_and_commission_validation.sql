-- ============================================================================
-- ComissãoPro — Fix: policies quebradas + validação de parcelas
-- Aplicado em produção em 2026-04-13
-- ============================================================================
--
-- Bugs encontrados após o hardening:
--
-- 1. "permission denied for table users"
--    5 policies referenciavam (SELECT email FROM auth.users WHERE id = auth.uid())
--    mas o role `authenticated` não tem permissão em auth.users.
--    Isso quebrava SELECT em participants, operations, installments,
--    distributions e payments toda vez que um consultor logava.
--
-- 2. "Soma das parcelas é 1.25, deve ser 100%"
--    A RPC create_operation_with_distributions e o trigger
--    validate_installment_credit_sum_row esperavam que a soma de
--    percentage_of_credit fosse 1.0 (100%), mas esses valores representam
--    a fração do CRÉDITO que vai pra cada parcela, não a fração da
--    comissão. A soma correta é igual ao commission_model da regra.
--
-- Fix: trocar `(SELECT email FROM auth.users WHERE id = auth.uid())` por
-- `auth.email()` (built-in que não precisa de permissão em auth.users) e
-- corrigir a validação de soma pra comparar com commission_model.
-- ============================================================================


-- ─── BLOCO 1: policies que precisavam do email do usuário autenticado ──────

DROP POLICY IF EXISTS distributions_select_own ON public.commission_distributions;
CREATE POLICY distributions_select_own ON public.commission_distributions
  FOR SELECT USING (
    participant_id IN (
      SELECT p.id FROM participants p WHERE p.email = auth.email()
    )
  );

DROP POLICY IF EXISTS installments_select_participant ON public.commission_installments;
CREATE POLICY installments_select_participant ON public.commission_installments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM operation_participants op
      JOIN participants p ON p.id = op.participant_id
      WHERE op.operation_id = commission_installments.operation_id
        AND p.email = auth.email()
    )
  );

DROP POLICY IF EXISTS op_participants_select_own ON public.operation_participants;
CREATE POLICY op_participants_select_own ON public.operation_participants
  FOR SELECT USING (
    participant_id IN (
      SELECT p.id FROM participants p WHERE p.email = auth.email()
    )
  );

DROP POLICY IF EXISTS operations_select_participant ON public.operations;
CREATE POLICY operations_select_participant ON public.operations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM operation_participants op
      JOIN participants p ON p.id = op.participant_id
      WHERE op.operation_id = operations.id
        AND p.email = auth.email()
    )
  );

DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT USING (
    distribution_id IN (
      SELECT cd.id FROM commission_distributions cd
      JOIN participants p ON p.id = cd.participant_id
      WHERE p.email = auth.email()
    )
  );


-- ─── BLOCO 2: validação de soma das parcelas (contra commission_model) ─────

-- Trigger DEFERRED em commission_installments: soma deve ser igual
-- ao commission_model da operação (não 1.0 como o hardening assumia)
CREATE OR REPLACE FUNCTION public.validate_installment_credit_sum_row()
RETURNS TRIGGER AS $$
DECLARE
  total NUMERIC;
  expected NUMERIC;
BEGIN
  SELECT COALESCE(SUM(percentage_of_credit), 0)
  INTO total
  FROM commission_installments
  WHERE operation_id = NEW.operation_id;

  SELECT commission_model INTO expected
  FROM operations
  WHERE id = NEW.operation_id;

  IF ABS(total - expected) > 0.0001 THEN
    RAISE EXCEPTION 'Soma das parcelas é %, deve ser igual ao modelo de comissão (%).',
      ROUND(total * 100, 4), ROUND(expected * 100, 4);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;


-- ─── BLOCO 3: RPC create_operation_with_distributions ──────────────────────

-- Mesma correção na validação da RPC: comparar com commission_model
-- em vez de 1.0
CREATE OR REPLACE FUNCTION public.create_operation_with_distributions(params JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_operation_id       UUID;
  v_operation_code     TEXT;
  v_credit_value       NUMERIC;
  v_commission_model   NUMERIC;
  v_commission_total   NUMERIC;
  v_participant        JSONB;
  v_installment        JSONB;
  v_op_participant_id  UUID;
  v_installment_id     UUID;
  v_installment_value  NUMERIC;
  v_dist_value         NUMERIC;
  v_participant_map    JSONB := '{}'::JSONB;
  v_total_share        NUMERIC := 0;
  v_total_pct          NUMERIC := 0;
BEGIN
  v_credit_value     := (params->>'credit_value')::NUMERIC;
  v_commission_model := (params->>'commission_model')::NUMERIC;

  IF v_credit_value IS NULL OR v_credit_value <= 0 THEN
    RAISE EXCEPTION 'credit_value deve ser positivo (recebido: %)', v_credit_value;
  END IF;
  IF v_commission_model IS NULL OR v_commission_model <= 0 OR v_commission_model > 1 THEN
    RAISE EXCEPTION 'commission_model deve estar entre 0 e 1 (recebido: %)', v_commission_model;
  END IF;

  -- Validar soma dos participantes (deve ser 100%)
  FOR v_participant IN SELECT * FROM jsonb_array_elements(params->'participants') LOOP
    v_total_share := v_total_share + (v_participant->>'percentage_share')::NUMERIC;
  END LOOP;
  IF ABS(v_total_share - 1.0) > 0.0001 THEN
    RAISE EXCEPTION 'Soma das fatias dos participantes é %, deve ser 100%%', ROUND(v_total_share * 100, 2);
  END IF;

  -- Validar soma das parcelas (deve ser igual ao commission_model)
  FOR v_installment IN SELECT * FROM jsonb_array_elements(params->'installments') LOOP
    v_total_pct := v_total_pct + (v_installment->>'percentage_of_credit')::NUMERIC;
  END LOOP;
  IF ABS(v_total_pct - v_commission_model) > 0.0001 THEN
    RAISE EXCEPTION 'Soma das parcelas é %, deve ser igual ao modelo de comissão (%).',
      ROUND(v_total_pct * 100, 4), ROUND(v_commission_model * 100, 4);
  END IF;

  v_commission_total := v_credit_value * v_commission_model;
  v_operation_code := COALESCE(NULLIF(params->>'code', ''), generate_operation_code());

  -- 1. Inserir operação
  INSERT INTO operations (
    code, description, credit_value, commission_model,
    product_type, commission_rule_id, status, operation_date, notes,
    client_name, client_paid, created_by
  ) VALUES (
    v_operation_code,
    params->>'description',
    v_credit_value,
    v_commission_model,
    (params->>'product_type')::product_type,
    NULLIF(params->>'commission_rule_id','')::UUID,
    COALESCE((params->>'status')::operation_status, 'draft'),
    COALESCE(NULLIF(params->>'operation_date','')::DATE, CURRENT_DATE),
    NULLIF(params->>'notes',''),
    NULLIF(params->>'client_name',''),
    COALESCE((params->>'client_paid')::BOOLEAN, false),
    auth.uid()
  )
  RETURNING id INTO v_operation_id;

  -- 2. Participantes
  FOR v_participant IN SELECT * FROM jsonb_array_elements(params->'participants') LOOP
    INSERT INTO operation_participants (
      operation_id, participant_id, percentage_share, role_in_operation, is_override
    ) VALUES (
      v_operation_id,
      (v_participant->>'participant_id')::UUID,
      (v_participant->>'percentage_share')::NUMERIC,
      v_participant->>'role_in_operation',
      COALESCE((v_participant->>'is_override')::BOOLEAN, false)
    )
    RETURNING id INTO v_op_participant_id;

    v_participant_map := v_participant_map || jsonb_build_object(
      v_participant->>'participant_id', v_op_participant_id
    );
  END LOOP;

  -- 3. Parcelas + distribuições
  FOR v_installment IN SELECT * FROM jsonb_array_elements(params->'installments') LOOP
    v_installment_value := ROUND(v_commission_total * (v_installment->>'percentage_of_credit')::NUMERIC, 2);

    INSERT INTO commission_installments (
      operation_id, installment_number, percentage_of_credit, value, due_date
    ) VALUES (
      v_operation_id,
      (v_installment->>'number')::INTEGER,
      (v_installment->>'percentage_of_credit')::NUMERIC,
      v_installment_value,
      NULLIF(v_installment->>'due_date','')::DATE
    )
    RETURNING id INTO v_installment_id;

    FOR v_participant IN SELECT * FROM jsonb_array_elements(params->'participants') LOOP
      v_dist_value := ROUND(v_installment_value * (v_participant->>'percentage_share')::NUMERIC, 2);

      INSERT INTO commission_distributions (
        installment_id, participant_id, operation_participant_id,
        percentage_share, value
      ) VALUES (
        v_installment_id,
        (v_participant->>'participant_id')::UUID,
        (v_participant_map->>(v_participant->>'participant_id'))::UUID,
        (v_participant->>'percentage_share')::NUMERIC,
        v_dist_value
      );
    END LOOP;
  END LOOP;

  RETURN v_operation_id;
END;
$fn$;
