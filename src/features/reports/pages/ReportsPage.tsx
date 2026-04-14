import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/shared/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Badge imported if needed later
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  FileSpreadsheet,
  Filter,
  TrendingUp,
  CheckCircle,
  Clock,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/shared/utils/formatters";
import {
  DISTRIBUTION_STATUS_LABELS,
} from "@/shared/utils/constants";
import type { DistributionStatus } from "@/shared/types";
import { useAuth } from "@/features/auth/hooks/useAuth";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportRow {
  distributionId: string;
  participantId: string;
  participantName: string;
  participantType: string;
  operationCode: string;
  operationDate: string;
  productType: string;
  creditValue: number;
  installmentNumber: number;
  commissionAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: DistributionStatus;
  lastPaymentDate: string | null;
  lastPaymentMethod: string | null;
}

interface ReportSummary {
  totalCommission: number;
  totalPaid: number;
  totalPending: number;
  rowCount: number;
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

async function fetchReportData(): Promise<ReportRow[]> {
  // Fetch all distributions with full context
  const { data: distributions, error: distError } = await supabase
    .from("commission_distributions")
    .select(
      `
      id,
      value,
      status,
      participant_id,
      participant:participants(id, name, type),
      installment:commission_installments(
        installment_number,
        operation_id,
        operation:operations(code, operation_date, product_type, credit_value)
      )
    `
    )
    .order("created_at", { ascending: false });

  if (distError) throw distError;

  // Fetch all payments
  const { data: payments, error: payError } = await supabase
    .from("payments")
    .select("distribution_id, amount, payment_date, method")
    .order("payment_date", { ascending: false });

  if (payError) throw payError;

  // Group payments by distribution
  const paymentsByDist = new Map<
    string,
    { total: number; lastDate: string | null; lastMethod: string | null }
  >();

  for (const p of payments ?? []) {
    const existing = paymentsByDist.get(p.distribution_id);
    if (existing) {
      existing.total += p.amount;
    } else {
      paymentsByDist.set(p.distribution_id, {
        total: p.amount,
        lastDate: p.payment_date,
        lastMethod: p.method,
      });
    }
  }

  return (distributions ?? []).map((d) => {
    const participant = d.participant as unknown as {
      id: string;
      name: string;
      type: string;
    } | null;
    const installment = d.installment as unknown as {
      installment_number: number;
      operation: {
        code: string;
        operation_date: string;
        product_type: string;
        credit_value: number;
      } | null;
    } | null;

    const payInfo = paymentsByDist.get(d.id);
    const paidAmount = payInfo?.total ?? 0;

    return {
      distributionId: d.id,
      participantId: participant?.id ?? "",
      participantName: participant?.name ?? "Desconhecido",
      participantType: participant?.type ?? "",
      operationCode: installment?.operation?.code ?? "",
      operationDate: installment?.operation?.operation_date ?? "",
      productType: installment?.operation?.product_type ?? "",
      creditValue: installment?.operation?.credit_value ?? 0,
      installmentNumber: installment?.installment_number ?? 0,
      commissionAmount: (d as unknown as { value: number }).value ?? 0,
      paidAmount,
      pendingAmount: ((d as unknown as { value: number }).value ?? 0) - paidAmount,
      status: d.status as DistributionStatus,
      lastPaymentDate: payInfo?.lastDate ?? null,
      lastPaymentMethod: payInfo?.lastMethod ?? null,
    };
  });
}

async function fetchParticipantNames(): Promise<
  { id: string; name: string }[]
> {
  const { data, error } = await supabase
    .from("participants")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

function exportToCSV(rows: ReportRow[], filename: string) {
  const STATUS_LABELS: Record<string, string> = {
    pending: "Pendente",
    partial: "Parcial",
    paid: "Pago",
    reversed: "Estornado",
  };

  const PRODUCT_LABELS: Record<string, string> = {
    imovel: "Imóvel",
    auto: "Automóvel",
    servico: "Serviço",
    outros: "Outros",
  };

  const METHOD_LABELS: Record<string, string> = {
    pix: "PIX",
    transfer: "Transferência",
    cash: "Dinheiro",
    check: "Cheque",
    other: "Outro",
  };

  const headers = [
    "Consultor",
    "Operação",
    "Data Operação",
    "Tipo Produto",
    "Valor Crédito",
    "Parcela",
    "Comissão",
    "Pago",
    "Pendente",
    "Status",
    "Último Pgto",
    "Forma Pgto",
  ];

  // Escape CSV cells: wrap in quotes if contains ; " , or newline; double any embedded quotes
  const csvCell = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[";,\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csvRows: (string | number)[][] = rows.map((r) => [
    csvCell(r.participantName),
    csvCell(r.operationCode),
    csvCell(r.operationDate ? formatDate(r.operationDate) : ""),
    csvCell(PRODUCT_LABELS[r.productType] ?? r.productType),
    r.creditValue.toFixed(2).replace(".", ","),
    r.installmentNumber,
    r.commissionAmount.toFixed(2).replace(".", ","),
    r.paidAmount.toFixed(2).replace(".", ","),
    r.pendingAmount.toFixed(2).replace(".", ","),
    csvCell(STATUS_LABELS[r.status] ?? r.status),
    csvCell(r.lastPaymentDate ? formatDate(r.lastPaymentDate) : ""),
    csvCell(
      r.lastPaymentMethod
        ? METHOD_LABELS[r.lastPaymentMethod] ?? r.lastPaymentMethod
        : "",
    ),
  ]);

  // Add summary row
  const totalComm = rows.reduce((s, r) => s + r.commissionAmount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidAmount, 0);
  const totalPend = rows.reduce((s, r) => s + r.pendingAmount, 0);

  csvRows.push([]);
  csvRows.push([
    csvCell(`TOTAL (${rows.length} registros)`),
    "",
    "",
    "",
    "",
    "",
    totalComm.toFixed(2).replace(".", ","),
    totalPaid.toFixed(2).replace(".", ","),
    totalPend.toFixed(2).replace(".", ","),
    "",
    "",
    "",
  ]);

  const BOM = "\uFEFF";
  const csv =
    BOM +
    headers.map(csvCell).join(";") +
    "\n" +
    csvRows.map((row) => row.join(";")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: ReportSummary }) {
  const cards = [
    {
      label: "Comissão Total",
      value: summary.totalCommission,
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-blue-600",
    },
    {
      label: "Total Pago",
      value: summary.totalPaid,
      icon: <CheckCircle className="h-4 w-4" />,
      color: "text-green-600",
    },
    {
      label: "Total Pendente",
      value: summary.totalPending,
      icon: <Clock className="h-4 w-4" />,
      color: "text-amber-600",
    },
    {
      label: "Registros",
      value: summary.rowCount,
      icon: <FileSpreadsheet className="h-4 w-4" />,
      color: "text-muted-foreground",
      isCurrency: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className={`${c.color}`}>{c.icon}</div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {c.label}
                </p>
                <p className="text-lg font-bold">
                  {c.isCurrency === false
                    ? c.value
                    : formatCurrency(c.value)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadgeReport({ status }: { status: DistributionStatus }) {
  const variants: Record<DistributionStatus, string> = {
    pending:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    partial:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    reversed:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[status] ?? ""}`}
    >
      {DISTRIBUTION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { isConsultor, participantId } = useAuth();

  // Filters
  const [selectedParticipant, setSelectedParticipant] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");

  // Data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["report-data"],
    queryFn: fetchReportData,
  });

  const { data: participants } = useQuery({
    queryKey: ["report-participants"],
    queryFn: fetchParticipantNames,
  });

  // Apply filters
  const filteredData = useMemo(() => {
    let rows = reportData ?? [];

    // Consultor: only their data
    if (isConsultor && participantId) {
      rows = rows.filter((r) => r.participantId === participantId);
    }

    // Participant filter
    if (selectedParticipant !== "all") {
      rows = rows.filter((r) => r.participantId === selectedParticipant);
    }

    // Status filter
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }

    // Date range filter (by operation date)
    if (dateFrom) {
      rows = rows.filter((r) => r.operationDate >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((r) => r.operationDate <= dateTo);
    }

    // Text search (operation code or participant name)
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.participantName.toLowerCase().includes(search) ||
          r.operationCode.toLowerCase().includes(search)
      );
    }

    return rows;
  }, [
    reportData,
    selectedParticipant,
    statusFilter,
    dateFrom,
    dateTo,
    searchText,
    isConsultor,
    participantId,
  ]);

  // Summary
  const summary = useMemo<ReportSummary>(() => {
    return {
      totalCommission: filteredData.reduce(
        (s, r) => s + r.commissionAmount,
        0
      ),
      totalPaid: filteredData.reduce((s, r) => s + r.paidAmount, 0),
      totalPending: filteredData.reduce((s, r) => s + r.pendingAmount, 0),
      rowCount: filteredData.length,
    };
  }, [filteredData]);

  const clearFilters = () => {
    setSelectedParticipant("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchText("");
  };

  const hasActiveFilters =
    selectedParticipant !== "all" ||
    statusFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    searchText !== "";

  const handleExport = () => {
    const parts = ["relatorio-comissoes"];
    if (selectedParticipant !== "all") {
      const p = (participants ?? []).find(
        (x) => x.id === selectedParticipant
      );
      if (p) parts.push(p.name.replace(/\s+/g, "-").toLowerCase());
    }
    if (statusFilter !== "all") parts.push(statusFilter);
    if (dateFrom) parts.push(`de-${dateFrom}`);
    if (dateTo) parts.push(`ate-${dateTo}`);

    const filename = parts.join("_");
    exportToCSV(filteredData, filename);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isConsultor ? "Meu Relatório" : "Relatório de Comissões"}
        description={
          isConsultor
            ? "Exporte e acompanhe suas comissões"
            : "Filtre, analise e exporte relatórios de comissionamento"
        }
        action={
          <Button
            onClick={handleExport}
            disabled={filteredData.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Filtros</CardTitle>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1 text-xs"
              >
                <X className="h-3 w-3" />
                Limpar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="space-y-1.5">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Código ou nome..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            {/* Participant filter - admin only */}
            {!isConsultor && (
              <div className="space-y-1.5">
                <Label className="text-xs">Consultor</Label>
                <Select
                  value={selectedParticipant}
                  onValueChange={(v) =>
                    setSelectedParticipant(v ?? "all")
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os consultores</SelectItem>
                    {(participants ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v ?? "all")}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="reversed">Estornado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date from */}
            <div className="space-y-1.5">
              <Label className="text-xs">Período de</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Date to */}
            <div className="space-y-1.5">
              <Label className="text-xs">Período até</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {!isLoading && <SummaryCards summary={summary} />}

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum registro encontrado
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Ajuste os filtros para ver os dados
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isConsultor && (
                      <TableHead className="min-w-[150px]">
                        Consultor
                      </TableHead>
                    )}
                    <TableHead>Operação</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Pendente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Pgto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row) => (
                    <TableRow key={row.distributionId}>
                      {!isConsultor && (
                        <TableCell className="font-medium">
                          {row.participantName}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs">
                        {row.operationCode}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.operationDate
                          ? formatDate(row.operationDate)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.installmentNumber}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.commissionAmount)}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {row.paidAmount > 0
                          ? formatCurrency(row.paidAmount)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-amber-600 font-medium">
                        {row.pendingAmount > 0
                          ? formatCurrency(row.pendingAmount)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadgeReport status={row.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.lastPaymentDate
                          ? formatDate(row.lastPaymentDate)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Footer totals */}
              <Separator />
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                <span className="text-sm font-medium text-muted-foreground">
                  Total ({filteredData.length} registros)
                </span>
                <div className="flex gap-6 text-sm font-bold">
                  <span>
                    Comissão:{" "}
                    <span className="text-foreground">
                      {formatCurrency(summary.totalCommission)}
                    </span>
                  </span>
                  <span>
                    Pago:{" "}
                    <span className="text-green-600">
                      {formatCurrency(summary.totalPaid)}
                    </span>
                  </span>
                  <span>
                    Pendente:{" "}
                    <span className="text-amber-600">
                      {formatCurrency(summary.totalPending)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
