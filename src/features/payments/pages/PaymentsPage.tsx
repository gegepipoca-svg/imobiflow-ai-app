import { useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  DollarSign,
  History,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { CurrencyDisplay } from '@/shared/components/CurrencyDisplay'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { formatCurrency, formatDate } from '@/shared/utils/formatters'
import { paymentSchema, type PaymentFormValues } from '@/shared/utils/validators'
import {
  PAYMENT_METHOD_LABELS,
  DISTRIBUTION_STATUS_LABELS,
  PARTICIPANT_TYPE_LABELS,
} from '@/shared/utils/constants'
import type { DistributionStatus, PaymentMethod, ParticipantType } from '@/shared/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useDistributions,
  usePayments,
  useRecordPayment,
  useDeletePayment,
} from '../hooks/usePayments'
import type { DistributionWithDetails, PaymentWithDetails } from '../services/paymentService'

// ─── Record Payment Dialog ──────────────────────────────────────────────────

interface RecordPaymentDialogProps {
  distribution: DistributionWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function RecordPaymentDialog({
  distribution,
  open,
  onOpenChange,
}: RecordPaymentDialogProps) {
  const recordPayment = useRecordPayment()

  const remaining = distribution
    ? Math.max(distribution.amount - distribution.paid_amount, 0)
    : 0

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      distribution_id: distribution?.id ?? '',
      amount: remaining,
      payment_date: new Date().toISOString().split('T')[0],
      method: 'pix',
      reference: '',
      notes: '',
    },
  })

  // Reset form when distribution changes
  const [lastDistId, setLastDistId] = useState<string | null>(null)
  if (distribution && distribution.id !== lastDistId) {
    setLastDistId(distribution.id)
    const newRemaining = Math.max(distribution.amount - distribution.paid_amount, 0)
    reset({
      distribution_id: distribution.id,
      amount: parseFloat(newRemaining.toFixed(2)),
      payment_date: new Date().toISOString().split('T')[0],
      method: 'pix',
      reference: '',
      notes: '',
    })
  }

  function onSubmit(data: PaymentFormValues) {
    if (!distribution) return

    const maxAllowed = Math.max(distribution.amount - distribution.paid_amount, 0)
    if (data.amount > maxAllowed + 0.01) {
      return
    }

    recordPayment.mutate(data, {
      onSuccess: () => {
        onOpenChange(false)
        setLastDistId(null)
      },
    })
  }

  if (!distribution) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription>
            Registre um pagamento para esta distribuicao de comissao.
          </DialogDescription>
        </DialogHeader>

        {/* Distribution info */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Operacao</span>
            <span className="font-medium">{distribution.operation_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Participante</span>
            <span className="font-medium">{distribution.participant_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Parcela</span>
            <span className="font-medium">#{distribution.installment_number}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor Total</span>
            <CurrencyDisplay value={distribution.amount} className="font-medium" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ja Pago</span>
            <CurrencyDisplay
              value={distribution.paid_amount}
              className="font-medium text-green-600"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Restante</span>
            <CurrencyDisplay
              value={remaining}
              className="font-semibold text-amber-600"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('distribution_id')} />

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount.message}</p>
            )}
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="payment_date">Data do Pagamento</Label>
            <Input id="payment_date" type="date" {...register('payment_date')} />
            {errors.payment_date && (
              <p className="text-sm text-destructive">{errors.payment_date.message}</p>
            )}
          </div>

          {/* Metodo */}
          <div className="space-y-2">
            <Label>Metodo de Pagamento</Label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => {
                    if (val) field.onChange(val)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o metodo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]
                    ).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.method && (
              <p className="text-sm text-destructive">{errors.method.message}</p>
            )}
          </div>

          {/* Referencia */}
          <div className="space-y-2">
            <Label htmlFor="reference">Referencia (opcional)</Label>
            <Input
              id="reference"
              placeholder="Ex: comprovante, nota fiscal..."
              {...register('reference')}
            />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Observacoes adicionais..."
              rows={2}
              {...register('notes')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={recordPayment.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              {recordPayment.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Registrar Pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Distributions Tab ──────────────────────────────────────────────────────

function DistributionsTab() {
  const { isConsultor, participantId } = useAuth()
  const { data: distributions, isLoading } = useDistributions(
    isConsultor ? participantId : undefined
  )
  const [statusFilter, setStatusFilter] = useState<DistributionStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ParticipantType | 'all'>('all')
  const [participantFilter, setParticipantFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedDistribution, setSelectedDistribution] =
    useState<DistributionWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Lista de participantes únicos para o filtro (baseado nos dados carregados)
  const participantOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; type: string }>()
    for (const d of distributions ?? []) {
      if (!map.has(d.participant_id)) {
        map.set(d.participant_id, {
          id: d.participant_id,
          name: d.participant_name,
          type: d.participant_type,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [distributions])

  // Participantes filtrados pelo tipo selecionado
  const filteredParticipantOptions = useMemo(() => {
    if (typeFilter === 'all') return participantOptions
    return participantOptions.filter((p) => p.type === typeFilter)
  }, [participantOptions, typeFilter])

  const filteredData = useMemo(() => {
    let items = distributions ?? []

    if (statusFilter !== 'all') {
      items = items.filter((d) => d.status === statusFilter)
    }

    if (typeFilter !== 'all') {
      items = items.filter((d) => d.participant_type === typeFilter)
    }

    if (participantFilter !== 'all') {
      items = items.filter((d) => d.participant_id === participantFilter)
    }

    if (dateFrom) {
      items = items.filter(
        (d) => d.installment_due_date && d.installment_due_date >= dateFrom,
      )
    }

    if (dateTo) {
      items = items.filter(
        (d) => d.installment_due_date && d.installment_due_date <= dateTo,
      )
    }

    if (search.trim()) {
      const term = search.toLowerCase()
      items = items.filter(
        (d) =>
          d.participant_name.toLowerCase().includes(term) ||
          d.operation_code.toLowerCase().includes(term),
      )
    }

    return items
  }, [
    distributions,
    statusFilter,
    typeFilter,
    participantFilter,
    dateFrom,
    dateTo,
    search,
  ])

  // Totalizadores com base nos dados filtrados
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, d) => {
        acc.total += d.amount ?? 0
        acc.paid += d.paid_amount ?? 0
        acc.pending += d.pending_amount ?? 0
        return acc
      },
      { total: 0, paid: 0, pending: 0 },
    )
  }, [filteredData])

  function clearFilters() {
    setStatusFilter('all')
    setTypeFilter('all')
    setParticipantFilter('all')
    setDateFrom('')
    setDateTo('')
    setSearch('')
  }

  function handleRecordPayment(distribution: DistributionWithDetails) {
    setSelectedDistribution(distribution)
    setDialogOpen(true)
  }

  const columns: DataTableColumn<DistributionWithDetails>[] = [
    {
      key: 'operation_code',
      header: 'Operação',
      sortable: true,
      cell: (row) => (
        <span className="font-medium">{row.operation_code}</span>
      ),
    },
    {
      key: 'participant_name',
      header: 'Participante',
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.participant_name}</span>
          {row.participant_type && (
            <span className="text-xs text-muted-foreground">
              {PARTICIPANT_TYPE_LABELS[row.participant_type as ParticipantType] ??
                row.participant_type}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'installment_number',
      header: 'Parcela',
      sortable: true,
      cell: (row) => <span>#{row.installment_number}</span>,
    },
    {
      key: 'installment_due_date',
      header: 'Vencimento',
      sortable: true,
      cell: (row) => (
        <span className={row.installment_due_date ? '' : 'text-muted-foreground'}>
          {row.installment_due_date ? formatDate(row.installment_due_date) : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Valor Total',
      sortable: true,
      cell: (row) => <CurrencyDisplay value={row.amount} />,
    },
    {
      key: 'paid_amount',
      header: 'Valor Pago',
      sortable: true,
      cell: (row) => (
        <CurrencyDisplay
          value={row.paid_amount}
          className={row.paid_amount > 0 ? 'text-green-600' : ''}
        />
      ),
    },
    {
      key: 'pending_amount',
      header: 'Valor Pendente',
      sortable: true,
      cell: (row) => (
        <CurrencyDisplay
          value={row.pending_amount}
          className={row.pending_amount > 0 ? 'text-amber-600' : ''}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} type="distribution" />,
    },
    {
      key: 'actions',
      header: 'Acao',
      cell: (row) =>
        row.status !== 'paid' && row.status !== 'reversed' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRecordPayment(row)}
          >
            <Plus className="size-3.5" />
            Registrar
          </Button>
        ) : null,
    },
  ]

  const activeFiltersCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (participantFilter !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (search.trim() ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Filtros</h3>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar ({activeFiltersCount})
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Busca */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Participante ou operação..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Tipo */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Tipo de Participante
            </Label>
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                if (!val) return
                setTypeFilter(val as ParticipantType | 'all')
                setParticipantFilter('all')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos">
                  {typeFilter === 'all'
                    ? 'Todos'
                    : PARTICIPANT_TYPE_LABELS[typeFilter as ParticipantType]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {(
                  Object.entries(PARTICIPANT_TYPE_LABELS) as [
                    ParticipantType,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Participante específico */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Participante</Label>
            <Select
              value={participantFilter}
              onValueChange={(val) => {
                if (val) setParticipantFilter(val)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todos">
                  {participantFilter === 'all'
                    ? 'Todos'
                    : filteredParticipantOptions.find(
                        (p) => p.id === participantFilter,
                      )?.name ?? 'Todos'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os participantes</SelectItem>
                {filteredParticipantOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                if (val) setStatusFilter(val as DistributionStatus | 'all')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {statusFilter === 'all'
                    ? 'Todos'
                    : DISTRIBUTION_STATUS_LABELS[statusFilter]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(
                  Object.entries(DISTRIBUTION_STATUS_LABELS) as [
                    DistributionStatus,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data de vencimento - De */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Vencimento (de)
            </Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          {/* Data de vencimento - Até */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Vencimento (até)
            </Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <CurrencyDisplay value={totals.total} className="text-lg font-semibold" />
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Pago</p>
          <CurrencyDisplay
            value={totals.paid}
            className="text-lg font-semibold text-green-600"
          />
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <CurrencyDisplay
            value={totals.pending}
            className="text-lg font-semibold text-amber-600"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        loading={isLoading}
        pagination
        pageSize={10}
        emptyMessage="Nenhuma distribuição encontrada."
      />

      <RecordPaymentDialog
        distribution={selectedDistribution}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setSelectedDistribution(null)
        }}
      />
    </div>
  )
}

// ─── Payments History Tab ───────────────────────────────────────────────────

function PaymentsHistoryTab() {
  const { data: payments, isLoading } = usePayments()
  const deletePaymentMutation = useDeletePayment()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PaymentWithDetails | null>(null)

  const filteredData = useMemo(() => {
    if (!search.trim()) return payments ?? []
    const term = search.toLowerCase()
    return (payments ?? []).filter(
      (p) =>
        p.participant_name.toLowerCase().includes(term) ||
        (p.reference && p.reference.toLowerCase().includes(term)) ||
        p.operation_code.toLowerCase().includes(term),
    )
  }, [payments, search])

  const columns: DataTableColumn<PaymentWithDetails>[] = [
    {
      key: 'payment_date',
      header: 'Data',
      sortable: true,
      cell: (row) => formatDate(row.payment_date),
    },
    {
      key: 'operation_code',
      header: 'Operacao',
      sortable: true,
      cell: (row) => (
        <span className="font-medium">{row.operation_code}</span>
      ),
    },
    {
      key: 'participant_name',
      header: 'Participante',
      sortable: true,
    },
    {
      key: 'amount',
      header: 'Valor',
      sortable: true,
      cell: (row) => (
        <CurrencyDisplay value={row.amount} className="text-green-600" />
      ),
    },
    {
      key: 'method',
      header: 'Metodo',
      cell: (row) => PAYMENT_METHOD_LABELS[row.method] ?? row.method,
    },
    {
      key: 'reference',
      header: 'Referencia',
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.reference || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acoes',
      cell: (row) => (
        <Button
          size="icon-sm"
          variant="destructive"
          onClick={() => setDeleteTarget(row)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar referencia, participante..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        loading={isLoading}
        pagination
        pageSize={10}
        emptyMessage="Nenhum pagamento encontrado."
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Excluir Pagamento"
        description={
          deleteTarget
            ? `Tem certeza que deseja excluir o pagamento de ${formatCurrency(deleteTarget.amount)} para ${deleteTarget.participant_name}? Esta acao nao pode ser desfeita.`
            : ''
        }
        confirmText="Excluir"
        variant="destructive"
        loading={deletePaymentMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deletePaymentMutation.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            })
          }
        }}
      />
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { isConsultor } = useAuth()

  return (
    <div className="space-y-6">
      <PageHeader
        title={isConsultor ? "Minhas Comissões" : "Pagamentos"}
        description={isConsultor ? "Acompanhe suas comissões e pagamentos" : "Gerencie pagamentos de comissões e acompanhe distribuições"}
      />

      <Tabs defaultValue="distributions">
        <TabsList>
          <TabsTrigger value="distributions">
            <DollarSign className="size-4" />
            Distribuicoes
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" />
            Historico de Pagamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="distributions">
          <DistributionsTab />
        </TabsContent>

        <TabsContent value="history">
          <PaymentsHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
