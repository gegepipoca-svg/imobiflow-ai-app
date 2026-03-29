import { PageHeader } from '@/shared/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/shared/utils/formatters'
import { PRODUCT_TYPE_LABELS, PARTICIPANT_TYPE_LABELS } from '@/shared/utils/constants'
import type { ProductType, ParticipantType } from '@/shared/types'
import {
  useDashboardKpis,
  useCommissionByParticipant,
  useCommissionByProductType,
  useMonthlyEvolution,
  useParticipantRanking,
  useFutureFlow,
} from '../hooks/useDashboard'
import {
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts'
import type { ReactNode } from 'react'

// ─── Chart color palette using CSS custom properties ─────────────────────────

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-')
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ]
  return `${months[parseInt(m, 10) - 1]}/${year.slice(2)}`
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`
  return formatCurrency(value)
}

function BrlTooltipFormatter(value: unknown): string {
  return formatCurrency(Number(value) || 0)
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: number
  icon: ReactNode
  isLoading: boolean
}

function KpiCard({ title, value, icon, isLoading }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className="text-xl font-bold tracking-tight">
                {formatCurrency(value)}
              </p>
            )}
          </div>
          <div className="rounded-md bg-muted p-2.5 text-muted-foreground">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Chart Skeleton ──────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[250px] w-full" />
    </div>
  )
}

// ─── Commission by Participant Chart ─────────────────────────────────────────

function CommissionByParticipantChart() {
  const { data, isLoading } = useCommissionByParticipant()

  if (isLoading) return <ChartSkeleton />

  if (!data?.length) {
    return <EmptyChart message="Sem dados de comissão por participante" />
  }

  const chartData = data.map((d) => ({
    name: d.name.length > 18 ? `${d.name.slice(0, 16)}...` : d.name,
    fullName: d.name,
    value: d.totalCommission,
    type: PARTICIPANT_TYPE_LABELS[d.type as ParticipantType] ?? d.type,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={formatCompactCurrency}
          fontSize={12}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          fontSize={12}
          tick={{ fill: 'hsl(var(--foreground))' }}
        />
        <Tooltip
          formatter={(value: unknown) => [BrlTooltipFormatter(value), 'Comissao']}
          labelFormatter={(_, payload) => {
            const item = payload?.[0]?.payload
            return item ? `${item.fullName} (${item.type})` : ''
          }}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        />
        <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Commission by Product Type Chart ────────────────────────────────────────

function CommissionByProductTypeChart() {
  const { data, isLoading } = useCommissionByProductType()

  if (isLoading) return <ChartSkeleton />

  if (!data?.length) {
    return <EmptyChart message="Sem dados de comissao por tipo de produto" />
  }

  const chartData = data.map((d) => ({
    name: PRODUCT_TYPE_LABELS[d.productType as ProductType] ?? d.productType,
    value: d.totalCommission,
    count: d.operationCount,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={4}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) =>
            `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: unknown) => [BrlTooltipFormatter(value), 'Comissao']}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        />
        <Legend
          verticalAlign="bottom"
          formatter={(value: string) => (
            <span className="text-xs text-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ─── Monthly Evolution Chart ─────────────────────────────────────────────────

function MonthlyEvolutionChart() {
  const { data, isLoading } = useMonthlyEvolution()

  if (isLoading) return <ChartSkeleton />

  if (!data?.length) {
    return <EmptyChart message="Sem dados de evolucao mensal" />
  }

  const chartData = data.map((d) => ({
    month: formatMonthLabel(d.month),
    Gerada: d.generated,
    Paga: d.paid,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ left: 10, right: 20, top: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          fontSize={12}
          tick={{ fill: 'hsl(var(--foreground))' }}
        />
        <YAxis
          tickFormatter={formatCompactCurrency}
          fontSize={12}
          tick={{ fill: 'hsl(var(--foreground))' }}
        />
        <Tooltip
          formatter={(value: unknown, name: unknown) => [
            BrlTooltipFormatter(value),
            String(name ?? ''),
          ]}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="Gerada"
          stroke={CHART_COLORS[0]}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="Paga"
          stroke={CHART_COLORS[1]}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Participant Ranking Chart ───────────────────────────────────────────────

function ParticipantRankingChart() {
  const { data, isLoading } = useParticipantRanking()

  if (isLoading) return <ChartSkeleton />

  if (!data?.length) {
    return <EmptyChart message="Sem dados de ranking de participantes" />
  }

  const chartData = data.map((d, i) => ({
    name: d.name.length > 18 ? `${d.name.slice(0, 16)}...` : d.name,
    fullName: d.name,
    value: d.totalEarned,
    type: PARTICIPANT_TYPE_LABELS[d.type as ParticipantType] ?? d.type,
    rank: i + 1,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={formatCompactCurrency}
          fontSize={12}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          fontSize={12}
          tick={{ fill: 'hsl(var(--foreground))' }}
        />
        <Tooltip
          formatter={(value: unknown) => [BrlTooltipFormatter(value), 'Total Recebido']}
          labelFormatter={(_, payload) => {
            const item = payload?.[0]?.payload
            return item ? `#${item.rank} ${item.fullName} (${item.type})` : ''
          }}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        />
        <Bar dataKey="value" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Future Flow Chart ───────────────────────────────────────────────────────

function FutureFlowChart() {
  const { data, isLoading } = useFutureFlow()

  if (isLoading) return <ChartSkeleton />

  if (!data?.length) {
    return <EmptyChart message="Sem dados de fluxo futuro" />
  }

  const chartData = data.map((d) => ({
    month: formatMonthLabel(d.month),
    Pendente: d.pending,
    Parcial: d.partial,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ left: 10, right: 20, top: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          fontSize={12}
          tick={{ fill: 'hsl(var(--foreground))' }}
        />
        <YAxis
          tickFormatter={formatCompactCurrency}
          fontSize={12}
          tick={{ fill: 'hsl(var(--foreground))' }}
        />
        <Tooltip
          formatter={(value: unknown, name: unknown) => [
            BrlTooltipFormatter(value),
            String(name ?? ''),
          ]}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="Pendente"
          stackId="1"
          stroke={CHART_COLORS[3]}
          fill={CHART_COLORS[3]}
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="Parcial"
          stackId="1"
          stroke={CHART_COLORS[4]}
          fill={CHART_COLORS[4]}
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Empty Chart Placeholder ─────────────────────────────────────────────────

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis()

  const kpiCards = [
    {
      title: 'Total de Credito',
      value: kpis?.totalCredit ?? 0,
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      title: 'Comissao Gerada',
      value: kpis?.commissionGenerated ?? 0,
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      title: 'Comissao Paga',
      value: kpis?.commissionPaid ?? 0,
      icon: <CheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Comissao Pendente',
      value: kpis?.commissionPending ?? 0,
      icon: <Clock className="h-5 w-5" />,
    },
    {
      title: 'Passivo Futuro',
      value: kpis?.futureLiability ?? 0,
      icon: <AlertTriangle className="h-5 w-5" />,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visao geral de comissoes e operacoes"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpiCards.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            isLoading={kpisLoading}
          />
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: Commission by Participant */}
        <Card>
          <CardHeader>
            <CardTitle>Comissao por Participante</CardTitle>
          </CardHeader>
          <CardContent>
            <CommissionByParticipantChart />
          </CardContent>
        </Card>

        {/* Chart 2: Commission by Product Type */}
        <Card>
          <CardHeader>
            <CardTitle>Comissao por Tipo de Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <CommissionByProductTypeChart />
          </CardContent>
        </Card>

        {/* Chart 3: Monthly Evolution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolucao Mensal de Comissoes</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyEvolutionChart />
          </CardContent>
        </Card>

        {/* Chart 4: Participant Ranking */}
        <Card>
          <CardHeader>
            <CardTitle>Ranking de Participantes</CardTitle>
          </CardHeader>
          <CardContent>
            <ParticipantRankingChart />
          </CardContent>
        </Card>

        {/* Chart 5: Future Cash Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Fluxo de Caixa Futuro</CardTitle>
          </CardHeader>
          <CardContent>
            <FutureFlowChart />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
