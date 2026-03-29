-- ============================================================================
-- IMOBIFLOW AI — Schema Completo do Sistema de Gestão de Comissões
-- Pronto para executar no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. TIPOS PERSONALIZADOS (ENUMs)
-- ============================================================================

-- Tipo de participante na operação
CREATE TYPE participant_type AS ENUM (
  'consultant',   -- Consultor / corretor
  'partner',      -- Parceiro externo
  'office',       -- Escritório / imobiliária
  'intermediary'  -- Intermediário
);

-- Tipo de produto da operação
CREATE TYPE product_type AS ENUM (
  'imovel',   -- Imóvel
  'auto',     -- Automóvel / consórcio auto
  'servico',  -- Serviço
  'outros'    -- Outros
);

-- Status da operação
CREATE TYPE operation_status AS ENUM (
  'draft',      -- Rascunho
  'active',     -- Ativa
  'completed',  -- Concluída
  'cancelled',  -- Cancelada
  'reversed'    -- Estornada
);

-- Status da parcela de comissão
CREATE TYPE installment_status AS ENUM (
  'pending',   -- Pendente
  'partial',   -- Parcialmente paga
  'paid',      -- Paga
  'reversed'   -- Estornada
);

-- Status da distribuição ao participante
CREATE TYPE distribution_status AS ENUM (
  'pending',   -- Pendente
  'partial',   -- Parcialmente paga
  'paid',      -- Paga
  'reversed'   -- Estornada
);

-- Método de pagamento
CREATE TYPE payment_method AS ENUM (
  'pix',       -- PIX
  'transfer',  -- Transferência bancária
  'cash',      -- Dinheiro
  'check',     -- Cheque
  'other'      -- Outro
);

-- Papel do usuário no sistema
CREATE TYPE user_role AS ENUM (
  'admin',       -- Administrador
  'manager',     -- Gerente
  'consultant',  -- Consultor
  'partner'      -- Parceiro
);


-- ============================================================================
-- 2. TABELAS
-- ============================================================================

-- --------------------------------------------------------------------------
-- profiles — Extensão do auth.users do Supabase
-- --------------------------------------------------------------------------
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  role       user_role DEFAULT 'consultant',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Perfis de usuários do sistema, estende auth.users';

-- --------------------------------------------------------------------------
-- participants — Participantes de operações (consultores, parceiros, etc.)
-- --------------------------------------------------------------------------
CREATE TABLE participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  document   TEXT,                                        -- CPF ou CNPJ
  type       participant_type NOT NULL,
  email      TEXT,
  phone      TEXT,
  parent_id  UUID REFERENCES participants(id),            -- Hierarquia multinível
  is_active  BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE participants IS 'Participantes das operações de comissão (consultores, parceiros, escritórios, intermediários)';
COMMENT ON COLUMN participants.parent_id IS 'Referência ao participante pai para hierarquia multinível (ex: consultor → escritório)';

-- --------------------------------------------------------------------------
-- commission_rules — Regras de comissão por tipo de produto
-- --------------------------------------------------------------------------
CREATE TABLE commission_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  product_type     product_type NOT NULL,
  commission_model NUMERIC(5,4) NOT NULL,                 -- Percentual decimal (ex: 0.1500 = 15%)
  installments     JSONB NOT NULL,                        -- Array de {number, percentage_of_credit}
  is_active        BOOLEAN DEFAULT true,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE commission_rules IS 'Regras de comissão pré-configuradas por tipo de produto';
COMMENT ON COLUMN commission_rules.commission_model IS 'Percentual da comissão em formato decimal (ex: 0.1500 = 15%)';
COMMENT ON COLUMN commission_rules.installments IS 'Array JSON com parcelas: [{number: 1, percentage_of_credit: 0.30}, ...]';

