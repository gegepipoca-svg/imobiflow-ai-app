import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getOperations,
  getOperation,
  createOperation,
  updateOperationStatus,
  updateOperationClient,
  deleteOperation,
  type CreateOperationPayload,
  type OperationClientData,
} from '../services/operationService'
import type { OperationStatus } from '@/shared/types'

const OPERATIONS_KEY = ['operations'] as const

export function useOperations(participantId?: string | null) {
  return useQuery({
    queryKey: [...OPERATIONS_KEY, { participantId }],
    queryFn: () => getOperations(participantId),
  })
}

export function useOperation(id: string | undefined) {
  return useQuery({
    queryKey: [...OPERATIONS_KEY, id],
    queryFn: () => getOperation(id!),
    enabled: !!id,
  })
}

export function useCreateOperation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateOperationPayload) => createOperation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OPERATIONS_KEY })
      toast.success('Operação criada com sucesso.')
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar operação.', {
        description: error.message,
      })
    },
  })
}

export function useUpdateOperationStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OperationStatus }) =>
      updateOperationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OPERATIONS_KEY })
      toast.success('Status da operação atualizado.')
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status.', {
        description: error.message,
      })
    },
  })
}

export function useUpdateOperationClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, clientData }: { id: string; clientData: OperationClientData }) =>
      updateOperationClient(id, clientData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OPERATIONS_KEY })
      toast.success('Dados do cliente atualizados.')
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar dados do cliente.', {
        description: error.message,
      })
    },
  })
}

export function useDeleteOperation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteOperation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OPERATIONS_KEY })
      toast.success('Operação excluída com sucesso.')
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir operação.', {
        description: error.message,
      })
    },
  })
}
