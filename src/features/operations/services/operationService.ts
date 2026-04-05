import { supabase } from '@/lib/supabase'
import type {
  Operation,
  OperationStatus,
  InstallmentDefinition,
  CommissionInstallment,
  CommissionDistribution,
  OperationParticipant,
  Participant,
} from '@/shared/types'

// ─── Extended types for joined queries ──────────────────────────────────────

export interface OperationWithCount extends Operation {
  participant_count: number
}

export interface OperationParticipantWithName extends OperationParticipant {
  participant: Pick<Participant, 'name' | 'type'>
}

export interface CommissionDistributionWithParticipant extends CommissionDistribution {
  participant: Pick<Participant, 'name' | 'type'>
}

export interface OperationDetail extends Operation {
  participants: OperationParticipantWithName[]
  installments: (CommissionInstallment & {
    distributions: CommissionDistributionWithParticipant[]
  })[]
}

// ─── Payload for creating operations ────────────────────────────────────────

export interface CreateOperationPayload {
  code: string
  credit_value: number
  commission_model: number
  product_type: string
  commission_rule_id: string | null
  operation_date: string
  notes: string | null
  status: OperationStatus
  participants: Array<{
    participant_id: string
    percentage_share: number
    role_in_operation: string | null
  }>
  installment_definitions: InstallmentDefinition[]
}

// ─── Service functions ──────────────────────────────────────────────────────

/**
 * Fetch all operations ordered by date DESC, with participant count.
 * If participantId is provided, only returns operations where that participant is involved.
 */
export async function getOperations(participantId?: string | null): Promise<OperationWithCount[]> {
  let operationIds: string[] | null = null;

  // If filtering by participant, first get their operation IDs
  if (participantId) {
    const { data: opParts, error: opPartsError } = await supabase
      .from('operation_participants')
      .select('operation_id')
      .eq('participant_id', participantId)

    if (opPartsError) throw opPartsError
    operationIds = (opParts ?? []).map((op) => op.operation_id)

    // If no operations found, return empty
    if (operationIds.length === 0) return []
  }

  let query = supabase
    .from('operations')
    .select('*, operation_participants(id)')
    .order('operation_date', { ascending: false })

  if (operationIds) {
    query = query.in('id', operationIds)
  }

  const { data, error } = await query

  if (error) throw error

  return (data ?? []).map((row) => ({
    ...row,
    participant_count: Array.isArray(row.operation_participants)
      ? row.operation_participants.length
      : 0,
    operation_participants: undefined,
  })) as unknown as OperationWithCount[]
}

/**
 * Fetch single operation with all related data: participants (with names),
 * installments, and distributions (with participant names).
 */
export async function getOperation(id: string): Promise<OperationDetail> {
  const { data: operation, error: opError } = await supabase
    .from('operations')
    .select('*')
    .eq('id', id)
    .single()

  if (opError) throw opError

  // Fetch participants with names
  const { data: participants, error: partError } = await supabase
    .from('operation_participants')
    .select('*, participant:participants(name, type)')
    .eq('operation_id', id)
    .order('created_at')

  if (partError) throw partError

  // Fetch installments
  const { data: installments, error: instError } = await supabase
    .from('commission_installments')
    .select('*')
    .eq('operation_id', id)
    .order('installment_number')

  if (instError) throw instError

  // Fetch distributions with participant names
  const installmentIds = (installments ?? []).map((i) => i.id)
  let distributions: CommissionDistributionWithParticipant[] = []

  if (installmentIds.length > 0) {
    const { data: distData, error: distError } = await supabase
      .from('commission_distributions')
      .select('*, participant:participants(name, type)')
      .in('installment_id', installmentIds)
      .order('created_at')

    if (distError) throw distError
    distributions = (distData ?? []) as unknown as CommissionDistributionWithParticipant[]
  }

  // Group distributions by installment
  const distByInstallment = new Map<string, CommissionDistributionWithParticipant[]>()
  for (const dist of distributions) {
    const list = distByInstallment.get(dist.installment_id) ?? []
    list.push(dist)
    distByInstallment.set(dist.installment_id, list)
  }

  return {
    ...operation,
    participants: (participants ?? []) as unknown as OperationParticipantWithName[],
    installments: (installments ?? []).map((inst) => ({
      ...inst,
      distributions: distByInstallment.get(inst.id) ?? [],
    })),
  } as OperationDetail
}

/**
 * Create an operation with all related data via Supabase RPC.
 */
export async function createOperation(
  payload: CreateOperationPayload,
): Promise<Operation> {
  const { data, error } = await supabase.rpc('create_operation_with_distributions', {
    p_code: payload.code,
    p_credit_value: payload.credit_value,
    p_commission_model: payload.commission_model,
    p_product_type: payload.product_type,
    p_commission_rule_id: payload.commission_rule_id,
    p_operation_date: payload.operation_date,
    p_notes: payload.notes,
    p_status: payload.status,
    p_participants: payload.participants,
    p_installment_definitions: payload.installment_definitions,
  })

  if (error) throw error
  return data as Operation
}

/**
 * Update operation status.
 */
export async function updateOperationStatus(
  id: string,
  status: OperationStatus,
): Promise<Operation> {
  const { data, error } = await supabase
    .from('operations')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Operation
}

/**
 * Delete an operation (only drafts).
 */
export async function deleteOperation(id: string): Promise<void> {
  // First verify it's a draft
  const { data: op, error: fetchError } = await supabase
    .from('operations')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError
  if (op.status !== 'draft') {
    throw new Error('Apenas operações em rascunho podem ser excluídas.')
  }

  // Delete distributions first (FK constraint)
  const { data: installments } = await supabase
    .from('commission_installments')
    .select('id')
    .eq('operation_id', id)

  if (installments && installments.length > 0) {
    const instIds = installments.map((i) => i.id)
    const { error: distError } = await supabase
      .from('commission_distributions')
      .delete()
      .in('installment_id', instIds)
    if (distError) throw distError
  }

  // Delete installments
  const { error: instError } = await supabase
    .from('commission_installments')
    .delete()
    .eq('operation_id', id)
  if (instError) throw instError

  // Delete participants
  const { error: partError } = await supabase
    .from('operation_participants')
    .delete()
    .eq('operation_id', id)
  if (partError) throw partError

  // Delete operation
  const { error } = await supabase
    .from('operations')
    .delete()
    .eq('id', id)

  if (error) throw error
}