-- --------------------------------------------------------------------------
-- operations — Operações / negócios
-- --------------------------------------------------------------------------
CREATE TABLE operations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT NOT NULL UNIQUE,                -- Código legível ex: OP-2026-001
  description        TEXT,
  credit_value       NUMERIC(14,2) NOT NULL,              -- Valor do crédito / venda
  commission_model   NUMERIC(5,4) NOT NULL,               -- Percentual de comissão
  commission_total   NUMERIC(14,2) GENERATED ALWAYS AS (credit_value * commission_model) STORED,
  product_type       product_type NOT NULL,
  commission_rule_id UUID REFERENCES commission_rules(id),
  status             operation_status DEFAULT 'draft',
  operation_date     DATE DEFAULT CURRENT_DATE,
  notes              TEXT,
  created_by         UUID REFERENCES profiles(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE operations IS 'Operações de venda/negócio que geram comissões';
COMMENT ON COLUMN operations.commission_total IS 'Coluna calculada automaticamente: credit_value * commission_model';

-- --------------------------------------------------------------------------
-- operation_participants — Participantes de cada operação com sua fatia
-- --------------------------------------------------------------------------
CREATE TABLE operation_participants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id     UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  participant_id   UUID NOT NULL REFERENCES participants(id),
  percentage_share NUMERIC(5,4) NOT NULL,                 -- Fatia do participante (ex: 0.5000 = 50%)
  role_in_operation TEXT,                                  -- Papel nesta operação específica
  is_override      BOOLEAN DEFAULT false,                 -- Se é um override (comissão extra de nível)
  created_at       TIMESTAMPTZ DEFAULT now(),

  UNIQUE(operation_id, participant_id)
);

COMMENT ON TABLE operation_participants IS 'Vínculo entre operações e participantes com percentual de participação';
COMMENT ON COLUMN operation_participants.is_override IS 'Indica se é uma comissão de override (nível hierárquico superior)';

-- --------------------------------------------------------------------------
-- commission_installments — Parcelas de comissão por operação
-- --------------------------------------------------------------------------
CREATE TABLE commission_installments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id          UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  installment_number    INTEGER NOT NULL,
  percentage_of_credit  NUMERIC(5,4) NOT NULL,            -- Percentual do crédito nesta parcela
  value                 NUMERIC(14,2) NOT NULL,            -- Valor monetário da parcela
  due_date              DATE,
  status                installment_status DEFAULT 'pending',
  created_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE(operation_id, installment_number)
);

COMMENT ON TABLE commission_installments IS 'Parcelas de comissão de cada operação';

-- --------------------------------------------------------------------------
-- commission_distributions — Distribuição de cada parcela entre participantes
-- --------------------------------------------------------------------------
CREATE TABLE commission_distributions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id           UUID NOT NULL REFERENCES commission_installments(id) ON DELETE CASCADE,
  participant_id           UUID NOT NULL REFERENCES participants(id),
  operation_participant_id UUID NOT NULL REFERENCES operation_participants(id),
  percentage_share         NUMERIC(5,4) NOT NULL,
  value                    NUMERIC(14,2) NOT NULL,
  paid_amount              NUMERIC(14,2) DEFAULT 0,
  status                   distribution_status DEFAULT 'pending',
  created_at               TIMESTAMPTZ DEFAULT now(),

  UNIQUE(installment_id, participant_id)
);

COMMENT ON TABLE commission_distributions IS 'Distribuição do valor de cada parcela entre os participantes da operação';

-- --------------------------------------------------------------------------
-- payments — Pagamentos realizados
-- --------------------------------------------------------------------------
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id UUID NOT NULL REFERENCES commission_distributions(id),
  amount          NUMERIC(14,2) NOT NULL,
  payment_date    DATE DEFAULT CURRENT_DATE,
  method          payment_method DEFAULT 'pix',
  reference       TEXT,                                   -- Comprovante, número do PIX, etc.
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE payments IS 'Registro de pagamentos realizados para distribuições de comissão';


-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================

