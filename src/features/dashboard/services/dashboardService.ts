import { supabase } from '@/lib/supabase'
import type { DashboardKpis } from '@/shared/types'

// ─── Response types ──────────────────────────────────────────────────────────

export interface CommissionByParticipant {
  participantId: string
  name: string
  type: string
  totalCommission: number
}

export interface CommissionByProductType {
  productType: string
  totalCommission: number
  operationCount: number
}

export interface MonthlyEvolution {
  month: string
  generated: number
  paid: number
}

export interface ParticipantRankingItem {
  participantId: string
  name: string
  type: string
  totalEarned: number
  operationCount: number
}

export interface FutureFlowItem {
  month: string
  pending: number
  partial: number
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Fetch KPI totals. If participantId is provided, scopes to that participant only.
 */
export async function getDashboardKpis(participantId?: string | null): Promise<DashboardKpis> {
  if (participantId) {
    return getConsultorKpis(participantId)
  }

  // Admin: full KPIs
  const { data: operations, error: opsError } = await supabase
    .from('operations')
    .select('credit_value, commission_total, status')
    .in('status', ['active', 'completed'])

  if (opsError) throw opsError

  const totalCredit = (operations ?? []).reduce(
    (sum, op) => sum + (op.credit_value ?? 0),
    0,
  )
  const commissionGenerated = (operations ?? []).reduce(
    (sum, op) => sum + (op.commission_total ?? 0),
    0,
  )

  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('amount')

  if (payError) throw payError

  const commissionPaid = (payments ?? []).reduce(
    (sum, p) => sum + (p.amount ?? 0),
    0,
  )

  const { data: installments, error: instError } = await supabase
    .from('commission_installments')
    .select('value, status')
    .in('status', ['pending', 'partial'])

  if (instError) throw instError

  const futureLiability = (installments ?? []).reduce(
    (sum, i) => sum + (i.value ?? 0),
    0,
  )

  return {
    totalCredit,
    commissionGenerated,
    commissionPaid,
    commissionPending: commissionGenerated - commissionPaid,
    futureLiability,
  }
}

/**
 * Consultor-scoped KPIs: only their distributions/payments.
 */
async function getConsultorKpis(participantId: string): Promise<DashboardKpis> {
  // Get distributions for this participant
  const { data: distributions, error: distError } = await supabase
    .from('commission_distributions')
    .select('id, value, status')
    .eq('participant_id', participantId)

  if (distError) throw distError

  const commissionGenerated = (distributions ?? []).reduce(
    (sum, d) => sum + (d.value ?? 0),
    0,
  )

  // Get payments for this participant's distributions
  const distIds = (distributions ?? []).map((d) => d.id)
  let commissionPaid = 0

  if (distIds.length > 0) {
    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('amount')
      .in('distribution_id', distIds)

    if (payError) throw payError
    commissionPaid = (payments ?? []).reduce(
      (sum, p) => sum + (p.amount ?? 0),
      0,
    )
  }

  // Get operations this participant is in
  const { data: opParts, error: opError } = await supabase
    .from('operation_participants')
    .select('operation:operations(credit_value, status)')
    .eq('participant_id', participantId)

  if (opError) throw opError

  const totalCredit = (opParts ?? []).reduce((sum, op) => {
    const operation = op.operation as unknown as { credit_value: number; status: string } | null
    if (operation && ['active', 'completed'].includes(operation.status)) {
      return sum + (operation.credit_value ?? 0)
    }
    return sum
  }, 0)

  return {
    totalCredit,
    commissionGenerated,
    commissionPaid,
    commissionPending: commissionGenerated - commissionPaid,
    futureLiability: commissionGenerated - commissionPaid,
  }
}

/**
 * Top 10 participants by commission value.
 * Joins commission_distributions -> commission_installments -> operations,
 * then groups by participant.
 */
export async function getCommissionByParticipant(): Promise<
  CommissionByParticipant[]
> {
  const { data, error } = await supabase
    .from('commission_distributions')
    .select(`
      value,
      participant:participants!participant_id(id, name, type)
    `)

  if (error) throw error

  const map = new Map<
    string,
    { name: string; type: string; total: number }
  >()

  for (const row of data ?? []) {
    const p = row.participant as unknown as {
      id: string
      name: string
      type: string
    } | null
    if (!p) continue
    const existing = map.get(p.id)
    if (existing) {
      existing.total += row.value ?? 0
    } else {
      map.set(p.id, { name: p.name, type: p.type, total: row.value ?? 0 })
    }
  }

  return Array.from(map.entries())
    .map(([id, v]) => ({
      participantId: id,
      name: v.name,
      type: v.type,
      totalCommission: v.total,
    }))
    .sort((a, b) => b.totalCommission - a.totalCommission)
    .slice(0, 10)
}

/**
 * Group operations by product_type and sum commissions.
 */
export async function getCommissionByProductType(): Promise<
  CommissionByProductType[]
> {
  const { data, error } = await supabase
    .from('operations')
    .select('product_type, commission_total')
    .in('status', ['active', 'completed'])

  if (error) throw error

  const map = new Map<string, { total: number; count: number }>()

  for (const row of data ?? []) {
    const existing = map.get(row.product_type)
    if (existing) {
      existing.total += row.commission_total ?? 0
      existing.count += 1
    } else {
      map.set(row.product_type, {
        total: row.commission_total ?? 0,
        count: 1,
      })
    }
  }

  return Array.from(map.entries())
    .map(([productType, v]) => ({
      productType,
      totalCommission: v.total,
      operationCount: v.count,
    }))
    .sort((a, b) => b.totalCommission - a.totalCommission)
}

/**
 * Monthly commission evolution for the last 12 months.
 * Groups operations by month and sums generated commissions,
 * then groups payments by month for paid commissions.
 */
export async function getMonthlyEvolution(): Promise<MonthlyEvolution[]> {
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const cutoff = twelveMonthsAgo.toISOString().slice(0, 10)

  // Generated: operations by operation_date
  const { data: ops, error: opsErr } = await supabase
    .from('operations')
    .select('operation_date, commission_total')
    .in('status', ['active', 'completed'])
    .gte('operation_date', cutoff)
    .order('operation_date')

  if (opsErr) throw opsErr

  // Paid: payments by payment_date
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('payment_date, amount')
    .gte('payment_date', cutoff)
    .order('payment_date')

  if (payErr) throw payErr

  const monthMap = new Map<string, { generated: number; paid: number }>()

  // Initialize last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, { generated: 0, paid: 0 })
  }

