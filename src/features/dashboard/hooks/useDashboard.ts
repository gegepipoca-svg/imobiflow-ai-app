import { useQuery } from '@tanstack/react-query'
import {
  getDashboardKpis,
  getCommissionByParticipant,
  getCommissionByProductType,
  getMonthlyEvolution,
  getParticipantRanking,
  getFutureFlow,
} from '../services/dashboardService'

const DASHBOARD_KEY = ['dashboard'] as const

export function useDashboardKpis(participantId?: string | null) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'kpis', { participantId }],
    queryFn: () => getDashboardKpis(participantId),
  })
}

export function useCommissionByParticipant() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'commission-by-participant'],
    queryFn: getCommissionByParticipant,
  })
}

export function useCommissionByProductType() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'commission-by-product-type'],
    queryFn: getCommissionByProductType,
  })
}

export function useMonthlyEvolution() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'monthly-evolution'],
    queryFn: getMonthlyEvolution,
  })
}

export function useParticipantRanking() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'participant-ranking'],
    queryFn: getParticipantRanking,
  })
}

export function useFutureFlow() {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'future-flow'],
    queryFn: getFutureFlow,
  })
}