-- Índices em chaves estrangeiras (para performance em JOINs)
CREATE INDEX idx_participants_parent_id ON participants(parent_id);
CREATE INDEX idx_participants_created_by ON participants(created_by);
CREATE INDEX idx_participants_type ON participants(type);

CREATE INDEX idx_commission_rules_created_by ON commission_rules(created_by);
CREATE INDEX idx_commission_rules_product_type ON commission_rules(product_type);

CREATE INDEX idx_operations_commission_rule_id ON operations(commission_rule_id);
CREATE INDEX idx_operations_created_by ON operations(created_by);
CREATE INDEX idx_operations_status ON operations(status);
CREATE INDEX idx_operations_operation_date ON operations(operation_date);
CREATE INDEX idx_operations_product_type ON operations(product_type);

CREATE INDEX idx_operation_participants_operation_id ON operation_participants(operation_id);
CREATE INDEX idx_operation_participants_participant_id ON operation_participants(participant_id);

CREATE INDEX idx_commission_installments_operation_id ON commission_installments(operation_id);
CREATE INDEX idx_commission_installments_status ON commission_installments(status);
CREATE INDEX idx_commission_installments_due_date ON commission_installments(due_date);

CREATE INDEX idx_commission_distributions_installment_id ON commission_distributions(installment_id);
CREATE INDEX idx_commission_distributions_participant_id ON commission_distributions(participant_id);
CREATE INDEX idx_commission_distributions_op_participant_id ON commission_distributions(operation_participant_id);
CREATE INDEX idx_commission_distributions_status ON commission_distributions(status);

CREATE INDEX idx_payments_distribution_id ON payments(distribution_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_created_by ON payments(created_by);


-- ============================================================================
-- 4. FUNÇÕES E TRIGGERS
-- ============================================================================

-- --------------------------------------------------------------------------
-- update_updated_at() — Atualiza automaticamente o campo updated_at
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at() IS 'Atualiza automaticamente o campo updated_at em qualquer tabela';

-- Triggers de updated_at
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_commission_rules_updated_at
  BEFORE UPDATE ON commission_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------------------------
-- validate_participant_shares() — Valida que a soma dos percentuais ≤ 100%
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_participant_shares()
RETURNS TRIGGER AS $$
DECLARE
  total_share NUMERIC;
BEGIN
  SELECT COALESCE(SUM(percentage_share), 0)
  INTO total_share
  FROM operation_participants
  WHERE operation_id = NEW.operation_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  total_share := total_share + NEW.percentage_share;

  -- Tolerância de 0.0001 para arredondamentos
  IF total_share > 1.0001 THEN
    RAISE EXCEPTION 'Soma dos percentuais dos participantes excede 100%%. Soma atual: %',
      total_share * 100;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_participant_shares() IS 'Valida que a soma dos percentuais dos participantes não excede 100% (com tolerância de 0.01%)';

CREATE TRIGGER trg_validate_participant_shares
  BEFORE INSERT OR UPDATE ON operation_participants
  FOR EACH ROW EXECUTE FUNCTION validate_participant_shares();

-- --------------------------------------------------------------------------
-- validate_payment_amount() — Impede pagamento acima do valor da distribuição
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_payment_amount()
RETURNS TRIGGER AS $$
DECLARE
  dist_value   NUMERIC;
  total_paid   NUMERIC;
BEGIN
  -- Buscar valor total da distribuição
  SELECT value INTO dist_value
  FROM commission_distributions
  WHERE id = NEW.distribution_id;

  -- Calcular total já pago (excluindo o pagamento atual em caso de UPDATE)
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM payments
  WHERE distribution_id = NEW.distribution_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Tolerância de R$0.01 para arredondamentos
  IF (total_paid + NEW.amount) > (dist_value + 0.01) THEN
    RAISE EXCEPTION 'Pagamento de R$% excede o valor da distribuição. Valor: R$%, Já pago: R$%, Restante: R$%',
      NEW.amount, dist_value, total_paid, (dist_value - total_paid);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_payment_amount() IS 'Impede que o total de pagamentos exceda o valor da distribuição';

CREATE TRIGGER trg_validate_payment_amount
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION validate_payment_amount();

-- --------------------------------------------------------------------------
-- update_installment_status() — Atualiza status da parcela baseado nas distribuições
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_installment_status(p_installment_id UUID)
RETURNS VOID AS $$
DECLARE
  total_distributions INTEGER;
  paid_distributions  INTEGER;
  partial_distributions INTEGER;
  new_status installment_status;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'paid'),
    COUNT(*) FILTER (WHERE status = 'partial')
  INTO total_distributions, paid_distributions, partial_distributions
  FROM commission_distributions
  WHERE installment_id = p_installment_id;

  IF total_distributions = 0 THEN
    new_status := 'pending';
  ELSIF paid_distributions = total_distributions THEN
    new_status := 'paid';
  ELSIF paid_distributions > 0 OR partial_distributions > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'pending';
  END IF;

  UPDATE commission_installments
  SET status = new_status
  WHERE id = p_installment_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_installment_status(UUID) IS 'Recalcula o status de uma parcela com base no status de todas as suas distribuições';

