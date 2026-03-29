import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calculator,
  Plus,
  Trash2,
  GitCompareArrows,
  RotateCcw,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/shared/components/PageHeader'
import { CurrencyDisplay } from '@/shared/components/CurrencyDisplay'
import {
  formatCurrency,
  formatPercentage,
  formatDate,
} from '@/shared/utils/formatters'
import { cn } from '@/lib/utils'
import { getCommissionRules } from '@/features/commission-rules/services/commissionRuleService'
import {
  simulateCommission,
  validateParticipantShares,
  type SimulationBreakdown,
} from '@/features/operations/services/calculationEngine'
import type { CommissionRule } from '@/shared/types'

// ─── Local types ──────────────────────────────────────────────────────────────

interface SimParticipant {
  id: string
  name: string
  percentage_share: number
}

interface SimInstallment {
  number: number
  percentage_of_credit: number
}

interface SimParams {
  creditValue: number
  commissionModel: number
  installments: SimInstallment[]
  participants: SimParticipant[]
}

interface SimScenario {
  params: SimParams
  result: SimulationBreakdown
}

const CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#dc2626',
  '#0891b2',
  '#ca8a04',
  '#e11d48',
]

const DEFAULT_PARAMS: SimParams = {
  creditValue: 0,
  commissionModel: 0,
  installments: [{ number: 1, percentage_of_credit: 0 }],
  participants: [{ id: crypto.randomUUID(), name: '', percentage_share: 0 }],
}

let participantCounter = 1

// ─── Component ────────────────────────────────────────────────────────────────

