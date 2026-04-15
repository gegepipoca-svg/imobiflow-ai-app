-- ============================================================================
-- ComissãoPro — Fix: parcelas calculadas com base errada
-- Aplicado em produção em 2026-04-14
-- ============================================================================
--
-- Bug encontrado: a RPC create_operation_with_distributions calculava
-- cada parcela como:
--   v_installment_value := commission_total * percentage_of_credit
--
-- Mas percentage_of_credit representa a FRAÇÃO DO CRÉDITO que aquela
-- parcela paga, não a fração da comissão. O cálculo correto é:
--   v_installment_value := credit_value * percentage_of_credit
--
-- Exemplo concreto (operação OP-2604-5024):
--   credit_value = 400.000, commission_model = 1.25%, commission_total = 5.000
--   Parcela 1 (percentage_of_credit = 0.5%):
--     ERRADO: 5.000 * 0.005 = R$ 25
--     CORRETO: 400.000 * 0.005 = R$ 2.000
--
-- Além da RPC, este script:
--   1. Corrige commission_installments.value das operações já criadas
--   2. Recalcula commission_distributions.value com base nas parcelas
-- ============================================================================


-- ─── BLOCO 1: RPC corrigida (usa credit_value em vez de commission_total) ──

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

  FOR v_participant IN SELECT * FROM jsonb_array_elements(params->'participants') LOOP
    v_total_share := v_total_share + (v_participant->>'percentage_share')::NUMERIC;
  END LOOP;
  IF ABS(v_total_share - 1.0) > 0.0001 THEN
    RAISE EXCEPTION 'Soma das fatias dos participantes é %, deve ser 100%%', ROUND(v_total_share * 100, 2);
  END IF;

  FOR v_installment IN SELECT * FROM jsonb_array_elements(params->'installments') LOOP
    v_total_pct := v_total_pct + (v_installment->>'percentage_of_credit')::NUMERIC;
  END LOOP;
  IF ABS(v_total_pct - v_commission_model) > 0.0001 THEN
    RAISE EXCEPTION 'Soma das parcelas é %, deve ser igual ao modelo de comissão (%).',
      ROUND(v_total_pct * 100, 4), ROUND(v_commission_model * 100, 4);
  END IF;

  v_commission_total := v_credit_value * v_commission_model;
  v_operation_code := COALESCE(NULLIF(params->>'code', ''), generate_operation_code());

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

  FOR v_installment IN SELECT * FROM jsonb_array_elements(params->'installments') LOOP
    -- FIX: usa credit_value, não commission_total
    v_installment_value := ROUND(v_credit_value * (v_installment->>'percentage_of_credit')::NUMERIC, 2);

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


-- ─── BLOCO 2: backfill dos dados existentes ─────────────────────────────────

-- Recalcular value das parcelas já criadas com base no credit_value
UPDATE commission_installments
SET value = ROUND(o.credit_value * commission_installments.percentage_of_credit, 2)
FROM operations o
WHERE commission_installments.operation_id = o.id;

-- Recalcular value das distribuições com base nas parcelas corrigidas
UPDATE commission_distributions
SET value = ROUND(i.value * commission_distributions.percentage_share, 2)
FROM commission_installments i
WHERE commission_distributions.installment_id = i.id;
