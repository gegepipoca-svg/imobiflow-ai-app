import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { PARTICIPANT_TYPE_LABELS } from '@/shared/utils/constants'
import { useParticipants, useDeleteParticipant } from '../hooks/useParticipants'
import type { ParticipantWithParent } from '../services/participantService'

export default function ParticipantsListPage() {
  const { data: participants = [], isLoading } = useParticipants()
  const deleteMutation = useDeleteParticipant()

  const [deleteTarget, setDeleteTarget] = useState<ParticipantWithParent | null>(null)

  function handleDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    })
  }

  const columns: DataTableColumn<ParticipantWithParent>[] = [
    {
      key: 'name',
      header: 'Nome',
      sortable: true,
      cell: (row) => (
        <Link
          to={`/participants/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      cell: (row) => (
        <Badge variant="secondary">
          {PARTICIPANT_TYPE_LABELS[row.type]}
        </Badge>
      ),
    },
    {
      key: 'document',
      header: 'Documento',
      cell: (row) => row.document ?? '-',
    },
    {
      key: 'email',
      header: 'E-mail',
      cell: (row) => row.email ?? '-',
    },
    {
      key: 'phone',
      header: 'Telefone',
      cell: (row) => row.phone ?? '-',
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.is_active ? 'default' : 'outline'}>
          {row.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Link to={`/participants/${row.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
            <Eye className="size-4" />
          </Link>
          <Link to={`/participants/${row.id}/edit`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
            <Pencil className="size-4" />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
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
        title="Participantes"
        description="Gerencie consultores, parceiros, escritórios e intermediários."
        action={
          <Link to="/participants/new" className={buttonVariants()}>
            <Plus className="size-4" />
            Novo Participante
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={participants}
        searchable
        searchKey="name"
        pagination
        loading={isLoading}
        emptyMessage="Nenhum participante encontrado."
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Excluir participante"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmText="Excluir"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
