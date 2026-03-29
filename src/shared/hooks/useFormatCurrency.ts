import { useCallback } from 'react'
import { formatCurrency } from '@/shared/utils/formatters'

/**
 * Returns a stable reference to the formatCurrency function.
 * Useful as a dependency in memoized computations or callbacks.
 */
export function useFormatCurrency() {
  return useCallback((value: number) => formatCurrency(value), [])
}
