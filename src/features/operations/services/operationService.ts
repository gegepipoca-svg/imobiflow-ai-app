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
import { generateInstallments } from './calculationEngine'

// ─── Client metadata stored in notes field as JSON prefix ──────────────────

export interface OperationClientData {
  client_name: string
  client_paid: boolean
}

export function parseClientData(notes: string | null): OperationClientData | null {
  if (!notes) return null
  try {
    if (notes.startsWith('{"client_')) {
      const endIdx = notes.indexOf('}') + 1
      return JSON.parse(notes.slice(0, endIdx)) as OperationClientData
    }
  } catch { /* ignore parse errors */ }
  return null
}

export function extractUserNotes(notes: string | null): string {
  if (!notes) return ''
  if (notes.startsWith('{"client_')) {
    const endIdx = notes.indexOf('}') + 1
    return notes.slice(endIdx).trim()
  }
  return notes
}

export function buildNotesWithClient(
  clientData: OperationClientData | null,
  userNotes: string,
): string {
  const parts: string[] = []
  if (clientData) {
    parts.push(JSON.stringify(clientData))
  }
  if (userNotes.trim()) {
    parts.push(userNotes.trim())
  }
  return parts.join(' ')
}

// ─── Extended types for joined queries ──────────────────────────────────────

export interface OperationWithCount extends Operation {
  participant_count: number
  client_name?: string
  client_paid?: boolean
  user_notes?: string
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

  return (data ?? []).map((row) => {
    const clientData = parseClientData(row.notes)
    return {
      ...row,
      participant_count: Array.isArray(row.operation_participants)
        ? row.operation_participants.length
        : 0,
      operation_participants: undefined,
      client_name: clientData?.client_name ?? '',
      client_paid: clientData?.client_paid ?? false,
      user_notes: extractUserNotes(row.notes),
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
 * Create an operation with all related data via direct inserts.
 * Does: operations → operation_participants → commission_installments → commission_distributions
 */
export async function createOperation(
  payload: CreateOperationPayload,
): Promise<Operation> {
  // 1. Insert operation
  const { data: operation, error: opError } = await supabase
    .from('operations')
    .insert({
      code: payload.code,
      credit_value: payload.credit_value,
      commission_model: payload.commission_model,
      product_type: payload.product_type,
      commission_rule_id: payload.commission_rule_id,
      operation_date: payload.operation_date,
      notes: payload.notes,
      status: payload.status,
    })
    .select()
    .single()

  if (opError) throw opError
  const operationId = operation.id as string

  try {
    // 2. Insert participants
    if (payload.participants.length > 0) {
      const { error: partError } = await supabase
        .from('operation_participants')
        .insert(
          payload.participants.map((p) => ({
            operation_id: operationId,
            participant_id: p.participant_id,
            percentage_share: p.percentage_share,
            role_in_operation: p.role_in_operation,
          })),
        )

      if (partError) throw partError
    }

    // 3. Generate and insert installments
    const generatedInstallments = generateInstallments(
      payload.credit_value,
      payload.installment_definitions,
    )

    // Apply commission_model to get the actual installment amount
    // The generateInstallments multiplies credit_value by percentage_of_credit,
    // but the commission installment amount should be credit * commission_model * percentage_of_credit
    const installmentRows = generatedInstallments.map((inst) => ({
      operation_id: operationId,
      installment_number: inst.installment_number,
      percentage_of_credit: inst.percentage_of_credit,
      amount:
        Math.round(
          payload.credit_value *
            payload.commission_model *
            inst.percentage_of_credit *
            100,
        ) / 100,
      due_date: inst.due_date,
      status: 'pending' as const,
    }))

    const { data: insertedInstallments, error: instError } = await supabase
      .from('commission_installments')
      .insert(installmentRows)
      .select()

    if (instError) throw instError

    // 4. Generate and insert distributions (installment × participant)
    const distributionRows: Array<{
      installment_id: string
      participant_id: string
      amount: number
      status: 'pending'
    }> = []

    for (const inst of insertedInstallments ?? []) {
      for (const p of payload.participants) {
        distributionRows.push({
          installment_id: inst.id as string,
          participant_id: p.participant_id,
          amount:
            Math.round(
              (inst.amount as number) * p.percentage_share * 100,
            ) / 100,
          status: 'pending',
        })
      }
    }

    if (distributionRows.length > 0) {
      const { error: distError } = await supabase
        .from('commission_distributions')
        .insert(distributionRows)

      if (distError) throw distError
    }

    return operation as Operation
  } catch (err) {
    // Rollback: delete the operation and cascade-delete related rows
    await supabase.from('operations').delete().eq('id', operationId)
    throw err
  }
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
 */
export async function updateOperationClient(
  id: string,
  clientData: OperationClientData,
): Promise<void> {
  // Get current notes to preserve user notes
  const { data: op, error: fetchError } = await supabase
    .from('operations')
    .select('notes')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError

  const userNotes = extractUserNotes(op.notes)
  const newNotes = buildNotesWithClient(clientData, userNotes)

  const { error } = await supabase
    .from('operations')
    .update({ notes: newNotes })
    .eq('id', id)

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
