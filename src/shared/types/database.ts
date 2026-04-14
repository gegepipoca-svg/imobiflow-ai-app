// ─── Enums ───────────────────────────────────────────────────────────────────

export type ProductType = 'imovel' | 'auto' | 'servico' | 'outros'

export type ParticipantType = 'consultant' | 'partner' | 'office' | 'intermediary'

export type OperationStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'reversed'

export type InstallmentStatus = 'pending' | 'partial' | 'paid' | 'reversed'

export type DistributionStatus = 'pending' | 'partial' | 'paid' | 'reversed'

export type PaymentMethod = 'pix' | 'transfer' | 'cash' | 'check' | 'other'

export type UserRole = 'admin' | 'manager' | 'consultant' | 'partner'

// ─── JSONB types ─────────────────────────────────────────────────────────────

export interface InstallmentDefinition {
  number: number
  percentage_of_credit: number
}

// ─── Row types (full database rows) ─────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Participant {
  id: string
  name: string
  type: ParticipantType
  document: string | null
  email: string | null
  phone: string | null
  parent_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CommissionRule {
  id: string
  name: string
  product_type: ProductType
  commission_model: number
  installments: InstallmentDefinition[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Operation {
  id: string
  code: string
  credit_value: number
  commission_model: number
  readonly commission_total: number
  product_type: ProductType
  commission_rule_id: string | null
  operation_date: string
  status: OperationStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OperationParticipant {
  id: string
  operation_id: string
  participant_id: string
  percentage_share: number
  role_in_operation: string | null
  created_at: string
}

export interface CommissionInstallment {
  id: string
  operation_id: string
  installment_number: number
  percentage_of_credit: number
  value: number
  due_date: string | null
  status: InstallmentStatus
  created_at: string
  updated_at: string
}

export interface CommissionDistribution {
  id: string
  installment_id: string
  participant_id: string
  value: number
  status: DistributionStatus
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  distribution_id: string
  amount: number
  payment_date: string
  method: PaymentMethod
  reference: string | null
  notes: string | null
  created_at: string
}

// ─── Insert types (omit auto-generated fields) ─────────────────────────────

export type ProfileInsert = Omit<Profile, 'id' | 'created_at' | 'updated_at'>

export type ParticipantInsert = Omit<Participant, 'id' | 'created_at' | 'updated_at'>

export type CommissionRuleInsert = Omit<CommissionRule, 'id' | 'created_at' | 'updated_at'>

export type OperationInsert = Omit<
  Operation,
  'id' | 'created_at' | 'updated_at' | 'commission_total'
>

export type OperationParticipantInsert = Omit<OperationParticipant, 'id' | 'created_at'>

export type CommissionInstallmentInsert = Omit<
  CommissionInstallment,
  'id' | 'created_at' | 'updated_at'
>

export type CommissionDistributionInsert = Omit<
  CommissionDistribution,
  'id' | 'created_at' | 'updated_at'
>

export type PaymentInsert = Omit<Payment, 'id' | 'created_at'>

// ─── Update types (all fields optional) ─────────────────────────────────────

export type ProfileUpdate = Partial<ProfileInsert>

export type ParticipantUpdate = Partial<ParticipantInsert>

export type CommissionRuleUpdate = Partial<CommissionRuleInsert>

export type OperationUpdate = Partial<OperationInsert>

export type OperationParticipantUpdate = Partial<
  Omit<OperationParticipantInsert, 'operation_id' | 'participant_id'>
>

export type CommissionInstallmentUpdate = Partial<
  Omit<CommissionInstallmentInsert, 'operation_id'>
>

export type CommissionDistributionUpdate = Partial<
  Omit<CommissionDistributionInsert, 'installment_id' | 'participant_id'>
>

export type PaymentUpdate = Partial<Omit<PaymentInsert, 'distribution_id'>>
