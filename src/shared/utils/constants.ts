import type {
  ProductType,
  ParticipantType,
  OperationStatus,
  InstallmentStatus,
  DistributionStatus,
  PaymentMethod,
  UserRole,
} from '@/shared/types'

// ─── Product Type ────────────────────────────────────────────────────────────

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  imovel: 'Imóvel',
  auto: 'Automóvel',
  servico: 'Serviço',
  outros: 'Outros',
}

// ─── Participant Type ────────────────────────────────────────────────────────

export const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string> = {
  consultant: 'Consultor',
  partner: 'Parceiro',
  office: 'Escritório',
  intermediary: 'Intermediário',
}

// ─── Operation Status ────────────────────────────────────────────────────────

export const OPERATION_STATUS_LABELS: Record<OperationStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  completed: 'Concluída',
  cancelled: 'Cancelada',
  reversed: 'Estornada',
}

export const OPERATION_STATUS_COLORS: Record<OperationStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  reversed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
}

// ─── Installment Status ──────────────────────────────────────────────────────

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  pending: 'Pendente',
  partial: 'Parcial',
  paid: 'Pago',
  reversed: 'Estornado',
}

export const INSTALLMENT_STATUS_COLORS: Record<InstallmentStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  reversed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
}

// ─── Distribution Status ─────────────────────────────────────────────────────

export const DISTRIBUTION_STATUS_LABELS: Record<DistributionStatus, string> = {
  pending: 'Pendente',
  partial: 'Parcial',
  paid: 'Pago',
  reversed: 'Estornado',
}

export const DISTRIBUTION_STATUS_COLORS: Record<DistributionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  reversed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
}

// ─── Payment Method ──────────────────────────────────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  transfer: 'Transferência',
  cash: 'Dinheiro',
  check: 'Cheque',
  other: 'Outro',
}

// ─── User Role ───────────────────────────────────────────────────────────────

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  consultant: 'Consultor',
  partner: 'Parceiro',
}
