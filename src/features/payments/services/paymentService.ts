import { supabase } from '@/lib/supabase'
import type { Payment, PaymentInsert, DistributionStatus } from '@/shared/types'

// ─── Enriched types for joined queries ──────────────────────────────────────

export interface DistributionWithDetails {
  id: string
  installment_id: string
  participant_id: string
  amount: number
  status: DistributionStatus
  created_at: string
  updated_at: string
  participant_name: string
  participant_type: string
  operation_id: string
  operation_code: string
  installment_number: number
  installment_amount: number
  installment_due_date: string | null
  paid_amount: number
  pending_amount: number
}

export interface PaymentWithDetails extends Payment {
  participant_name: string
  operation_code: string
}

// ─── Service functions ──────────────────────────────────────────────────────

/**
 * Fetch all commission distributions enriched with participant name,
 * operation code, installment details, and aggregated payment totals.
 */
export async function getDistributionsWithDetails(participantId?: string | null): Promise<DistributionWithDetails[]> {
  // Fetch distributions with joined data
  let query = supabase
    .from('commission_distributions')
    .select(`
      *,
      participant:participants(name, type),
      installment:commission_installments(
        installment_number,
        value,
        due_date,
        operation_id,
        operation:operations(id, code)
      )
    `)
    .order('created_at', { ascending: false })

  if (participantId) {
    query = query.eq('participant_id', participantId)
  }

  const { data: distributions, error: distError } = await query

  if (distError) throw distError

  // Fetch all payments to aggregate paid amounts per distribution
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('distribution_id, amount')

  if (payError) throw payError

  // Aggregate paid amounts by distribution_id
  const paidByDistribution = new Map<string, number>()
  for (const p of payments ?? []) {
    const current = paidByDistribution.get(p.distribution_id) ?? 0
    paidByDistribution.set(p.distribution_id, current + p.amount)
  }

  return (distributions ?? []).map((d) => {
    const installment = d.installment as Record<string, unknown>
    const operation = installment?.operation as Record<string, unknown>
    const participant = d.participant as Record<string, unknown>
    const paidAmount = paidByDistribution.get(d.id) ?? 0

    return {
      id: d.id,
      installment_id: d.installment_id,
      participant_id: d.participant_id,
      amount: d.value,
      status: d.status as DistributionStatus,
      created_at: d.created_at,
      updated_at: d.updated_at,
      participant_name: (participant?.name as string) ?? 'Desconhecido',
      participant_type: (participant?.type as string) ?? '',
      operation_id: (operation?.id as string) ?? '',
      operation_code: (operation?.code as string) ?? '',
      installment_number: (installment?.installment_number as number) ?? 0,
      installment_amount: (installment?.value as number) ?? 0,
      installment_due_date: (installment?.due_date as string | null) ?? null,
      paid_amount: paidAmount,
      pending_amount: (d.value ?? 0) - paidAmount,
    }
  })
}

/**
 * Fetch payments with details, optionally filtered by distribution ID.
 */
export async function getPayments(distributionId?: string): Promise<PaymentWithDetails[]> {
  let query = supabase
    .from('payments')
    .select(`
      *,
      distribution:commission_distributions(
        participant:participants(name),
        installment:commission_installments(
          operation:operations(code)
        )
      )
    `)
    .order('payment_date', { ascending: false })

  if (distributionId) {
    query = query.eq('distribution_id', distributionId)
  }

  const { data, error } = await query

  if (error) throw error

  return (data ?? []).map((p) => {
    const distribution = p.distribution as Record<string, unknown>
    const participant = distribution?.participant as Record<string, unknown>
    const installment = distribution?.installment as Record<string, unknown>
    const operation = installment?.operation as Record<string, unknown>

    return {
      id: p.id,
      distribution_id: p.distribution_id,
      amount: p.amount,
      payment_date: p.payment_date,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      created_at: p.created_at,
      participant_name: (participant?.name as string) ?? 'Desconhecido',
      operation_code: (operation?.code as string) ?? '',
    }
  })
}

/**
 * Fetch all payments for a specific participant.
 */
export async function getPaymentsByParticipant(participantId: string): Promise<PaymentWithDetails[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      distribution:commission_distributions!inner(
        participant_id,
        participant:participants(name),
        installment:commission_installments(
          operation:operations(code)
        )
      )
    `)
    .eq('distribution.participant_id', participantId)
    .order('payment_date', { ascending: false })

  if (error) throw error

  return (data ?? []).map((p) => {
    const distribution = p.distribution as Record<string, unknown>
    const participant = distribution?.participant as Record<string, unknown>
    const installment = distribution?.installment as Record<string, unknown>
    const operation = installment?.operation as Record<string, unknown>

    return {
      id: p.id,
      distribution_id: p.distribution_id,
      amount: p.amount,
      payment_date: p.payment_date,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      created_at: p.created_at,
      participant_name: (participant?.name as string) ?? 'Desconhecido',
      operation_code: (operation?.code as string) ?? '',
    }
  })
}

/**
 * Record a new payment for a distribution.
 * After inserting, updates the distribution status based on paid totals.
 */
export async function recordPayment(data: PaymentInsert): Promise<Payment> {
  const { data: payment, error } = await supabase
    .from('payments')
    .insert(data)
    .select()
    .single()

  if (error) throw error

  // Update distribution status based on total paid
  await updateDistributionStatus(data.distribution_id)

  return payment as Payment
}

/**
 * Delete a payment. Then recalculate distribution status.
 */
export async function deletePayment(id: string): Promise<void> {
  // Get distribution_id before deleting
  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('distribution_id')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  const distributionId = payment.distribution_id

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id)

  if (error) throw error

  // Recalculate distribution status
  await updateDistributionStatus(distributionId)
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Recalculate and update a distribution's status based on its total paid amount.
 */
async function updateDistributionStatus(distributionId: string): Promise<void> {
  // Get the distribution value
  const { data: dist, error: distError } = await supabase
    .from('commission_distributions')
    .select('value')
    .eq('id', distributionId)
    .single()

  if (distError) throw distError

  // Sum all payments for this distribution
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('amount')
    .eq('distribution_id', distributionId)

  if (payError) throw payError

  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0)
  const totalAmount = dist.value

  let newStatus: DistributionStatus
  if (totalPaid <= 0) {
    newStatus = 'pending'
  } else if (totalPaid >= totalAmount - 0.01) {
    newStatus = 'paid'
  } else {
    newStatus = 'partial'
  }

  const { error: updateError } = await supabase
    .from('commission_distributions')
    .update({ status: newStatus })
    .eq('id', distributionId)

  if (updateError) throw updateError
}
