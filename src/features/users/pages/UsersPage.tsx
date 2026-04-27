import { useState, useEffect } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserPlus,
  Shield,
  User,
  Copy,
  Check,
  Eye,
  EyeOff,
  MoreHorizontal,
  KeyRound,
  Ban,
  Pencil,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getCommissionRules } from "@/features/commission-rules/services/commissionRuleService";
import type { CommissionRule, ProductType } from "@/shared/types";

// ─── Types ──────────────────────────────────────────────────────────────────

type DbRole = "admin" | "manager" | "consultant" | "partner";

const PRODUCT_LABELS: Record<ProductType, string> = {
  imovel: "Imóvel",
  auto: "Automóvel",
  servico: "Serviços",
  outros: "Outros",
};

// Roles that have RLS-filtered access — for these we let admin pick which rules
// they can see. admin/manager always see everything via RLS.
function isLimitedRole(role: DbRole): boolean {
  return role === "consultant" || role === "partner";
}

async function getRuleIdsForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_commission_rules")
    .select("rule_id")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((r) => r.rule_id as string);
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: DbRole;
  created_at: string;
  banned_until?: string | null;
}

const ROLE_LABELS: Record<DbRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  consultant: "Consultor",
  partner: "Parceiro",
};

// ─── Edge Function helpers ──────────────────────────────────────────────────

