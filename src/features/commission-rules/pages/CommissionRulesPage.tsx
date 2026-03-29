import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { formatPercentage } from '@/shared/utils/formatters'
import { PRODUCT_TYPE_LABELS } from '@/shared/utils/constants'
import type { CommissionRule } from '@/shared/types'
import {
  useCommissionRules,
  useDeleteCommissionRule,
} from '../hooks/useCommissionRules'

export default function CommissionRulesPage() {
  const navigate = useNavigate()
  const { data: rules = [], isLoading } = useCommissionRules()
  const deleteMutation = useDeleteCommissionRule()

  const [deleteTarget, setDeleteTarget] = useState<CommissionRule | null>(null)

  function handleDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  const columns: DataTableColumn<CommissionRule>[] = [
    {
      key: 'name',
      header: 'Nome',
      sortable: true,
    },
    {
      key: 'product_type',
      header: 'Tipo Produto',
      sortable: true,
      cell: (row) => PRODUCT_TYPE_LABELS[row.product_type],
    },
    {
      key: 'commission_model',
      header: 'Modelo Comissão',
      sortable: true,
      cell: (row) => formatPercentage(row.commission_model),
    },
    {
      key: 'installments',
      header: 'N.o Parcelas',
      cell: (row) => row.installments?.length ?? 0,
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.is_active ? 'default' : 'secondary'}>
          {row.is_active ? 'Ativa' : 'Inativa'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/commission-rules/${row.id}/edit`)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regras de Comissão"
        description="Gerencie as regras de comissão por tipo de produto"
        action={
          <Button onClick={() => navigate('/commission-rules/new')}>
            <Plus className="size-4" />
            Nova Regra
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rules}
        searchable
        searchKey="name"
        pagination
        pageSize={10}
        loading={isLoading}
        emptyMessage="Nenhuma regra de comissão cadastrada."
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir Regra de Comissão"
        description={`Tem certeza que deseja excluir a regra "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmText="Excluir"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
