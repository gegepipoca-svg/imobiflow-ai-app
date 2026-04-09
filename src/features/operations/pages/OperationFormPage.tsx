import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calculator,
  Users,
  FileText,
  Check,
  ChevronsUpDown,
  AlertCircle,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

import { PageHeader } from '@/shared/components/PageHeader'
import { CurrencyDisplay } from '@/shared/components/CurrencyDisplay'
import {
  formatCurrency,
  formatPercentage,
  formatDate,
} from '@/shared/utils/formatters'
import { PRODUCT_TYPE_LABELS } from '@/shared/utils/constants'
import type {
  ProductType,
  CommissionRule,
  Participant,
  InstallmentDefinition,
} from '@/shared/types'

import { getCommissionRules } from '@/features/commission-rules/services/commissionRuleService'
import { getParticipants } from '@/features/participants/services/participantService'
import { useCreateOperation } from '../hooks/useOperations'
import {
  simulateCommission,
  calculateCommissionTotal,
  validateParticipantShares,
  type SimulationBreakdown,
} from '../services/calculationEngine'

// ─── Form schema ────────────────────────────────────────────────────────────

const operationFormSchema = z.object({
  code: z.string().min(1, 'Codigo e obrigatorio'),
  description: z.string().optional(),
  operation_date: z.string().min(1, 'Data da operacao e obrigatoria'),
  product_type: z.enum(['imovel', 'auto', 'servico', 'outros'], {
    message: 'Tipo de produto e obrigatorio',
  }),
  commission_rule_id: z.string().optional(),
  credit_value: z.number({ message: 'Valor do credito e obrigatorio' }).positive('Valor deve ser positivo'),
  commission_model: z.number({ message: 'Modelo de comissao e obrigatorio' }).min(0).max(1),
  notes: z.string().optional(),
  participants: z
    .array(
      z.object({
        participant_id: z.string().min(1, 'Selecione um participante'),
        percentage_share: z.number().min(0).max(1),
        role_in_operation: z.string().optional(),
      }),
    )
    .min(1, 'Adicione pelo menos um participante'),
})

type OperationFormValues = z.infer<typeof operationFormSchema>

// ─── Code generator ─────────────────────────────────────────────────────────

