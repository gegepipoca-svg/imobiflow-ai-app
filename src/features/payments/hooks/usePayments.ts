import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PaymentFormValues } from '@/shared/utils/validators'
import {
  getDistributionsWithDetails,
  getPayments,
  recordPayment,
  deletePayment,
} from '../services/paymentService'

const DISTRIBUTIONS_KEY = ['distributions'] as const
const PAYMENTS_KEY = ['payments'] as const

export function useDistributions() {
  return useQuery({
    queryKey: DISTRIBUTIONS_KEY,
    queryFn: getDistributionsWithDetails,
  })
}

export function usePayments(distributionId?: string) {
  return useQuery({
    queryKey: distributionId ? [...PAYMENTS_KEY, distributionId] : PAYMENTS_KEY,
    queryFn: () => getPayments(distributionId),
  })
}

export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: PaymentFormValues) =>
      recordPayment({
        distribution_id: data.distribution_id,
        amount: data.amount,
        payment_date: data.payment_date,
        method: data.method,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISTRIBUTIONS_KEY })
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY })
      toast.success('Pagamento registrado com sucesso.')
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar pagamento.', {
        description: error.message,
      })
    },
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISTRIBUTIONS_KEY })
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY })
      toast.success('Pagamento excluido com sucesso.')
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir pagamento.', {
        description: error.message,
      })
    },
  })
}
