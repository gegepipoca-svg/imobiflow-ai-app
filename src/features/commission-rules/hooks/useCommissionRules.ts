import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CommissionRuleInsert, CommissionRuleUpdate } from '@/shared/types'
import {
  getCommissionRules,
  getCommissionRule,
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
} from '../services/commissionRuleService'

const QUERY_KEY = 'commission-rules'

export function useCommissionRules() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: getCommissionRules,
  })
}

export function useCommissionRule(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => getCommissionRule(id!),
    enabled: !!id,
  })
}

export function useCreateCommissionRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CommissionRuleInsert) => createCommissionRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      toast.success('Regra de comissão criada com sucesso.')
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar regra: ${error.message}`)
    },
  })
}

export function useUpdateCommissionRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CommissionRuleUpdate }) =>
      updateCommissionRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      toast.success('Regra de comissão atualizada com sucesso.')
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar regra: ${error.message}`)
    },
  })
}

export function useDeleteCommissionRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteCommissionRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      toast.success('Regra de comissão excluída com sucesso.')
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir regra: ${error.message}`)
    },
  })
}