  for (const op of ops ?? []) {
    const key = op.operation_date?.slice(0, 7)
    if (key && monthMap.has(key)) {
      monthMap.get(key)!.generated += op.commission_total ?? 0
    }
  }

  for (const pay of payments ?? []) {
    const key = pay.payment_date?.slice(0, 7)
    if (key && monthMap.has(key)) {
      monthMap.get(key)!.paid += pay.amount ?? 0
    }
  }

  return Array.from(monthMap.entries()).map(([month, v]) => ({
    month,
    generated: v.generated,
    paid: v.paid,
  }))
}

/**
 * Top 10 participants ranked by total earned (paid commissions).
 */
export async function getParticipantRanking(): Promise<
  ParticipantRankingItem[]
> {
  const { data, error } = await supabase
    .from('commission_distributions')
    .select(`
      value,
      installment:commission_installments!installment_id(
        operation:operations!operation_id(id)
      ),
      participant:participants!participant_id(id, name, type)
    `)

  if (error) throw error

  const map = new Map<
    string,
    {
      name: string
      type: string
      totalEarned: number
      operationIds: Set<string>
    }
  >()

  for (const row of data ?? []) {
    const p = row.participant as unknown as {
      id: string
      name: string
      type: string
    } | null
    if (!p) continue

    const inst = row.installment as unknown as {
      operation: { id: string } | null
    } | null
    const opId = inst?.operation?.id

    const existing = map.get(p.id)
    if (existing) {
      existing.totalEarned += row.value ?? 0
      if (opId) existing.operationIds.add(opId)
    } else {
      const operationIds = new Set<string>()
      if (opId) operationIds.add(opId)
      map.set(p.id, {
        name: p.name,
        type: p.type,
        totalEarned: row.value ?? 0,
        operationIds,
      })
    }
  }

  return Array.from(map.entries())
    .map(([id, v]) => ({
      participantId: id,
      name: v.name,
      type: v.type,
      totalEarned: v.totalEarned,
      operationCount: v.operationIds.size,
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, 10)
}

/**
 * Future cash flow: upcoming installments grouped by month for next 6 months.
 */
export async function getFutureFlow(): Promise<FutureFlowItem[]> {
  const today = new Date().toISOString().slice(0, 10)
  const sixMonthsLater = new Date()
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)
  const endDate = sixMonthsLater.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('commission_installments')
    .select('due_date, value, status')
    .in('status', ['pending', 'partial'])
    .gte('due_date', today)
    .lte('due_date', endDate)
    .order('due_date')

  if (error) throw error

  const monthMap = new Map<string, { pending: number; partial: number }>()

  // Initialize next 6 months
  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, { pending: 0, partial: 0 })
  }

  for (const row of data ?? []) {
    const key = row.due_date?.slice(0, 7)
    if (key && monthMap.has(key)) {
      const entry = monthMap.get(key)!
      if (row.status === 'partial') {
        entry.partial += row.value ?? 0
      } else {
        entry.pending += row.value ?? 0
      }
    }
  }

  return Array.from(monthMap.entries()).map(([month, v]) => ({
    month,
    pending: v.pending,
    partial: v.partial,
  }))
}
