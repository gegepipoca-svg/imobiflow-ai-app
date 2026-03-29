import { cn } from '@/lib/utils'
import type { OperationStatus, InstallmentStatus, DistributionStatus } from '@/shared/types'
import {
  OPERATION_STATUS_LABELS,
  OPERATION_STATUS_COLORS,
  INSTALLMENT_STATUS_LABELS,
  INSTALLMENT_STATUS_COLORS,
  DISTRIBUTION_STATUS_LABELS,
  DISTRIBUTION_STATUS_COLORS,
} from '@/shared/utils/constants'

type StatusType = 'operation' | 'installment' | 'distribution'

interface StatusBadgeProps {
  status: string
  type: StatusType
  className?: string
}

const labelMaps: Record<StatusType, Record<string, string>> = {
  operation: OPERATION_STATUS_LABELS,
  installment: INSTALLMENT_STATUS_LABELS,
  distribution: DISTRIBUTION_STATUS_LABELS,
}

const colorMaps: Record<StatusType, Record<string, string>> = {
  operation: OPERATION_STATUS_COLORS,
  installment: INSTALLMENT_STATUS_COLORS,
  distribution: DISTRIBUTION_STATUS_COLORS,
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const label = labelMaps[type][status as OperationStatus | InstallmentStatus | DistributionStatus] ?? status
  const color = colorMaps[type][status as OperationStatus | InstallmentStatus | DistributionStatus] ?? 'bg-muted text-muted-foreground'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        color,
        className
      )}
    >
      {label}
    </span>
  )
}