async function callEdgeFunction(fnName: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessao expirada. Faca login novamente.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const response = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Erro ${response.status}`);
  }
  return result;
}

// ─── Service functions ──────────────────────────────────────────────────────

async function getUsers(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

// ─── CommissionRulesPicker ──────────────────────────────────────────────────

interface CommissionRulesPickerProps {
  rules: CommissionRule[];
  value: string[];
  onChange: (ids: string[]) => void;
}

function CommissionRulesPicker({ rules, value, onChange }: CommissionRulesPickerProps) {
  const activeRules = rules.filter((r) => r.is_active);
  const grouped = activeRules.reduce<Record<string, CommissionRule[]>>((acc, r) => {
    (acc[r.product_type] ||= []).push(r);
    return acc;
  }, {});

  const allIds = activeRules.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => value.includes(id));
  const noneSelected = value.length === 0;

  const toggle = (id: string, checked: boolean) => {
    if (checked) onChange([...value, id]);
    else onChange(value.filter((v) => v !== id));
  };

  if (activeRules.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
        Nenhuma regra de comissão ativa cadastrada.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 text-xs">
        <span className="text-muted-foreground tabular-nums">
          {value.length} de {activeRules.length} selecionada(s)
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange(allIds)}
            disabled={allSelected}
          >
            Marcar todas
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange([])}
            disabled={noneSelected}
          >
            Limpar
          </Button>
        </div>
      </div>
      <ScrollArea className="max-h-64">
        <div className="space-y-3 p-3">
          {(Object.keys(grouped) as ProductType[]).map((productType, idx) => (
            <div key={productType} className="space-y-1.5">
              {idx > 0 && <Separator className="my-2" />}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {PRODUCT_LABELS[productType] ?? productType}
              </p>
              {grouped[productType].map((rule) => {
                const id = `rule-${rule.id}`;
                const checked = value.includes(rule.id);
                return (
                  <label
                    key={rule.id}
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(c) => toggle(rule.id, c === true)}
                    />
                    <span className="flex-1 text-sm">{rule.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {(rule.commission_model * 100).toFixed(2)}%
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Create form
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "consultant" as DbRole,
  });
  const [newUserRuleIds, setNewUserRuleIds] = useState<string[]>([]);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Edit form
  const [editRole, setEditRole] = useState<DbRole>("consultant");
  const [editName, setEditName] = useState("");
  const [editRuleIds, setEditRuleIds] = useState<string[]>([]);

  // ─── Load all commission rules (admin sees all via RLS) ───────────────────
  const { data: rules = [] } = useQuery({
    queryKey: ["commission-rules"],
    queryFn: getCommissionRules,
  });

  // ─── Load existing rule associations for the user being edited ────────────
  const { data: existingRuleIds } = useQuery({
    queryKey: ["user-commission-rules", selectedUser?.id],
    queryFn: () => getRuleIdsForUser(selectedUser!.id),
    enabled: !!selectedUser?.id && editDialogOpen,
  });

  // Reset password form
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  // ─── Create user mutation ─────────────────────────────────────────────────

  const createUserMutation = useMutation({
    mutationFn: () =>
      callEdgeFunction("admin-create-user", {
        email: newUser.email,
        password: newUser.password,
        full_name: newUser.full_name,
        role: newUser.role,
        // Only send rule ids for limited roles. Admin/manager bypass via RLS.
        commission_rule_ids: isLimitedRole(newUser.role) ? newUserRuleIds : [],
      }),
    onSuccess: () => {
      setCreatedCredentials({
        email: newUser.email,
        password: newUser.password,
      });
      setNewUser({ full_name: "", email: "", password: "", role: "consultant" });
      setNewUserRuleIds([]);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário criado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ─── Update role mutation ─────────────────────────────────────────────────

  const updateRoleMutation = useMutation({
    mutationFn: () =>
      callEdgeFunction("admin-update-user", {
        user_id: selectedUser!.id,
        action: "update_role",
        role: editRole,
        full_name: editName || undefined,
        // Only send rule ids for limited roles. Admin/manager bypass via RLS.
        // Sending [] for admin/manager clears any stale associations.
        commission_rule_ids: isLimitedRole(editRole) ? editRuleIds : [],
      }),
    onSuccess: () => {
      toast.success("Perfil atualizado!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-commission-rules", selectedUser?.id] });
      setEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ─── Toggle disable mutation ──────────────────────────────────────────────

  const toggleDisableMutation = useMutation({
    mutationFn: ({ userId, enable }: { userId: string; enable: boolean }) =>
      callEdgeFunction("admin-update-user", {
        user_id: userId,
        action: enable ? "enable" : "disable",
      }),
    onSuccess: (_, { enable }) => {
      toast.success(enable ? "Usuário reativado!" : "Usuário desativado!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ─── Reset password mutation ──────────────────────────────────────────────

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      callEdgeFunction("admin-update-user", {
        user_id: selectedUser!.id,
        action: "reset_password",
        password: resetPassword,
      }),
    onSuccess: () => {
      toast.success("Senha redefinida!");
      setResetPasswordDialogOpen(false);
      setSelectedUser(null);
      setResetPassword("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `Acesse o ComissaoPro:\nhttps://comissao.consorciosracon.com.br\nEmail: ${createdCredentials.email}\nSenha: ${createdCredentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditName(user.full_name || "");
    setEditRuleIds([]); // hydrated by the useEffect below once the query resolves
    setEditDialogOpen(true);
  };

  // Hydrate the rule picker once the query resolves
  useEffect(() => {
    if (existingRuleIds) {
      setEditRuleIds(existingRuleIds);
    }
  }, [existingRuleIds]);

  const openResetPasswordDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setResetPassword(generatePassword());
    setShowResetPassword(true);
    setResetPasswordDialogOpen(true);
  };

  const getRoleBadge = (role: DbRole) => {
    const isAdminRole = role === "admin" || role === "manager";
    return (
      <Badge variant={isAdminRole ? "default" : "secondary"} className="gap-1">
        {isAdminRole ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
        {ROLE_LABELS[role] || role}
      </Badge>
    );
  };

  const isSelf = (userId: string) => currentUser?.id === userId;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciar Usuários"
        description="Crie e gerencie acessos de consultores e administradores"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Usuários do Sistema</CardTitle>
          <Button className="gap-2" onClick={() => {
            setCreatedCredentials(null);
            setCreateDialogOpen(true);
          }}>
            <UserPlus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (
                  <TableRow key={u.id} className={isSelf(u.id) ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">
                      {u.full_name || "—"}
                      {isSelf(u.id) && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Eu
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {!isSelf(u.id) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(u)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetPasswordDialog(u)}>
                              <KeyRound className="mr-2 h-4 w-4" />
                              Redefinir senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                toggleDisableMutation.mutate({
                                  userId: u.id,
                                  enable: false,
                                })
                              }
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Desativar acesso
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(users ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      Nenhum usuário cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Create User Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            setCreatedCredentials(null);
            setShowPassword(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {createdCredentials ? (
            <>
              <DialogHeader>
                <DialogTitle>Usuário Criado!</DialogTitle>
                <DialogDescription>
                  Envie as credenciais para o consultor
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="text-sm">
                    <strong>Link:</strong>{" "}
                    <span className="text-primary">
                      https://comissao.consorciosracon.com.br
                    </span>
                  </p>
                  <p className="text-sm">
                    <strong>Email:</strong> {createdCredentials.email}
                  </p>
                  <p className="text-sm">
                    <strong>Senha:</strong> {createdCredentials.password}
                  </p>
                </div>
                <Button
                  onClick={handleCopyCredentials}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar para enviar via WhatsApp
                    </>
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setCreateDialogOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Crie um acesso para um consultor ou administrador
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    placeholder="Ex: João Silva"
                    value={newUser.full_name}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        full_name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="consultor@email.com"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setNewUser((prev) => ({
                          ...prev,
                          password: generatePassword(),
                        }))
                      }
                    >
                      Gerar
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Perfil de Acesso</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(v) =>
                      setNewUser((prev) => ({
                        ...prev,
                        role: v as DbRole,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consultant">
                        Consultor — vê só as próprias operações
                      </SelectItem>
                      <SelectItem value="partner">
                        Parceiro — vê só as próprias operações
                      </SelectItem>
                      <SelectItem value="manager">
                        Gerente — acesso administrativo
                      </SelectItem>
                      <SelectItem value="admin">
                        Administrador — acesso total
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isLimitedRole(newUser.role) ? (
                  <div className="space-y-2">
                    <Label>Regras de Comissão Disponíveis</Label>
                    <CommissionRulesPicker
                      rules={rules}
                      value={newUserRuleIds}
                      onChange={setNewUserRuleIds}
                    />
                    {newUserRuleIds.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Sem regras marcadas, o usuário não verá nenhuma regra de comissão.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Administradores e gerentes têm acesso a todas as regras de comissão automaticamente.
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => createUserMutation.mutate()}
                  disabled={
                    createUserMutation.isPending ||
                    !newUser.full_name.trim() ||
                    !newUser.email.trim() ||
                    !newUser.password ||
                    newUser.password.length < 6
                  }
                >
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Usuário"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Edit User Dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere o nome ou perfil de{" "}
              <span className="font-medium">
                {selectedUser?.full_name || selectedUser?.email}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as DbRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isLimitedRole(editRole) ? (
              <div className="space-y-2">
                <Label>Regras de Comissão Disponíveis</Label>
                <CommissionRulesPicker
                  rules={rules}
                  value={editRuleIds}
                  onChange={setEditRuleIds}
                />
                {editRuleIds.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sem regras marcadas, o usuário não verá nenhuma regra de comissão.
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Administradores e gerentes têm acesso a todas as regras de comissão automaticamente.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => updateRoleMutation.mutate()}
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reset Password Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={resetPasswordDialogOpen}
        onOpenChange={(open) => {
          setResetPasswordDialogOpen(open);
          if (!open) {
            setSelectedUser(null);
            setResetPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Nova senha para{" "}
              <span className="font-medium">
                {selectedUser?.full_name || selectedUser?.email}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showResetPassword ? "text" : "password"}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                >
                  {showResetPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResetPassword(generatePassword())}
            >
              Gerar senha
            </Button>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setResetPasswordDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => resetPasswordMutation.mutate()}
              disabled={
                resetPasswordMutation.isPending || resetPassword.length < 6
              }
            >
              {resetPasswordMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
