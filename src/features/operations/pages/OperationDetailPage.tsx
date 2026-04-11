import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  CreditCard,
  Hash,
  RefreshCw,
  User,
  CheckCircle2,
  Clock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

import { PageHeader } from '@/shared/components/PageHeader'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { CurrencyDisplay } from '@/shared/components/CurrencyDisplay'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import {
  formatCurrency,
  formatPercentage,
  formatDate,
} from '@/shared/utils/formatters'
import {
  PRODUCT_TYPE_LABELS,
  OPERATION_STATUS_LABELS,
  PARTICIPANT_TYPE_LABELS,
} from '@/shared/utils/constants'
import type { OperationStatus, ProductType, ParticipantType } from '@/shared/types'

import { Input } from '@/components/ui/input'
import {
  useOperation,
  useUpdateOperationStatus,
  useUpdateOperationClient,
  useUpdateInstallmentDueDate,
  useDeleteOperation,
} from '../hooks/useOperations'
import {
  parseClientData,
  extractUserNotes,
} from '../services/operationService'

// ─── Valid status transitions ───────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<OperationStatus, OperationStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['completed', 'cancelled', 'reversed'],
  completed: ['reversed'],
  cancelled: [],
  reversed: [],
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OperationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: operation, isLoading, error } = useOperation(id)
  const updateStatus = useUpdateOperationStatus()
  const updateClient = useUpdateOperationClient()
  const updateDueDate = useUpdateInstallmentDueDate()
  const deleteOp = useDeleteOperation()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<OperationStatus | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  if (error || !operation) {
    return (
      <div className="space-y-6">
        <PageHeader title="Operacao nao encontrada" />
        <Button variant="outline" onClick={() => navigate('/operations')}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
      </div>
    )
  }

  const isDraft = operation.status === 'draft'
  const allowedTransitions = STATUS_TRANSITIONS[operation.status as OperationStatus] ?? []

  function handleStatusChange(newStatus: string | null) {
    if (!newStatus) return
    setPendingStatus(newStatus as OperationStatus)
    setStatusDialogOpen(true)
  }

  async function confirmStatusChange() {
    if (!pendingStatus || !id) return
    await updateStatus.mutateAsync({ id, status: pendingStatus })
    setStatusDialogOpen(false)
    setPendingStatus(null)
  }

  async function confirmDelete() {
    if (!id) return
    await deleteOp.mutateAsync(id)
    navigate('/operations')
  }

  const clientData = parseClientData(operation.notes)
  const userNotes = extractUserNotes(operation.notes)

  async function toggleClientPaid() {
    if (!id || !clientData) return
    await updateClient.mutateAsync({
      id,
      clientData: { ...clientData, client_paid: !clientData.client_paid },
    })
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <PageHeader
        title={`Operacao ${operation.code}`}
        description={`Criada em ${formatDate(operation.created_at)}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/operations')}>
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/operations/${id}/edit`)}
                >
                  <Edit className="size-4" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Excluir
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ─── Status bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          <StatusBadge status={operation.status} type="operation" />
        </div>

        {allowedTransitions.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <RefreshCw className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Alterar para:</span>
              <Select onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {allowedTransitions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {OPERATION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* ─── Client info card ───────────────────────────────────────── */}
      {clientData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Nome do Cliente</p>
                <p className="text-sm font-medium">{clientData.client_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pagamento do Cliente</p>
                <div className="flex items-center gap-2">
                  {clientData.client_paid ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="size-4" /> Pago
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Clock className="size-4" /> Pendente
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleClientPaid}
                    disabled={updateClient.isPending}
                  >
                    {clientData.client_paid ? 'Marcar como Pendente' : 'Marcar como Pago'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Basic info card ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Informacoes da Operacao</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              icon={<Hash className="size-4" />}
              label="Codigo"
              value={operation.code}
            />
            <InfoItem
              icon={<Calendar className="size-4" />}
              label="Data da Operacao"
              value={formatDate(operation.operation_date)}
            />
            <InfoItem
              icon={<CreditCard className="size-4" />}
              label="Tipo de Produto"
              value={
                PRODUCT_TYPE_LABELS[operation.product_type as ProductType] ??
                operation.product_type
              }
            />
            <InfoItem
              label="Modelo de Comissao"
              value={formatPercentage(operation.commission_model)}
            />
            <InfoItem
              label="Valor do Credito"
              value={formatCurrency(operation.credit_value)}
              highlight
            />
            <InfoItem
              label="Comissao Total"
              value={formatCurrency(operation.commission_total)}
              highlight
            />
            {userNotes && (
              <div className="col-span-full">
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="text-sm">{userNotes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Participants card ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Participantes</CardTitle>
          <CardDescription>
            {operation.participants.length} participante(s) nesta operacao
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Funcao</TableHead>
                  <TableHead className="text-right">Participacao</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operation.participants.map((p) => {
                  const totalValue =
                    operation.commission_total * p.percentage_share
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.participant?.name ?? p.participant_id}
                      </TableCell>
                      <TableCell>
                        {PARTICIPANT_TYPE_LABELS[
                          p.participant?.type as ParticipantType
                        ] ?? p.participant?.type}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.role_in_operation ?? '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercentage(p.percentage_share)}
                      </TableCell>
                      <TableCell className="text-right">
                        <CurrencyDisplay value={totalValue} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Installments card ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
          <CardDescription>
            {operation.installments.length} parcela(s) de comissao
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">No.</TableHead>
                  <TableHead>% Credito</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data de Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operation.installments.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">
                      {inst.installment_number}
                    </TableCell>
                    <TableCell>
                      {formatPercentage(inst.percentage_of_credit)}
                    </TableCell>
                    <TableCell>
                      <CurrencyDisplay value={inst.amount} />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={inst.due_date ?? ''}
                        disabled={updateDueDate.isPending}
                        onChange={(e) => {
                          const newDate = e.target.value
                          if (newDate && newDate !== inst.due_date) {
                            updateDueDate.mutate({
                              installmentId: inst.id,
                              dueDate: newDate,
                            })
                          }
                        }}
                        className="h-8 w-[160px]"
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inst.status} type="installment" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Distributions card ──────────────────────────────────────── */}
      {operation.installments.some((i) => i.distributions.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuicoes</CardTitle>
            <CardDescription>
              Detalhamento de valores por participante e parcela
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operation.installments.flatMap((inst) =>
                    inst.distributions.map((dist) => (
                      <TableRow key={dist.id}>
                        <TableCell className="font-medium">
                          {dist.participant?.name ?? dist.participant_id}
                        </TableCell>
                        <TableCell>{inst.installment_number}</TableCell>
                        <TableCell className="text-right">
                          <CurrencyDisplay value={dist.amount} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={dist.status}
                            type="distribution"
                          />
                        </TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Dialogs ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Operacao"
        description={`Tem certeza que deseja excluir a operacao ${operation.code}? Esta acao nao pode ser desfeita.`}
        onConfirm={confirmDelete}
        confirmText="Excluir"
        variant="destructive"
        loading={deleteOp.isPending}
      />

      <ConfirmDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title="Alterar Status"
        description={`Deseja alterar o status da operacao ${operation.code} para "${pendingStatus ? OPERATION_STATUS_LABELS[pendingStatus] : ''}"?`}
        onConfirm={confirmStatusChange}
        confirmText="Confirmar"
        loading={updateStatus.isPending}
      />
    </div>
  )
}

// ─── Info item helper ───────────────────────────────────────────────────────

function InfoItem({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p
        className={`text-sm ${highlight ? 'font-semibold text-primary' : 'font-medium'}`}
      >
        {value}
      </p>
    </div>
  )
}
