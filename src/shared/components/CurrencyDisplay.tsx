import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/formatters'

interface CurrencyDisplayProps {
  value: number
  className?: string
}

export function CurrencyDisplay({ value, className }: CurrencyDisplayProps) {
  return (
    <span className={cn('tabular-nums', className)}>
      {formatCurrency(value)}
    </span>
  )
}