-- --------------------------------------------------------------------------
-- update_distribution_after_payment() — Após pagamento, atualiza distribuição e parcela
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_distribution_after_payment()
RETURNS TRIGGER AS $$
DECLARE
  dist_record RECORD;
  new_paid    NUMERIC;
  new_status  distribution_status;
  v_installment_id UUID;
BEGIN
  -- Recalcular total pago para esta distribuição
  SELECT COALESCE(SUM(amount), 0) INTO new_paid
  FROM payments
  WHERE distribution_id = NEW.distribution_id;

  -- Buscar dados da distribuição
  SELECT value, installment_id
  INTO dist_record
  FROM commission_distributions
  WHERE id = NEW.distribution_id;

  v_installment_id := dist_record.installment_id;

  -- Determinar novo status
  IF new_paid >= dist_record.value THEN
    new_status := 'paid';
  ELSIF new_paid > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'pending';
  END IF;

  -- Atualizar distribuição
  UPDATE commission_distributions
  SET paid_amount = new_paid,
      status = new_status
  WHERE id = NEW.distribution_id;

  -- Atualizar status da parcela
  PERFORM update_installment_status(v_installment_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_distribution_after_payment() IS 'Após inserção de pagamento, atualiza paid_amount e status da distribuição, e recalcula status da parcela';

CREATE TRIGGER trg_update_distribution_after_payment
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION update_distribution_after_payment();

-- --------------------------------------------------------------------------
-- handle_new_user() — Cria perfil automaticamente ao registrar novo usuário
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'consultant')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION handle_new_user() IS 'Cria automaticamente um perfil na tabela profiles quando um novo usuário é registrado no auth.users';

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- --------------------------------------------------------------------------
-- generate_operation_code() — Gera código sequencial para operações
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_operation_code()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_seq     INTEGER;
  new_code     TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  -- Contar operações do ano corrente e incrementar
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(code, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM operations
  WHERE code LIKE 'OP-' || current_year || '-%';

  new_code := 'OP-' || current_year || '-' || LPAD(next_seq::TEXT, 3, '0');

  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_operation_code() IS 'Gera código sequencial no formato OP-AAAA-NNN (ex: OP-2026-001)';


-- ============================================================================
-- 5. RPC: create_operation_with_distributions
-- Cria operação completa em uma única transação
-- ============================================================================

CREATE OR REPLACE FUNCTION create_operation_with_distributions(params JSONB)
RETURNS UUID AS $$
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
  v_participant_map    JSONB := '{}';  -- Mapa participant_id → operation_participant_id
BEGIN
  -- Gerar código da operação
  v_operation_code := generate_operation_code();

  v_credit_value     := (params->>'credit_value')::NUMERIC;
  v_commission_model := (params->>'commission_model')::NUMERIC;
  v_commission_total := v_credit_value * v_commission_model;

  -- 1. Inserir operação
  INSERT INTO operations (
    code, description, credit_value, commission_model,
    product_type, commission_rule_id, status, operation_date, notes, created_by
  ) VALUES (
    v_operation_code,
    params->>'description',
    v_credit_value,
    v_commission_model,
    (params->>'product_type')::product_type,
    (params->>'commission_rule_id')::UUID,
    COALESCE((params->>'status')::operation_status, 'draft'),
    COALESCE((params->>'operation_date')::DATE, CURRENT_DATE),
    params->>'notes',
    (params->>'created_by')::UUID
  )
  RETURNING id INTO v_operation_id;

  -- 2. Inserir participantes da operação
  FOR v_participant IN SELECT * FROM jsonb_array_elements(params->'participants')
  LOOP
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

    -- Guardar mapeamento para uso nas distribuições
    v_participant_map := v_participant_map || jsonb_build_object(
      v_participant->>'participant_id', v_op_participant_id
    );
  END LOOP;

  -- 3. Inserir parcelas e distribuições
  FOR v_installment IN SELECT * FROM jsonb_array_elements(params->'installments')
  LOOP
    v_installment_value := v_commission_total * (v_installment->>'percentage_of_credit')::NUMERIC;

    INSERT INTO commission_installments (
      operation_id, installment_number, percentage_of_credit, value, due_date
    ) VALUES (
      v_operation_id,
      (v_installment->>'number')::INTEGER,
      (v_installment->>'percentage_of_credit')::NUMERIC,
      v_installment_value,
      (v_installment->>'due_date')::DATE
    )
    RETURNING id INTO v_installment_id;

    -- Para cada participante, criar distribuição nesta parcela
    FOR v_participant IN SELECT * FROM jsonb_array_elements(params->'participants')
    LOOP
      v_dist_value := v_installment_value * (v_participant->>'percentage_share')::NUMERIC;

      INSERT INTO commission_distributions (
        installment_id, participant_id, operation_participant_id,
        percentage_share, value
      ) VALUES (
        v_installment_id,
        (v_participant->>'participant_id')::UUID,
        (v_participant_map->>( v_participant->>'participant_id'))::UUID,
        (v_participant->>'percentage_share')::NUMERIC,
        v_dist_value
      );
    END LOOP;
  END LOOP;

  RETURN v_operation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_operation_with_distributions(JSONB) IS
'Cria uma operação completa em transação única: operação + participantes + parcelas + distribuições.
Parâmetros esperados (JSONB):
{
  "credit_value": 100000.00,
  "commission_model": 0.0600,
  "product_type": "imovel",
  "commission_rule_id": null,
  "description": "Venda apartamento X",
  "operation_date": "2026-03-24",
  "notes": "",
  "created_by": "uuid-do-usuario",
  "participants": [
    {"participant_id": "uuid", "percentage_share": 0.5000, "role_in_operation": "Consultor principal"},
    {"participant_id": "uuid", "percentage_share": 0.5000, "role_in_operation": "Parceiro"}
  ],
  "installments": [
    {"number": 1, "percentage_of_credit": 0.3000, "due_date": "2026-04-15"},
    {"number": 2, "percentage_of_credit": 0.7000, "due_date": "2026-05-15"}
  ]
}';


-- ============================================================================
-- 6. VIEWS
-- ============================================================================

-- --------------------------------------------------------------------------
-- v_operation_summary — Resumo das operações com dados de pagamento
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_operation_summary AS
SELECT
  o.id,
  o.code,
  o.description,
  o.credit_value,
  o.commission_model,
  o.commission_total,
  o.product_type,
  o.status,
  o.operation_date,
  o.created_by,
  o.created_at,
  COALESCE(pay.total_paid, 0)               AS total_paid,
  o.commission_total - COALESCE(pay.total_paid, 0) AS pending_amount,
  CASE
    WHEN o.commission_total > 0
    THEN ROUND(COALESCE(pay.total_paid, 0) / o.commission_total * 100, 2)
    ELSE 0
  END AS paid_percentage
FROM operations o
LEFT JOIN LATERAL (
  SELECT SUM(p.amount) AS total_paid
  FROM payments p
  JOIN commission_distributions cd ON cd.id = p.distribution_id
  JOIN commission_installments ci ON ci.id = cd.installment_id
  WHERE ci.operation_id = o.id
) pay ON true;

COMMENT ON VIEW v_operation_summary IS 'Resumo de operações com totais pagos e pendentes';

-- --------------------------------------------------------------------------
-- v_participant_earnings — Ganhos por participante
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_participant_earnings AS
SELECT
  p.id,
  p.name,
  p.type,
  p.document,
  p.is_active,
  COUNT(DISTINCT op.operation_id)            AS operation_count,
  COALESCE(SUM(cd.value), 0)                 AS total_commission,
  COALESCE(SUM(cd.paid_amount), 0)           AS total_paid,
  COALESCE(SUM(cd.value), 0) - COALESCE(SUM(cd.paid_amount), 0) AS total_pending
FROM participants p
LEFT JOIN operation_participants op ON op.participant_id = p.id
LEFT JOIN commission_distributions cd ON cd.operation_participant_id = op.id
GROUP BY p.id, p.name, p.type, p.document, p.is_active;

COMMENT ON VIEW v_participant_earnings IS 'Ganhos agregados por participante (total de comissões, pago e pendente)';

-- --------------------------------------------------------------------------
-- v_monthly_commissions — Comissões agregadas por mês
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_monthly_commissions AS
SELECT
  DATE_TRUNC('month', o.operation_date)::DATE  AS month,
  COUNT(DISTINCT o.id)                          AS operation_count,
  SUM(o.commission_total)                       AS total_generated,
  COALESCE(SUM(pay.paid), 0)                    AS total_paid,
  SUM(o.commission_total) - COALESCE(SUM(pay.paid), 0) AS total_pending
FROM operations o
LEFT JOIN LATERAL (
  SELECT SUM(p.amount) AS paid
  FROM payments p
  JOIN commission_distributions cd ON cd.id = p.distribution_id
  JOIN commission_installments ci ON ci.id = cd.installment_id
  WHERE ci.operation_id = o.id
) pay ON true
WHERE o.status IN ('active', 'completed')
GROUP BY DATE_TRUNC('month', o.operation_date)
ORDER BY month DESC;

COMMENT ON VIEW v_monthly_commissions IS 'Comissões geradas e pagas agregadas por mês';

-- --------------------------------------------------------------------------
-- v_future_flow — Fluxo futuro de parcelas a receber
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_future_flow AS
SELECT
  ci.id AS installment_id,
  ci.due_date,
  ci.installment_number,
  ci.value AS installment_value,
  ci.status AS installment_status,
  o.id AS operation_id,
  o.code AS operation_code,
  o.description AS operation_description,
  o.product_type,
  COALESCE(SUM(cd.paid_amount), 0) AS paid_amount,
  ci.value - COALESCE(SUM(cd.paid_amount), 0) AS remaining_amount
FROM commission_installments ci
JOIN operations o ON o.id = ci.operation_id
LEFT JOIN commission_distributions cd ON cd.installment_id = ci.id
WHERE ci.status IN ('pending', 'partial')
  AND o.status IN ('active', 'completed')
GROUP BY ci.id, ci.due_date, ci.installment_number, ci.value, ci.status,
         o.id, o.code, o.description, o.product_type
ORDER BY ci.due_date ASC;

COMMENT ON VIEW v_future_flow IS 'Fluxo futuro: parcelas pendentes ou parciais com datas de vencimento';


-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- Função auxiliar: get_user_role() — Retorna o papel do usuário autenticado
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_role() IS 'Retorna o role do usuário autenticado para uso nas políticas RLS';

-- --------------------------------------------------------------------------
-- Função auxiliar: is_admin_or_manager() — Verifica se é admin ou manager
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin', 'manager');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ========== PROFILES ==========

-- Todos podem ler perfis
CREATE POLICY profiles_select ON profiles
  FOR SELECT USING (true);

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Admin/Manager podem atualizar qualquer perfil
CREATE POLICY profiles_update_admin ON profiles
  FOR UPDATE USING (is_admin_or_manager());

-- Admin/Manager podem inserir perfis
CREATE POLICY profiles_insert_admin ON profiles
  FOR INSERT WITH CHECK (is_admin_or_manager() OR id = auth.uid());

-- ========== PARTICIPANTS ==========

-- Todos podem ler participantes
CREATE POLICY participants_select ON participants
  FOR SELECT USING (true);

-- Apenas admin/manager podem inserir
CREATE POLICY participants_insert ON participants
  FOR INSERT WITH CHECK (is_admin_or_manager());

-- Apenas admin/manager podem atualizar
CREATE POLICY participants_update ON participants
  FOR UPDATE USING (is_admin_or_manager());

-- Apenas admin/manager podem deletar
CREATE POLICY participants_delete ON participants
  FOR DELETE USING (is_admin_or_manager());

-- ========== COMMISSION RULES ==========

-- Todos podem ler regras
CREATE POLICY commission_rules_select ON commission_rules
  FOR SELECT USING (true);

-- Apenas admin/manager podem escrever
CREATE POLICY commission_rules_insert ON commission_rules
  FOR INSERT WITH CHECK (is_admin_or_manager());

CREATE POLICY commission_rules_update ON commission_rules
  FOR UPDATE USING (is_admin_or_manager());

CREATE POLICY commission_rules_delete ON commission_rules
  FOR DELETE USING (is_admin_or_manager());

-- ========== OPERATIONS ==========

-- Admin/Manager vêem tudo
CREATE POLICY operations_select_admin ON operations
  FOR SELECT USING (is_admin_or_manager());

-- Consultores/Parceiros vêem operações onde participam
CREATE POLICY operations_select_participant ON operations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM operation_participants op
      JOIN participants p ON p.id = op.participant_id
      WHERE op.operation_id = operations.id
        AND p.id IN (
          SELECT pa.id FROM participants pa
          WHERE pa.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
  );

-- Admin/Manager podem inserir, atualizar, deletar
CREATE POLICY operations_insert ON operations
  FOR INSERT WITH CHECK (is_admin_or_manager());

CREATE POLICY operations_update ON operations
  FOR UPDATE USING (is_admin_or_manager());

CREATE POLICY operations_delete ON operations
  FOR DELETE USING (is_admin_or_manager());

-- ========== OPERATION PARTICIPANTS ==========

-- Admin/Manager vêem tudo
CREATE POLICY op_participants_select_admin ON operation_participants
  FOR SELECT USING (is_admin_or_manager());

-- Participantes vêem seus próprios registros
CREATE POLICY op_participants_select_own ON operation_participants
  FOR SELECT USING (
    participant_id IN (
      SELECT p.id FROM participants p
      WHERE p.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY op_participants_insert ON operation_participants
  FOR INSERT WITH CHECK (is_admin_or_manager());

CREATE POLICY op_participants_update ON operation_participants
  FOR UPDATE USING (is_admin_or_manager());

CREATE POLICY op_participants_delete ON operation_participants
  FOR DELETE USING (is_admin_or_manager());

-- ========== COMMISSION INSTALLMENTS ==========

-- Admin/Manager vêem tudo
CREATE POLICY installments_select_admin ON commission_installments
  FOR SELECT USING (is_admin_or_manager());

-- Participantes vêem parcelas das suas operações
CREATE POLICY installments_select_participant ON commission_installments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM operation_participants op
      JOIN participants p ON p.id = op.participant_id
      WHERE op.operation_id = commission_installments.operation_id
        AND p.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY installments_insert ON commission_installments
  FOR INSERT WITH CHECK (is_admin_or_manager());

CREATE POLICY installments_update ON commission_installments
  FOR UPDATE USING (is_admin_or_manager());

CREATE POLICY installments_delete ON commission_installments
  FOR DELETE USING (is_admin_or_manager());

-- ========== COMMISSION DISTRIBUTIONS ==========

-- Admin/Manager vêem tudo
CREATE POLICY distributions_select_admin ON commission_distributions
  FOR SELECT USING (is_admin_or_manager());

-- Participantes vêem suas próprias distribuições
CREATE POLICY distributions_select_own ON commission_distributions
  FOR SELECT USING (
    participant_id IN (
      SELECT p.id FROM participants p
      WHERE p.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY distributions_insert ON commission_distributions
  FOR INSERT WITH CHECK (is_admin_or_manager());

CREATE POLICY distributions_update ON commission_distributions
  FOR UPDATE USING (is_admin_or_manager());

CREATE POLICY distributions_delete ON commission_distributions
  FOR DELETE USING (is_admin_or_manager());

-- ========== PAYMENTS ==========

-- Admin/Manager vêem tudo
CREATE POLICY payments_select_admin ON payments
  FOR SELECT USING (is_admin_or_manager());

-- Participantes vêem pagamentos das suas distribuições
CREATE POLICY payments_select_own ON payments
  FOR SELECT USING (
    distribution_id IN (
      SELECT cd.id FROM commission_distributions cd
      JOIN participants p ON p.id = cd.participant_id
      WHERE p.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Admin/Manager podem registrar pagamentos
CREATE POLICY payments_insert ON payments
  FOR INSERT WITH CHECK (is_admin_or_manager());

CREATE POLICY payments_update ON payments
  FOR UPDATE USING (is_admin_or_manager());

CREATE POLICY payments_delete ON payments
  FOR DELETE USING (is_admin_or_manager());


-- ============================================================================
-- 8. DADOS INICIAIS (SEED)
-- ============================================================================

-- --------------------------------------------------------------------------
-- Regras de comissão padrão para imóveis
-- --------------------------------------------------------------------------
INSERT INTO commission_rules (name, product_type, commission_model, installments, is_active)
VALUES
  (
    'Imóvel - Comissão Padrão 6%',
    'imovel',
    0.0600,
    '[
      {"number": 1, "percentage_of_credit": 0.3000},
      {"number": 2, "percentage_of_credit": 0.3000},
      {"number": 3, "percentage_of_credit": 0.4000}
    ]'::JSONB,
    true
  ),
  (
    'Imóvel - Comissão Premium 8%',
    'imovel',
    0.0800,
    '[
      {"number": 1, "percentage_of_credit": 0.5000},
      {"number": 2, "percentage_of_credit": 0.5000}
    ]'::JSONB,
    true
  );

-- --------------------------------------------------------------------------
-- Regras de comissão padrão para automóveis / consórcio
-- --------------------------------------------------------------------------
INSERT INTO commission_rules (name, product_type, commission_model, installments, is_active)
VALUES
  (
    'Auto - Comissão Padrão 3%',
    'auto',
    0.0300,
    '[
      {"number": 1, "percentage_of_credit": 0.5000},
      {"number": 2, "percentage_of_credit": 0.5000}
    ]'::JSONB,
    true
  ),
  (
    'Auto - Comissão Consórcio 5%',
    'auto',
    0.0500,
    '[
      {"number": 1, "percentage_of_credit": 0.2000},
      {"number": 2, "percentage_of_credit": 0.3000},
      {"number": 3, "percentage_of_credit": 0.2500},
      {"number": 4, "percentage_of_credit": 0.2500}
    ]'::JSONB,
    true
  );


-- ============================================================================
-- FIM DO SCHEMA
-- Pronto para executar no Supabase SQL Editor
-- ============================================================================
