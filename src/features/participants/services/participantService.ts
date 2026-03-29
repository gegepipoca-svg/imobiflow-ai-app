import { supabase } from '@/lib/supabase'
import type { Participant } from '@/shared/types'
import type { ParticipantFormValues } from '@/shared/utils/validators'

export interface ParticipantWithParent extends Participant {
  parent_name: string | null
}

/**
 * Fetch all participants ordered by name, with parent name joined.
 */
export async function getParticipants(): Promise<ParticipantWithParent[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*, parent:participants!parent_id(name)')
    .order('name')

  if (error) throw error

  return (data ?? []).map((row) => ({
    ...row,
    parent_name: (row.parent as { name: string } | null)?.name ?? null,
  })) as ParticipantWithParent[]
}

/**
 * Fetch a single participant by ID with parent info.
 */
export async function getParticipant(id: string): Promise<ParticipantWithParent> {
  const { data, error } = await supabase
    .from('participants')
    .select('*, parent:participants!parent_id(name)')
    .eq('id', id)
    .single()

  if (error) throw error

  return {
    ...data,
    parent_name: (data.parent as { name: string } | null)?.name ?? null,
  } as ParticipantWithParent
}

/**
 * Create a new participant.
 */
export async function createParticipant(
  values: ParticipantFormValues,
): Promise<Participant> {
  const { data, error } = await supabase
    .from('participants')
    .insert({
      name: values.name,
      type: values.type,
      document: values.document || null,
      email: values.email || null,
      phone: values.phone || null,
      parent_id: values.parent_id || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Participant
}

/**
 * Update an existing participant.
 */
export async function updateParticipant(
  id: string,
  values: Partial<ParticipantFormValues> & { is_active?: boolean },
): Promise<Participant> {
  const payload: Record<string, unknown> = {}

  if (values.name !== undefined) payload.name = values.name
  if (values.type !== undefined) payload.type = values.type
  if (values.document !== undefined) payload.document = values.document || null
  if (values.email !== undefined) payload.email = values.email || null
  if (values.phone !== undefined) payload.phone = values.phone || null
  if (values.parent_id !== undefined) payload.parent_id = values.parent_id || null
  if (values.is_active !== undefined) payload.is_active = values.is_active

  const { data, error } = await supabase
    .from('participants')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Participant
}

/**
 * Delete a participant by ID.
 */
export async function deleteParticipant(id: string): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', id)

  if (error) throw error
}

/**
 * Fetch participants filtered by type.
 */
export async function getParticipantsByType(
  type: Participant['type'],
): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('type', type)
    .order('name')

  if (error) throw error
  return (data ?? []) as Participant[]
}
