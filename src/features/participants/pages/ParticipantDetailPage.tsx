import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { PARTICIPANT_TYPE_LABELS } from '@/shared/utils/constants'
import { formatDate } from '@/shared/utils/formatters'
import { useParticipant, useDeleteParticipant } from '../hooks/useParticipants'

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

export default function ParticipantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: participant, isLoading, isError } = useParticipant(id)
  const deleteMutation = useDeleteParticipant()
  const [showDelete, setShowDelete] = useState(false)

  function handleDelete() {
    if (!id) return
    deleteMutation.mutate(id, {
      onSuccess: () => navigate('/participants'),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !participant) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Participante não encontrado"
          action={
            <Link to="/participants" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          }
        />
        <Card>
          <CardContent>
            <p className="text-muted-foreground">
              O participante solicitado não foi encontrado ou ocorreu um erro ao carregar os dados.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={participant.name}
        description="Detalhes do participante"
        action={
          <div className="flex items-center gap-2">
            <Link to="/participants" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
            <Link to={`/participants/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil className="size-4" />
              Editar
            </Link>
            <button type="button" className={buttonVariants({ variant: "destructive" })} onClick={() => setShowDelete(true)}>
              <Trash2 className="size-4" />
              Excluir
            </button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Nome">{participant.name}</DetailRow>

            <DetailRow label="Tipo">
              <Badge variant="secondary">
                {PARTICIPANT_TYPE_LABELS[participant.type]}
              </Badge>
            </DetailRow>

            <DetailRow label="Status">
              <Badge variant={participant.is_active ? 'default' : 'outline'}>
                {participant.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
            </DetailRow>

            <DetailRow label="Documento">
              {participant.document ?? '-'}
            </DetailRow>

            <DetailRow label="E-mail">
              {participant.email ?? '-'}
            </DetailRow>

            <DetailRow label="Telefone">
              {participant.phone ?? '-'}
            </DetailRow>

            <DetailRow label="Participante Pai">
              {participant.parent_name ? (
                <Link
                  to={`/participants/${participant.parent_id}`}
                  className="text-primary hover:underline"
                >
                  {participant.parent_name}
                </Link>
              ) : (
                '-'
              )}
            </DetailRow>

            <DetailRow label="Criado em">
              {formatDate(participant.created_at)}
            </DetailRow>

            <DetailRow label="Atualizado em">
              {formatDate(participant.updated_at)}
            </DetailRow>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Excluir participante"
        description={`Tem certeza que deseja excluir "${participant.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        confirmText="Excluir"
        variant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