function generateOperationCode(): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `OP-${year}${month}-${random}`
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OperationFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const createOperation = useCreateOperation()

  // Fetch commission rules and participants for selects
  const { data: allRules = [] } = useQuery<CommissionRule[]>({
    queryKey: ['commission_rules'],
    queryFn: getCommissionRules,
  })

  const { data: allParticipants = [] } = useQuery({
    queryKey: ['participants'],
    queryFn: getParticipants,
  })

  // Form setup
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OperationFormValues>({
    resolver: zodResolver(operationFormSchema),
    defaultValues: {
      code: generateOperationCode(),
      description: '',
      operation_date: new Date().toISOString().split('T')[0],
      product_type: undefined,
      commission_rule_id: '',
      credit_value: 0,
      commission_model: 0,
      notes: '',
      participants: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'participants',
  })

  // Watched values for real-time preview
  const watchedProductType = watch('product_type')
  const watchedRuleId = watch('commission_rule_id')
  const watchedCreditValue = watch('credit_value')
  const watchedCommissionModel = watch('commission_model')
  const watchedParticipants = watch('participants')

  // Selected rule and its installment definitions
  const [installmentDefs, setInstallmentDefs] = useState<InstallmentDefinition[]>([])

  // Filter rules by selected product type
  const filteredRules = useMemo(() => {
    if (!watchedProductType) return []
    return allRules.filter(
      (r) => r.product_type === watchedProductType && r.is_active,
    )
  }, [allRules, watchedProductType])

  // When rule is selected, auto-fill commission model and installment definitions
  useEffect(() => {
    if (!watchedRuleId) return
    const rule = allRules.find((r) => r.id === watchedRuleId)
    if (rule) {
      setValue('commission_model', rule.commission_model)
      setInstallmentDefs(rule.installments)
    }
  }, [watchedRuleId, allRules, setValue])

  // Clear rule selection when product type changes
  useEffect(() => {
    setValue('commission_rule_id', '')
    setInstallmentDefs([])
  }, [watchedProductType, setValue])

  // Real-time commission total
  const commissionTotal = useMemo(() => {
    if (!watchedCreditValue || !watchedCommissionModel) return 0
    return calculateCommissionTotal(watchedCreditValue, watchedCommissionModel)
  }, [watchedCreditValue, watchedCommissionModel])

  // Participant share validation
  const shareValidation = useMemo(() => {
    if (!watchedParticipants || watchedParticipants.length === 0) {
      return { valid: false, total: 0, message: undefined }
    }
    return validateParticipantShares(watchedParticipants)
  }, [watchedParticipants])

  // Full simulation preview
  const simulation: SimulationBreakdown | null = useMemo(() => {
    if (
      !watchedCreditValue ||
      !watchedCommissionModel ||
      installmentDefs.length === 0 ||
      !watchedParticipants ||
      watchedParticipants.length === 0
    ) {
      return null
    }

    const validParticipants = watchedParticipants.filter(
      (p) => p.participant_id && p.percentage_share > 0,
    )
    if (validParticipants.length === 0) return null

    return simulateCommission(
      watchedCreditValue,
      watchedCommissionModel,
      installmentDefs,
      validParticipants,
    )
  }, [watchedCreditValue, watchedCommissionModel, installmentDefs, watchedParticipants])

  // Participant name lookup
  const getParticipantName = useCallback(
    (participantId: string) => {
      const p = allParticipants.find((x) => x.id === participantId)
      return p?.name ?? participantId
    },
    [allParticipants],
  )

  // Submit handler
  async function onSubmit(values: OperationFormValues) {
    // Validate shares before submitting
    const validation = validateParticipantShares(values.participants)
    if (!validation.valid) return

    if (installmentDefs.length === 0) {
      return
    }

    await createOperation.mutateAsync({
      code: values.code,
      credit_value: values.credit_value,
      commission_model: values.commission_model,
      product_type: values.product_type,
      commission_rule_id: values.commission_rule_id || null,
      operation_date: values.operation_date,
      notes: values.notes || null,
      status: 'draft',
      participants: values.participants.map((p) => ({
        participant_id: p.participant_id,
        percentage_share: p.percentage_share,
        role_in_operation: p.role_in_operation || null,
      })),
      installment_definitions: installmentDefs,
    })

    navigate('/operations')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Editar Operacao' : 'Nova Operacao'}
        description={
          isEditing
            ? 'Editar dados da operacao'
            : 'Cadastrar nova operacao com calculo automatico de comissoes'
        }
        action={
          <Button variant="outline" onClick={() => navigate('/operations')}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ─── Section 1: Dados da Operacao ──────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Dados da Operacao
            </CardTitle>
            <CardDescription>Informacoes basicas da operacao</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Codigo */}
              <div className="space-y-2">
                <Label htmlFor="code">Codigo</Label>
                <Input
                  id="code"
                  {...register('code')}
                  placeholder="OP-2403-0001"
                />
                {errors.code && (
                  <p className="text-sm text-destructive">{errors.code.message}</p>
                )}
              </div>

              {/* Data da operacao */}
              <div className="space-y-2">
                <Label htmlFor="operation_date">Data da Operacao</Label>
                <Input
                  id="operation_date"
                  type="date"
                  {...register('operation_date')}
                />
                {errors.operation_date && (
                  <p className="text-sm text-destructive">
                    {errors.operation_date.message}
                  </p>
                )}
              </div>

              {/* Tipo de Produto */}
              <div className="space-y-2">
                <Label>Tipo de Produto</Label>
                <Controller
                  control={control}
                  name="product_type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.entries(PRODUCT_TYPE_LABELS) as [
                            ProductType,
                            string,
                          ][]
                        ).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.product_type && (
                  <p className="text-sm text-destructive">
                    {errors.product_type.message}
                  </p>
                )}
              </div>

              {/* Regra de Comissao */}
              <div className="space-y-2">
                <Label>Regra de Comissao</Label>
                <Controller
                  control={control}
                  name="commission_rule_id"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!watchedProductType || filteredRules.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            !watchedProductType
                              ? 'Selecione o tipo primeiro'
                              : filteredRules.length === 0
                                ? 'Nenhuma regra disponivel'
                                : 'Selecione a regra'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredRules.map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.name} ({formatPercentage(rule.commission_model)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Valor do Credito */}
              <div className="space-y-2">
                <Label htmlFor="credit_value">Valor do Credito (R$)</Label>
                <Input
                  id="credit_value"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('credit_value', { valueAsNumber: true })}
                  placeholder="0,00"
                />
                {errors.credit_value && (
                  <p className="text-sm text-destructive">
                    {errors.credit_value.message}
                  </p>
                )}
              </div>

              {/* Modelo de Comissao */}
              <div className="space-y-2">
                <Label htmlFor="commission_model">Modelo de Comissao (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="commission_model_display"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={
                      watchedCommissionModel
                        ? (watchedCommissionModel * 100).toFixed(2).replace(/\.?0+$/, '')
                        : ''
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      setValue(
                        'commission_model',
                        isNaN(val) ? 0 : val / 100,
                      )
                    }}
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                {errors.commission_model && (
                  <p className="text-sm text-destructive">
                    {errors.commission_model.message}
                  </p>
                )}
              </div>
            </div>

            {/* Descricao */}
            <div className="space-y-2">
              <Label htmlFor="description">Descricao</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Descricao da operacao..."
                rows={2}
              />
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Observacoes adicionais..."
                rows={2}
              />
            </div>

            {/* Commission total display */}
            {commissionTotal > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <Calculator className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Comissao Total Calculada
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(commissionTotal)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 2: Participantes ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Participantes
                </CardTitle>
                <CardDescription>
                  Defina os participantes e suas porcentagens de participacao
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    participant_id: '',
                    percentage_share: 0,
                    role_in_operation: '',
                  })
                }
              >
                <Plus className="size-4" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
                <Users className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum participante adicionado.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    append({
                      participant_id: '',
                      percentage_share: 0,
                      role_in_operation: '',
                    })
                  }
                >
                  <Plus className="size-4" />
                  Adicionar Participante
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <ParticipantRow
                    key={field.id}
                    index={index}
                    control={control}
                    register={register}
                    setValue={setValue}
                    watch={watch}
                    remove={remove}
                    participants={allParticipants as Participant[]}
                    selectedIds={watchedParticipants?.map((p) => p.participant_id) ?? []}
                  />
                ))}
              </div>
            )}

            {/* Share validation feedback */}
            {watchedParticipants && watchedParticipants.length > 0 && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 ${
                  shareValidation.valid
                    ? 'border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10'
                    : 'border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10'
                }`}
              >
                {shareValidation.valid ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <AlertCircle className="size-4 text-amber-600" />
                )}
                <span
                  className={`text-sm font-medium ${
                    shareValidation.valid
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  Total:{' '}
                  {((shareValidation.total ?? 0) * 100).toFixed(2)}%
                  {shareValidation.valid
                    ? ' - Distribuicao valida'
                    : ` - ${shareValidation.message ?? 'Deve somar 100%'}`}
                </span>
              </div>
            )}

            {errors.participants && (
              <p className="text-sm text-destructive">
                {typeof errors.participants.message === 'string'
                  ? errors.participants.message
                  : 'Verifique os participantes'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 3: Preview ────────────────────────────────────── */}
        {simulation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="size-5" />
                Preview da Comissao
              </CardTitle>
              <CardDescription>
                Simulacao em tempo real das parcelas e distribuicoes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Installments table */}
              <div>
                <h4 className="mb-3 text-sm font-medium">Parcelas</h4>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">No.</TableHead>
                        <TableHead>% Credito</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulation.installments.map((inst) => (
                        <TableRow key={inst.installment_number}>
                          <TableCell className="font-medium">
                            {inst.installment_number}
                          </TableCell>
                          <TableCell>
                            {formatPercentage(inst.percentage_of_credit)}
                          </TableCell>
                          <TableCell>
                            <CurrencyDisplay value={inst.value} />
                          </TableCell>
                          <TableCell>{formatDate(inst.due_date)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Distribution matrix */}
              <div>
                <h4 className="mb-3 text-sm font-medium">
                  Matriz de Distribuicao
                </h4>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Parcela</TableHead>
                        {simulation.participantTotals.map((pt) => (
                          <TableHead key={pt.participant_id}>
                            {getParticipantName(pt.participant_id)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulation.installments.map((inst) => (
                        <TableRow key={inst.installment_number}>
                          <TableCell className="font-medium">
                            {inst.installment_number}
                          </TableCell>
                          {simulation.participantTotals.map((pt) => {
                            const dist = simulation.distributions.find(
                              (d) =>
                                d.installment_number === inst.installment_number &&
                                d.participant_id === pt.participant_id,
                            )
                            return (
                              <TableCell key={pt.participant_id}>
                                <CurrencyDisplay value={dist?.value ?? 0} />
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell>Total</TableCell>
                        {simulation.participantTotals.map((pt) => (
                          <TableCell key={pt.participant_id}>
                            <CurrencyDisplay
                              value={pt.total}
                              className="font-semibold"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Per-participant summary */}
              <div>
                <h4 className="mb-3 text-sm font-medium">
                  Resumo por Participante
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {simulation.participantTotals.map((pt) => (
                    <div
                      key={pt.participant_id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <span className="text-sm font-medium">
                        {getParticipantName(pt.participant_id)}
                      </span>
                      <CurrencyDisplay
                        value={pt.total}
                        className="text-sm font-semibold text-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Checklist + Submit ──────────────────────────────────── */}
        <Card>
          <CardContent className="pt-6">
            {/* Checklist */}
            <div className="mb-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground mb-3">Checklist para criar:</p>
              <ChecklistItem ok={!!watchedProductType} label="Tipo de produto selecionado" />
              <ChecklistItem ok={installmentDefs.length > 0} label="Regra de comissão selecionada" />
              <ChecklistItem ok={watchedCreditValue > 0} label="Valor do crédito preenchido" />
              <ChecklistItem ok={watchedCommissionModel > 0} label="Modelo de comissão definido" />
              <ChecklistItem ok={(watchedParticipants?.length ?? 0) > 0} label="Pelo menos um participante adicionado" />
              <ChecklistItem ok={shareValidation.valid} label="Participações somam 100%" />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/operations')}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  createOperation.isPending ||
                  !shareValidation.valid ||
                  installmentDefs.length === 0
                }
              >
                {(isSubmitting || createOperation.isPending) && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {isEditing ? 'Salvar Alterações' : 'Criar Operação'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

// ─── Checklist Item ────────────────────────────────────────────────────────

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
        ok
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-muted text-muted-foreground'
      }`}>
        {ok ? <Check className="size-3" /> : <span className="text-[10px]">-</span>}
      </div>
      <span className={`text-sm ${ok ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  )
}

// ─── Participant Row sub-component ──────────────────────────────────────────

interface ParticipantRowProps {
  index: number
  control: ReturnType<typeof useForm<OperationFormValues>>['control']
  register: ReturnType<typeof useForm<OperationFormValues>>['register']
  setValue: ReturnType<typeof useForm<OperationFormValues>>['setValue']
  watch: ReturnType<typeof useForm<OperationFormValues>>['watch']
  remove: ReturnType<typeof useFieldArray>['remove']
  participants: Participant[]
  selectedIds: string[]
}

function ParticipantRow({
  index,
  control: _control,
  register,
  setValue,
  watch,
  remove,
  participants,
  selectedIds,
}: ParticipantRowProps) {
  const [open, setOpen] = useState(false)
  const currentId = watch(`participants.${index}.participant_id`)
  const currentShare = watch(`participants.${index}.percentage_share`)

  const currentParticipant = participants.find((p) => p.id === currentId)

  // Available participants: not already selected by other rows
  const availableParticipants = participants.filter(
    (p) => p.is_active && (!selectedIds.includes(p.id) || p.id === currentId),
  )

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
      {/* Participant select (Combobox) */}
      <div className="min-w-[200px] flex-1 space-y-1">
        <Label className="text-xs text-muted-foreground">Participante</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
          >
            <span className={currentParticipant ? '' : 'text-muted-foreground'}>
              {currentParticipant?.name ?? 'Selecionar...'}
            </span>
            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0">
            <Command>
              <CommandInput placeholder="Buscar participante..." />
              <CommandList>
                <CommandEmpty>Nenhum participante encontrado.</CommandEmpty>
                <CommandGroup>
                  {availableParticipants.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.name}
                      onSelect={() => {
                        setValue(`participants.${index}.participant_id`, p.id)
                        setOpen(false)
                      }}
                      data-checked={p.id === currentId}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.type}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Percentage share */}
      <div className="w-[120px] space-y-1">
        <Label className="text-xs text-muted-foreground">Participacao (%)</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={currentShare ? (currentShare * 100).toFixed(2).replace(/\.?0+$/, '') : ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              setValue(
                `participants.${index}.percentage_share`,
                isNaN(val) ? 0 : val / 100,
              )
            }}
            placeholder="0"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>

      {/* Role */}
      <div className="min-w-[140px] flex-1 space-y-1">
        <Label className="text-xs text-muted-foreground">Funcao (opcional)</Label>
        <Input
          {...register(`participants.${index}.role_in_operation`)}
          placeholder="Ex: Consultor principal"
        />
      </div>

      {/* Remove button */}
      <div className="flex items-end pb-0.5 pt-5">
        <Button
          type="button"
          variant="destructive"
          size="icon-sm"
          onClick={() => remove(index)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
