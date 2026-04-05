import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { CurrencyDisplay } from '@/shared/components/CurrencyDisplay'
import { formatDate } from '@/shared/utils/formatters'
import { PRODUCT_TYPE_LABELS } from '@/shared/utils/constants'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useOperations } from '../hooks/useOperations'
import type { OperationWithCount } from '../services/operationService'
import type { ProductType } from '@/shared/types'

export default function OperationsListPage() {
  const navigate = useNavigate()
  const { isAdmin, isConsultor, participantId } = useAuth()
  const { data: operations = [], isLoading } = useOperations(
    isConsultor ? participantId : undefined
  )

  const columns: DataTableColumn<OperationWithCount & Record<string, unknown>>[] = [
    {
      key: 'code',
      header: 'Codigo',
      sortable: true,
    },
    {
      key: 'operation_date',
      header: 'Data',
      sortable: true,
      cell: (row) => formatDate(row.operation_date as string),
    },
    {
      key: 'product_type',
      header: 'Tipo Produto',
      cell: (row) =>
        PRODUCT_TYPE_LABELS[row.product_type as ProductType] ??
        (row.product_type as string),
    },
    {
      key: 'credit_value',
      header: 'Credito',
      sortable: true,
      cell: (row) => <CurrencyDisplay value={row.credit_value as number} />,
    },
    {
      key: 'commission_total',
      header: 'Comissao Total',
      sortable: true,
      cell: (row) => <CurrencyDisplay value={row.commission_total as number} />,
    },
    {
      key: 'participant_count',
      header: 'Participantes',
      cell: (row) => (row.participant_count as number) ?? 0,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusBadge status={row.status as string} type="operation" />
      ),
    },
    {
      key: '_actions',
      header: '',
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/operations/${row.id}`)
          }}
        >
          Ver
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={isConsultor ? "Minhas Operações" : "Operações"}
        description={isConsultor ? "Acompanhe suas operações e comissões" : "Gerenciar operações e comissões"}
        action={
          isAdmin ? (
            <Button onClick={() => navigate('/operations/new')}>
              <Plus className="size-4" />
              Nova Operação
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={operations as unknown as (OperationWithCount & Record<string, unknown>)[]}
        searchable
        searchKey="code"
        pagination
        pageSize={10}
        loading={isLoading}
        emptyMessage="Nenhuma operacao encontrada."
      />
    </div>
  )
}