export default function SimulationPage() {
  const [params, setParams] = useState<SimParams>({ ...DEFAULT_PARAMS })
  const [result, setResult] = useState<SimulationBreakdown | null>(null)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [comparisonScenario, setComparisonScenario] =
    useState<SimScenario | null>(null)
  const [isComparing, setIsComparing] = useState(false)

  const { data: rules = [] } = useQuery({
    queryKey: ['commission-rules'],
    queryFn: getCommissionRules,
  })

  // ─── Derived state ────────────────────────────────────────────────────────

  const participantValidation = useMemo(
    () =>
      validateParticipantShares(
        params.participants.map((p) => ({
          percentage_share: p.percentage_share,
        })),
      ),
    [params.participants],
  )

  const installmentTotal = useMemo(
    () =>
      params.installments.reduce(
        (sum, inst) => sum + (inst.percentage_of_credit || 0),
        0,
      ),
    [params.installments],
  )

  const canSimulate =
    params.creditValue > 0 &&
    params.commissionModel > 0 &&
    params.installments.length > 0 &&
    params.installments.every((i) => i.percentage_of_credit > 0) &&
    params.participants.length > 0 &&
    params.participants.every((p) => p.name.trim() !== '' && p.percentage_share > 0) &&
    participantValidation.valid

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleSimulate = useCallback(() => {
    const breakdown = simulateCommission(
      params.creditValue,
      params.commissionModel,
      params.installments.map((inst, i) => ({
        number: i + 1,
        percentage_of_credit: inst.percentage_of_credit,
      })),
      params.participants.map((p) => ({
        participant_id: p.id,
        percentage_share: p.percentage_share,
      })),
    )
    setResult(breakdown)
  }, [params])

  const handleLoadRule = useCallback(
    (ruleId: string | null) => {
      if (!ruleId) return
      setSelectedRuleId(ruleId)
      const rule = rules.find((r: CommissionRule) => r.id === ruleId)
      if (!rule) return

      setParams((prev) => ({
        ...prev,
        commissionModel: rule.commission_model,
        installments: rule.installments.map((inst) => ({
          number: inst.number,
          percentage_of_credit: inst.percentage_of_credit,
        })),
      }))
    },
    [rules],
  )

  const handleReset = useCallback(() => {
    participantCounter = 1
    setParams({ ...DEFAULT_PARAMS, participants: [{ id: crypto.randomUUID(), name: '', percentage_share: 0 }] })
    setResult(null)
    setSelectedRuleId(null)
    setComparisonScenario(null)
    setIsComparing(false)
  }, [])

  const handleStartComparison = useCallback(() => {
    if (!result) return
    setComparisonScenario({ params: { ...params }, result })
    setResult(null)
    setIsComparing(true)
  }, [params, result])

  const handleCancelComparison = useCallback(() => {
    if (comparisonScenario) {
      setParams(comparisonScenario.params)
      setResult(comparisonScenario.result)
    }
    setComparisonScenario(null)
    setIsComparing(false)
  }, [comparisonScenario])

  // ─── Param updaters ───────────────────────────────────────────────────────

  const updateCreditValue = (raw: string) => {
    const val = parseFloat(raw)
    setParams((p) => ({ ...p, creditValue: isNaN(val) ? 0 : val }))
  }

  const updateCommissionModel = (raw: string) => {
    const val = parseFloat(raw)
    setParams((p) => ({
      ...p,
      commissionModel: isNaN(val) ? 0 : val / 100,
    }))
  }

  const addInstallment = () => {
    setParams((p) => ({
      ...p,
      installments: [
        ...p.installments,
        { number: p.installments.length + 1, percentage_of_credit: 0 },
      ],
    }))
  }

  const removeInstallment = (index: number) => {
    if (params.installments.length <= 1) return
    setParams((p) => ({
      ...p,
      installments: p.installments
        .filter((_, i) => i !== index)
        .map((inst, i) => ({ ...inst, number: i + 1 })),
    }))
  }

  const updateInstallmentPercent = (index: number, raw: string) => {
    const val = parseFloat(raw)
    setParams((p) => ({
      ...p,
      installments: p.installments.map((inst, i) =>
        i === index
          ? { ...inst, percentage_of_credit: isNaN(val) ? 0 : val / 100 }
          : inst,
      ),
    }))
  }

  const addParticipant = () => {
    participantCounter++
    setParams((p) => ({
      ...p,
      participants: [
        ...p.participants,
        {
          id: crypto.randomUUID(),
          name: '',
          percentage_share: 0,
        },
      ],
    }))
  }

  const removeParticipant = (index: number) => {
    if (params.participants.length <= 1) return
    setParams((p) => ({
      ...p,
      participants: p.participants.filter((_, i) => i !== index),
    }))
  }

  const updateParticipantName = (index: number, name: string) => {
    setParams((p) => ({
      ...p,
      participants: p.participants.map((part, i) =>
        i === index ? { ...part, name } : part,
      ),
    }))
  }

  const updateParticipantPercent = (index: number, raw: string) => {
    const val = parseFloat(raw)
    setParams((p) => ({
      ...p,
      participants: p.participants.map((part, i) =>
        i === index
          ? { ...part, percentage_share: isNaN(val) ? 0 : val / 100 }
          : part,
      ),
    }))
  }

  // ─── Helpers for display ──────────────────────────────────────────────────

  const getParticipantName = (participantId: string): string => {
    return (
      params.participants.find((p) => p.id === participantId)?.name ||
      'Desconhecido'
    )
  }

  const getComparisonParticipantName = (participantId: string): string => {
    return (
      comparisonScenario?.params.participants.find(
        (p) => p.id === participantId,
      )?.name || 'Desconhecido'
    )
  }

  // Build pie chart data from result
  const pieData = useMemo(() => {
    if (!result) return []
    return result.participantTotals.map((pt) => ({
      name: getParticipantName(pt.participant_id),
      value: pt.total,
    }))
  }, [result, params.participants])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulador de Comissão"
        description="Simule cálculos de comissão em tempo real"
        action={
          <div className="flex items-center gap-2">
            {result && !isComparing && (
              <Button variant="outline" onClick={handleStartComparison}>
                <GitCompareArrows className="size-4" />
                Comparar
              </Button>
            )}
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="size-4" />
              Limpar
            </Button>
          </div>
        }
      />

      {isComparing && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
          <GitCompareArrows className="size-5 text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Modo Comparativo
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Configure um novo cenario e clique em Simular para comparar.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleCancelComparison}>
            Cancelar
          </Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Left Panel: Parameters ───────────────────────────────────── */}
        <div className="space-y-6">
          {/* Basic Params */}
          <Card>
            <CardHeader>
              <CardTitle>Parametros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Load existing rule */}
              <div className="space-y-2">
                <Label>Carregar Regra Existente</Label>
                <Select
                  value={selectedRuleId ?? undefined}
                  onValueChange={(val) => handleLoadRule(val as string | null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma regra..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((rule: CommissionRule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.name} ({formatPercentage(rule.commission_model)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Credit Value */}
                <div className="space-y-2">
                  <Label htmlFor="creditValue">Valor do Credito (R$)</Label>
                  <Input
                    id="creditValue"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 250000"
                    value={params.creditValue || ''}
                    onChange={(e) => updateCreditValue(e.target.value)}
                  />
                </div>

                {/* Commission Model */}
                <div className="space-y-2">
                  <Label htmlFor="commModel">Modelo de Comissao (%)</Label>
                  <Input
                    id="commModel"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Ex: 5.5"
                    value={
                      params.commissionModel
                        ? (params.commissionModel * 100)
                            .toFixed(2)
                            .replace(/\.?0+$/, '')
                        : ''
                    }
                    onChange={(e) => updateCommissionModel(e.target.value)}
                  />
                </div>
              </div>

              {/* Live preview */}
              {params.creditValue > 0 && params.commissionModel > 0 && (
                <div className="rounded-lg border bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Comissao estimada
                  </p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatCurrency(
                      params.creditValue * params.commissionModel,
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Installments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Parcelas</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInstallment}
              >
                <Plus className="size-4" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[60px_1fr_40px] items-center gap-3 text-sm font-medium text-muted-foreground">
                <span>N.o</span>
                <span>% do Credito</span>
                <span />
              </div>

              {params.installments.map((inst, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[60px_1fr_40px] items-center gap-3"
                >
                  <div className="flex h-8 items-center justify-center rounded-lg border bg-muted text-sm font-medium">
                    {index + 1}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Ex: 10"
                    value={
                      inst.percentage_of_credit
                        ? (inst.percentage_of_credit * 100)
                            .toFixed(2)
                            .replace(/\.?0+$/, '')
                        : ''
                    }
                    onChange={(e) =>
                      updateInstallmentPercent(index, e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={params.installments.length <= 1}
                    onClick={() => removeInstallment(index)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {/* Total */}
              <div className="mt-2 flex items-center gap-3 border-t pt-3">
                <span className="text-sm font-medium">Total:</span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    installmentTotal <= 1.0001
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {(installmentTotal * 100).toFixed(2).replace(/\.?0+$/, '')}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Participants */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Participantes</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addParticipant}
              >
                <Plus className="size-4" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[1fr_100px_40px] items-center gap-3 text-sm font-medium text-muted-foreground">
                <span>Nome</span>
                <span>% Participacao</span>
                <span />
              </div>

              {params.participants.map((part, index) => (
                <div
                  key={part.id}
                  className="grid grid-cols-[1fr_100px_40px] items-center gap-3"
                >
                  <Input
                    placeholder="Nome do participante"
                    value={part.name}
                    onChange={(e) =>
                      updateParticipantName(index, e.target.value)
                    }
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="%"
                    value={
                      part.percentage_share
                        ? (part.percentage_share * 100)
                            .toFixed(2)
                            .replace(/\.?0+$/, '')
                        : ''
                    }
                    onChange={(e) =>
                      updateParticipantPercent(index, e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={params.participants.length <= 1}
                    onClick={() => removeParticipant(index)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {/* Validation */}
              <div className="mt-2 flex items-center gap-3 border-t pt-3">
                <span className="text-sm font-medium">Total:</span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    participantValidation.valid
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {(
                    params.participants.reduce(
                      (s, p) => s + p.percentage_share,
                      0,
                    ) * 100
                  )
                    .toFixed(2)
                    .replace(/\.?0+$/, '')}
                  %
                </span>
                {!participantValidation.valid &&
                  participantValidation.message && (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {participantValidation.message}
                    </span>
                  )}
                {participantValidation.valid && (
                  <span className="text-xs text-green-600 dark:text-green-400">
                    (completo)
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Simulate Button */}
          <Button
            className="w-full"
            size="lg"
            disabled={!canSimulate}
            onClick={handleSimulate}
          >
            <Calculator className="size-4" />
            Simular
          </Button>
        </div>

        {/* ── Right Panel: Results ─────────────────────────────────────── */}
        <div className="space-y-6">
          {!result && !comparisonScenario && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Calculator className="mb-4 size-12 text-muted-foreground/40" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  Nenhuma simulacao realizada
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground/70">
                  Preencha os parametros ao lado e clique em Simular para ver os
                  resultados.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Comparison side by side */}
          {isComparing && comparisonScenario && result && (
            <ComparisonView
              scenarioA={comparisonScenario}
              scenarioB={{ params, result }}
              getNameA={getComparisonParticipantName}
              getNameB={getParticipantName}
            />
          )}

          {/* Single result view */}
          {result && !isComparing && (
            <ResultView
              result={result}
              params={params}
              getParticipantName={getParticipantName}
              pieData={pieData}
            />
          )}

          {/* Show comparison scenario A while user is configuring B */}
          {isComparing && comparisonScenario && !result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline">Cenario A</Badge>
                  Resultado Anterior
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Valor do Credito
                    </span>
                    <CurrencyDisplay
                      value={comparisonScenario.params.creditValue}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comissao Total</span>
                    <CurrencyDisplay
                      value={comparisonScenario.result.totalCommission}
                      className="font-semibold"
                    />
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Configure o novo cenario e clique em Simular para ver a
                  comparacao.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Result View ────────────────────────────────────────────────────────────

function ResultView({
  result,
  params,
  getParticipantName,
  pieData,
}: {
  result: SimulationBreakdown
  params: SimParams
  getParticipantName: (id: string) => string
  pieData: Array<{ name: string; value: number }>
}) {
  return (
    <>
      {/* Commission Total */}
      <Card>
        <CardHeader>
          <CardTitle>Comissao Total</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums text-primary">
            {formatCurrency(result.totalCommission)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatPercentage(params.commissionModel)} sobre{' '}
            {formatCurrency(params.creditValue)}
          </p>
        </CardContent>
      </Card>

      {/* Installments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">N.o</TableHead>
                  <TableHead>% Credito</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.installments.map((inst) => (
                  <TableRow key={inst.installment_number}>
                    <TableCell className="font-medium">
                      {inst.installment_number}
                    </TableCell>
                    <TableCell>
                      {formatPercentage(inst.percentage_of_credit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(inst.value)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDate(inst.due_date)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Distribution by Participant */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuicao por Participante</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  {result.installments.map((inst) => (
                    <TableHead
                      key={inst.installment_number}
                      className="text-right"
                    >
                      P{inst.installment_number}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-semibold">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.participantTotals.map((pt) => (
                  <TableRow key={pt.participant_id}>
                    <TableCell className="font-medium">
                      {getParticipantName(pt.participant_id)}
                    </TableCell>
                    {result.installments.map((inst) => {
                      const dist = result.distributions.find(
                        (d) =>
                          d.participant_id === pt.participant_id &&
                          d.installment_number === inst.installment_number,
                      )
                      return (
                        <TableCell
                          key={inst.installment_number}
                          className="text-right tabular-nums"
                        >
                          {dist ? formatCurrency(dist.value) : '-'}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(pt.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuicao Visual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${((percent ?? 0) * 100).toFixed(1)}%)`
                    }
                    labelLine
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: unknown) => formatCurrency(Number(value) || 0)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

// ─── Comparison View ────────────────────────────────────────────────────────

function ComparisonView({
  scenarioA,
  scenarioB,
  getNameA,
  getNameB,
}: {
  scenarioA: SimScenario
  scenarioB: SimScenario
  getNameA: (id: string) => string
  getNameB: (id: string) => string
}) {
  const diff =
    scenarioB.result.totalCommission - scenarioA.result.totalCommission
  const diffPercent =
    scenarioA.result.totalCommission > 0
      ? (diff / scenarioA.result.totalCommission) * 100
      : 0

  return (
    <>
      {/* Summary Comparison */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline" className="text-blue-600">
                A
              </Badge>
              Cenario A
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Credito</span>
              <CurrencyDisplay value={scenarioA.params.creditValue} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Comissao</span>
              <span className="font-medium">
                {formatPercentage(scenarioA.params.commissionModel)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm font-medium">Total</span>
              <CurrencyDisplay
                value={scenarioA.result.totalCommission}
                className="text-lg font-bold"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant="outline" className="text-green-600">
                B
              </Badge>
              Cenario B
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Credito</span>
              <CurrencyDisplay value={scenarioB.params.creditValue} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Comissao</span>
              <span className="font-medium">
                {formatPercentage(scenarioB.params.commissionModel)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm font-medium">Total</span>
              <CurrencyDisplay
                value={scenarioB.result.totalCommission}
                className="text-lg font-bold"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Difference */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Diferenca (B - A)</span>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'text-lg font-bold tabular-nums',
                  diff > 0
                    ? 'text-green-600 dark:text-green-400'
                    : diff < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground',
                )}
              >
                {diff > 0 ? '+' : ''}
                {formatCurrency(diff)}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  diff > 0
                    ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400'
                    : diff < 0
                      ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                      : '',
                )}
              >
                {diff > 0 ? '+' : ''}
                {diffPercent.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installment comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo de Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">N.o</TableHead>
                  <TableHead className="text-right">
                    <Badge variant="outline" className="text-blue-600">
                      A
                    </Badge>
                  </TableHead>
                  <TableHead className="text-right">
                    <Badge variant="outline" className="text-green-600">
                      B
                    </Badge>
                  </TableHead>
                  <TableHead className="text-right">Diferenca</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(
                  {
                    length: Math.max(
                      scenarioA.result.installments.length,
                      scenarioB.result.installments.length,
                    ),
                  },
                  (_, i) => {
                    const instA = scenarioA.result.installments[i]
                    const instB = scenarioB.result.installments[i]
                    const valA = instA?.value ?? 0
                    const valB = instB?.value ?? 0
                    const d = valB - valA

                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{i + 1}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {instA ? formatCurrency(valA) : '-'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {instB ? formatCurrency(valB) : '-'}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums font-medium',
                            d > 0
                              ? 'text-green-600 dark:text-green-400'
                              : d < 0
                                ? 'text-red-600 dark:text-red-400'
                                : '',
                          )}
                        >
                          {d !== 0
                            ? `${d > 0 ? '+' : ''}${formatCurrency(d)}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  },
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Participant comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo por Participante</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead className="text-right">
                    <Badge variant="outline" className="text-blue-600">
                      A
                    </Badge>
                  </TableHead>
                  <TableHead className="text-right">
                    <Badge variant="outline" className="text-green-600">
                      B
                    </Badge>
                  </TableHead>
                  <TableHead className="text-right">Diferenca</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Scenario A participants */}
                {scenarioA.result.participantTotals.map((ptA) => {
                  const nameA = getNameA(ptA.participant_id)
                  // Try to find matching participant in B by name
                  const matchB = scenarioB.result.participantTotals.find(
                    (ptB) => getNameB(ptB.participant_id) === nameA,
                  )
                  const valB = matchB?.total ?? 0
                  const d = valB - ptA.total

                  return (
                    <TableRow key={ptA.participant_id}>
                      <TableCell className="font-medium">{nameA}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(ptA.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {matchB ? formatCurrency(valB) : '-'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right tabular-nums font-medium',
                          d > 0
                            ? 'text-green-600 dark:text-green-400'
                            : d < 0
                              ? 'text-red-600 dark:text-red-400'
                              : '',
                        )}
                      >
                        {matchB && d !== 0
                          ? `${d > 0 ? '+' : ''}${formatCurrency(d)}`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {/* B-only participants */}
                {scenarioB.result.participantTotals
                  .filter((ptB) => {
                    const nameB = getNameB(ptB.participant_id)
                    return !scenarioA.result.participantTotals.some(
                      (ptA) => getNameA(ptA.participant_id) === nameB,
                    )
                  })
                  .map((ptB) => (
                    <TableRow key={ptB.participant_id}>
                      <TableCell className="font-medium">
                        {getNameB(ptB.participant_id)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        -
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(ptB.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-green-600 dark:text-green-400">
                        +{formatCurrency(ptB.total)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
