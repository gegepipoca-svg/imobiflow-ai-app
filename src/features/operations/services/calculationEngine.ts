import { addMonths, format } from 'date-fns'
import type { InstallmentDefinition } from '@/shared/types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GeneratedInstallment {
  installment_number: number
  percentage_of_credit: number
  value: number
  due_date: string
}

export interface GeneratedDistribution {
  installment_number: number
  participant_id: string
  percentage_share: number
  value: number
}

export interface ParticipantShareValidation {
  valid: boolean
  total: number
  message?: string
}

export interface SimulationBreakdown {
  totalCommission: number
  installments: GeneratedInstallment[]
  distributions: GeneratedDistribution[]
  participantTotals: Array<{
    participant_id: string
    total: number
  }>
}

// ─── Pure calculation functions ─────────────────────────────────────────────

/**
 * Calculate the total commission value from credit and commission model (decimal).
 * @example calculateCommissionTotal(100000, 0.10) => 10000
 */
export function calculateCommissionTotal(
  creditValue: number,
  commissionModel: number,
): number {
  return Math.round(creditValue * commissionModel * 100) / 100
}

/**
 * Generate installments with values and due dates.
 * Due dates are calculated N months from today using addMonths (handles
 * end-of-month overflow correctly, e.g. Jan 31 + 1 month = Feb 28).
 * Date is formatted in local timezone (not UTC) to avoid day-off bugs in BRT.
 */
export function generateInstallments(
  creditValue: number,
  installmentDefs: InstallmentDefinition[],
): GeneratedInstallment[] {
  const sorted = [...installmentDefs].sort((a, b) => a.number - b.number)
  const today = new Date()

  return sorted.map((def) => {
    const dueDate = addMonths(today, def.number)
    const value = Math.round(creditValue * def.percentage_of_credit * 100) / 100

    return {
      installment_number: def.number,
      percentage_of_credit: def.percentage_of_credit,
      value,
      due_date: format(dueDate, 'yyyy-MM-dd'),
    }
  })
}

/**
 * Generate distributions for each installment x participant combination.
 * value = installment.value * participant.percentage_share
 */
export function generateDistributions(
  installments: GeneratedInstallment[],
  participants: Array<{ participant_id: string; percentage_share: number }>,
): GeneratedDistribution[] {
  const distributions: GeneratedDistribution[] = []

  for (const installment of installments) {
    for (const participant of participants) {
      distributions.push({
        installment_number: installment.installment_number,
        participant_id: participant.participant_id,
        percentage_share: participant.percentage_share,
        value:
          Math.round(installment.value * participant.percentage_share * 100) /
          100,
      })
    }
  }

  return distributions
}

/**
 * Validate that participant shares sum to exactly 100% (1.0 in decimal).
 */
export function validateParticipantShares(
  participants: Array<{ percentage_share: number }>,
): ParticipantShareValidation {
  if (participants.length === 0) {
    return {
      valid: false,
      total: 0,
      message: 'Pelo menos um participante deve ser adicionado.',
    }
  }

  const total = participants.reduce((sum, p) => sum + p.percentage_share, 0)
  const roundedTotal = Math.round(total * 10000) / 10000

  if (Math.abs(roundedTotal - 1.0) > 0.001) {
    return {
      valid: false,
      total: roundedTotal,
      message: `A soma das participações é ${(roundedTotal * 100).toFixed(2)}%. Deve ser exatamente 100%.`,
    }
  }

  return { valid: true, total: roundedTotal }
}

/**
 * Full simulation combining all calculations.
 * Returns a complete breakdown of commission, installments, distributions, and per-participant totals.
 */
export function simulateCommission(
  creditValue: number,
  commissionModel: number,
  installmentDefs: InstallmentDefinition[],
  participants: Array<{ participant_id: string; percentage_share: number }>,
): SimulationBreakdown {
  const totalCommission = calculateCommissionTotal(creditValue, commissionModel)
  const installments = generateInstallments(creditValue, installmentDefs)
  const distributions = generateDistributions(installments, participants)

  // Calculate per-participant totals
  const totalsMap = new Map<string, number>()
  for (const dist of distributions) {
    const current = totalsMap.get(dist.participant_id) ?? 0
    totalsMap.set(dist.participant_id, current + dist.value)
  }

  const participantTotals = Array.from(totalsMap.entries()).map(
    ([participant_id, total]) => ({
      participant_id,
      total: Math.round(total * 100) / 100,
    }),
  )

  return {
    totalCommission,
    installments,
    distributions,
    participantTotals,
  }
}
