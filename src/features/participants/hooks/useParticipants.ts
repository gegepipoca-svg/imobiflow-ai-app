import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getParticipants,
  getParticipant,
  createParticipant,
  updateParticipant,
  deleteParticipant,
} from '../services/participantService'
import type { ParticipantFormValues } from '@/shared/utils/validators'

const PARTICIPANTS_KEY = ['participants'] as const

export function useParticipants() {
  return useQuery({
    queryKey: PARTICIPANTS_KEY,
    queryFn: getParticipants,
  })
}

export function useParticipant(id: string | undefined) {
  return useQuery({
    queryKey: [...PARTICIPANTS_KEY, id],
    queryFn: () => getParticipant(id!),
    enabled: !!id,
  })
}

export function useCreateParticipant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ParticipantFormValues) => createParticipant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARTICIPANTS_KEY })
      toast.success('Participante criado com sucesso.')
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar participante.', {
        description: error.message,
      })
    },
  })
}

export function useUpdateParticipant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<ParticipantFormValues> & { is_active?: boolean }
    }) => updateParticipant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARTICIPANTS_KEY })
      toast.success('Participante atualizado com sucesso.')
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar participante.', {
        description: error.message,
      })
    },
  })
}

export function useDeleteParticipant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteParticipant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARTICIPANTS_KEY })
      toast.success('Participante excluído com sucesso.')
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir participante.', {
        description: error.message,
      })
    },
  })
}
