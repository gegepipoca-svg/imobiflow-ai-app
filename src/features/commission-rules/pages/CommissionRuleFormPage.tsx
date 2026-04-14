import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/shared/components/PageHeader'
import { PRODUCT_TYPE_LABELS } from '@/shared/utils/constants'
import type { ProductType } from '@/shared/types'
import {
  commissionRuleSchema,
  type CommissionRuleFormValues,
} from '@/shared/utils/validators'
import {
  useCommissionRule,
  useCreateCommissionRule,
  useUpdateCommissionRule,
} from '../hooks/useCommissionRules'
import { cn } from '@/lib/utils'

export default function CommissionRuleFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const { data: existingRule, isLoading: isLoadingRule } = useCommissionRule(id)
  const createMutation = useCreateCommissionRule()
  const updateMutation = useUpdateCommissionRule()

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommissionRuleFormValues>({
    resolver: zodResolver(commissionRuleSchema),
    defaultValues: {
      name: '',
      product_type: 'imovel',
      commission_model: 0,
      installments: [{ number: 1, percentage_of_credit: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'installments',
  })

  // Load existing data in edit mode
  useEffect(() => {
    if (existingRule) {
      reset({
        name: existingRule.name,
        product_type: existingRule.product_type,
        commission_model: existingRule.commission_model,
        installments: existingRule.installments.map((inst) => ({
          number: inst.number,
          percentage_of_credit: inst.percentage_of_credit,
        })),
      })
    }
  }, [existingRule, reset])

  const watchedInstallments = watch('installments')
  const watchedCommissionModel = watch('commission_model')
  const totalPercentage = watchedInstallments.reduce(
    (sum, inst) => sum + (Number(inst.percentage_of_credit) || 0),
    0,
  )
  const totalDisplay = (totalPercentage * 100).toFixed(2).replace(/\.?0+$/, '')
  // Installments devem somar exatamente o commission_model (regra de negócio).
  // Ex: commission_model = 1.25% → parcelas 0.5% + 0.25% + 0.25% + 0.25% = 1.25%
  const isTotalValid =
    watchedCommissionModel > 0
      ? Math.abs(totalPercentage - watchedCommissionModel) < 0.0001
      : totalPercentage === 0
  const expectedDisplay =
    watchedCommissionModel > 0
      ? (watchedCommissionModel * 100).toFixed(2).replace(/\.?0+$/, '')
      : '0'

  function addInstallment() {
    const nextNumber = fields.length + 1
    append({ number: nextNumber, percentage_of_credit: 0 })
  }

  function removeInstallment(index: number) {
    if (fields.length <= 1) return
    remove(index)
  }

  async function onSubmit(data: CommissionRuleFormValues) {
    // Re-number installments sequentially
    const normalized = {
      ...data,
      is_active: true,
      installments: data.installments.map((inst, i) => ({
        number: i + 1,
        percentage_of_credit: inst.percentage_of_credit,
      })),
    }

    if (isEditing && id) {
      await updateMutation.mutateAsync({ id, data: normalized })
    } else {
      await createMutation.mutateAsync(normalized)
    }
    navigate('/commission-rules')
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (isEditing && isLoadingRule) {
    return (
      <div className="space-y-6">
        <PageHeader title="Carregando..." />
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Editar Regra de Comissão' : 'Nova Regra de Comissão'}
        description={
          isEditing
            ? 'Altere os dados da regra de comissão'
            : 'Cadastre uma nova regra de comissão'
        }
        action={
          <Button
            variant="outline"
            onClick={() => navigate('/commission-rules')}
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Ex: Comissão Padrão Imóvel"
                {...register('name')}
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tipo de Produto */}
              <div className="space-y-2">
                <Label>Tipo de Produto</Label>
                <Controller
                  name="product_type"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val) => { if (val) field.onChange(val as ProductType) }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione...">
                          {field.value ? PRODUCT_TYPE_LABELS[field.value as ProductType] : null}
                        </SelectValue>
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

              {/* Modelo de Comissão */}
              <div className="space-y-2">
                <Label htmlFor="commission_model">Modelo de Comissão (%)</Label>
                <Controller
                  name="commission_model"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="commission_model"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="Ex: 5.5"
                      value={
                        field.value !== undefined && field.value !== null
                          ? (field.value * 100).toFixed(2).replace(/\.?0+$/, '')
                          : ''
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '') {
                          field.onChange(0)
                          return
                        }
                        field.onChange(parseFloat(raw) / 100)
                      }}
                      aria-invalid={!!errors.commission_model}
                    />
                  )}
                />
                {errors.commission_model && (
                  <p className="text-sm text-destructive">
                    {errors.commission_model.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Installments Editor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Parcelas</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addInstallment}>
              <Plus className="size-4" />
              Adicionar Parcela
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Column headers */}
            <div className="grid grid-cols-[60px_1fr_40px] items-center gap-3 text-sm font-medium text-muted-foreground">
              <span>N.o</span>
              <span>Percentual do Crédito (%)</span>
              <span />
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[60px_1fr_40px] items-start gap-3"
              >
                {/* Installment number (auto) */}
                <div className="flex h-8 items-center justify-center rounded-lg border bg-muted text-sm font-medium">
                  {index + 1}
                </div>

                {/* Percentage input */}
                <div className="space-y-1">
                  <Controller
                    name={`installments.${index}.percentage_of_credit`}
                    control={control}
                    render={({ field: percentField }) => (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="Ex: 10"
                        value={
                          percentField.value !== undefined &&
                          percentField.value !== null
                            ? (percentField.value * 100)
                                .toFixed(2)
                                .replace(/\.?0+$/, '')
                            : ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            percentField.onChange(0)
                            return
                          }
                          percentField.onChange(parseFloat(raw) / 100)
                        }}
                        aria-invalid={
                          !!errors.installments?.[index]?.percentage_of_credit
                        }
                      />
                    )}
                  />
                  {/* Hidden field to keep number in sync */}
                  <input
                    type="hidden"
                    {...register(`installments.${index}.number`, {
                      valueAsNumber: true,
                    })}
                    value={index + 1}
                  />
                  {errors.installments?.[index]?.percentage_of_credit && (
                    <p className="text-xs text-destructive">
                      {
                        errors.installments[index].percentage_of_credit
                          ?.message
                      }
                    </p>
                  )}
                </div>

                {/* Remove button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={fields.length <= 1}
                  onClick={() => removeInstallment(index)}
                  className="h-8 w-8"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}

            {/* Total */}
            <div className="mt-4 flex items-center gap-3 border-t pt-3">
              <span className="text-sm font-medium">Total:</span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  isTotalValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                )}
              >
                {totalDisplay}%
              </span>
              <span className="text-xs text-muted-foreground">
                (esperado: {expectedDisplay}%)
              </span>
              {watchedCommissionModel > 0 && isTotalValid && totalPercentage > 0 && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  ✓ completo
                </span>
              )}
              {watchedCommissionModel > 0 && !isTotalValid && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {totalPercentage > watchedCommissionModel ? 'excede' : 'falta preencher'}
                </span>
              )}
            </div>

            {errors.installments?.root && (
              <p className="text-sm text-destructive">
                {errors.installments.root.message}
              </p>
            )}
            {errors.installments?.message && (
              <p className="text-sm text-destructive">
                {errors.installments.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending || isSubmitting}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Criar Regra'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/commission-rules')}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
