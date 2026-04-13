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

// ─── Client metadata (now stored in real columns: client_name, client_paid) ─

export interface OperationClientData {
  client_name: string
  client_paid: boolean
}

// ─── Extended types for joined queries ──────────────────────────────────────

export interface OperationWithCount extends Operation {
  participant_count: number
  client_name: string | null
  client_paid: boolean
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
  client_name?: string | null
  client_paid?: boolean
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

  return (data ?? []).map((row) => {
    const { operation_participants, ...rest } = row as Record<string, unknown> & {
      operation_participants?: unknown[]
    }
    return {
      ...rest,
      participant_count: Array.isArray(operation_participants)
        ? operation_participants.length
        : 0,
    }
  }) as unknown as OperationWithCount[]
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
 * Create an operation atomically via the SQL RPC.
 * All inserts (operations + participants + installments + distributions) run
 * in a single DB transaction; any failure rolls back everything.
 */
export async function createOperation(
  payload: CreateOperationPayload & { client_name?: string | null; client_paid?: boolean },
): Promise<Operation> {
  const installments = payload.installment_definitions.map((def) => ({
    number: def.number,
    percentage_of_credit: def.percentage_of_credit,
  }))

  const rpcParams = {
    code: payload.code,
    credit_value: payload.credit_value,
    commission_model: payload.commission_model,
    product_type: payload.product_type,
    commission_rule_id: payload.commission_rule_id,
    operation_date: payload.operation_date,
    notes: payload.notes,
    status: payload.status,
    client_name: payload.client_name ?? null,
    client_paid: payload.client_paid ?? false,
    participants: payload.participants.map((p) => ({
      participant_id: p.participant_id,
      percentage_share: p.percentage_share,
      role_in_operation: p.role_in_operation,
    })),
    installments,
  }

  const { data: newId, error: rpcError } = await supabase.rpc(
    'create_operation_with_distributions',
    { params: rpcParams },
  )
  if (rpcError) throw rpcError
  if (!newId) throw new Error('RPC create_operation_with_distributions não retornou ID')

  // Return the created row
  const { data: created, error: fetchError } = await supabase
    .from('operations')
    .select('*')
    .eq('id', newId)
    .single()

  if (fetchError) throw fetchError
  return created as Operation
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
 * Update client data (name + payment status) on an operation.
 * Uses the real client_name and client_paid columns (ALTER from 2026-04-11).
 */
export async function updateOperationClient(
  id: string,
  clientData: OperationClientData,
): Promise<void> {
  const { error } = await supabase
    .from('operations')
    .update({
      client_name: clientData.client_name || null,
      client_paid: clientData.client_paid,
    })
    .eq('id', id)

  if (error) throw error
}

/**
 * Reverse (estornar) an entire operation atomically.
 * Sets operation, installments, and distributions all to 'reversed' and zeroes
 * paid amounts. Only admin/manager allowed (enforced by RPC).
 */
export async function reverseOperation(id: string): Promise<void> {
  const { error } = await supabase.rpc('reverse_operation', { p_operation_id: id })
  if (error) throw error
}

/**
 * Update the due date (payment date) of a specific installment.
 */
export async function updateInstallmentDueDate(
  installmentId: string,
  dueDate: string,
): Promise<void> {
  const { error } = await supabase
    .from('commission_installments')
    .update({ due_date: dueDate })
    .eq('id', installmentId)

  if (error) throw error
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
