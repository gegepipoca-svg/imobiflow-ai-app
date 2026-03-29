export * from './database'

// ─── App-level types ────────────────────────────────────────────────────────

export interface DashboardKpis {
  totalCredit: number
  commissionGenerated: number
  commissionPaid: number
  commissionPending: number
  futureLiability: number
}

export interface OperationSummary {
  id: string
  code: string
  credit_value: number
  commission_model: number
  commission_total: number
  product_type: string
  operation_date: string
  status: string
  totalPaid: number
  pendingAmount: number
}

export interface ParticipantEarnings {
  id: string
  name: string
  type: string
  document: string | null
  email: string | null
  phone: string | null
  is_active: boolean
  operationCount: number
  totalCommission: number
  totalPaid: number
  totalPending: number
}

export interface SimulationParams {
  creditValue: number
  commissionModel: number
  productType: string
  installments: { number: number; percentage_of_credit: number }[]
  participants: { participantId: string; percentageShare: number }[]
}

export interface SimulationResult {
  totalCommission: number
  installments: {
    number: number
    amount: number
    distributions: {
      participantId: string
      participantName: string
      amount: number
    }[]
  }[]
  participantTotals: {
    participantId: string
    participantName: string
    totalAmount: number
  }[]
}
