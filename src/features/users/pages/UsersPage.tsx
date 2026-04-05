import { useState } from "react";
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
import { UserPlus, Shield, User, Copy, Check, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  participant_id: string | null;
  created_at: string;
}

interface Participant {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
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

async function getConsultantParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, type, is_active")
    .eq("type", "consultant")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as Participant[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "consultor" as "admin" | "consultor",
    participant_id: "",
  });
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const { data: participants } = useQuery({
    queryKey: ["consultant-participants"],
    queryFn: getConsultantParticipants,
  });

  const handleCreateUser = async () => {
    setError("");
    setCreating(true);

    try {
      // 1. Create auth user via Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: newUser.email,
          password: newUser.password,
          options: {
            data: {
              full_name: newUser.full_name,
              role: newUser.role,
            },
          },
        });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário");

      // 2. Upsert profile with role
      const profileData: Record<string, unknown> = {
        id: authData.user.id,
        full_name: newUser.full_name,
        role: newUser.role,
      };
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profileData);

      if (profileError) throw profileError;

      // 3. Show credentials
      setCreatedCredentials({
        email: newUser.email,
        password: newUser.password,
      });

      // Reset form
      setNewUser({
        full_name: "",
        email: "",
        password: "",
        role: "consultor",
        participant_id: "",
      });

      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `Acesse o ComissãoPro:\n🔗 https://comissao.consorciosracon.com.br\n📧 Email: ${createdCredentials.email}\n🔑 Senha: ${createdCredentials.password}`;
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
    setNewUser((prev) => ({ ...prev, password: pass }));
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return (
        <Badge variant="default" className="gap-1">
          <Shield className="h-3 w-3" />
          Admin
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <User className="h-3 w-3" />
        Consultor
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciar Usuários"
        description="Crie e gerencie acessos de consultores ao sistema"
      />

      {/* Create User Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Usuários do Sistema</CardTitle>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setCreatedCredentials(null);
                setError("");
              }
            }}
          >
            <DialogTrigger>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              {createdCredentials ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Usuário Criado com Sucesso!</DialogTitle>
                    <DialogDescription>
                      Envie as credenciais abaixo para o consultor
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
                    <DialogClose>
                      <Button>Fechar</Button>
                    </DialogClose>
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
                          onClick={generatePassword}
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
                            role: v as "admin" | "consultor",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consultor">
                            Consultor — vê só as próprias operações
                          </SelectItem>
                          <SelectItem value="admin">
                            Administrador — acesso total
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newUser.role === "consultor" && (
                      <div className="space-y-2">
                        <Label htmlFor="participant">
                          Vincular a Participante
                        </Label>
                        <Select
                          value={newUser.participant_id}
                          onValueChange={(v) =>
                            setNewUser((prev) => ({
                              ...prev,
                              participant_id: v ?? "",
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o participante..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(participants ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Vincule a um participante para ele ver apenas as
                          operações e comissões dele
                        </p>
                      </div>
                    )}
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose>
                      <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button
                      onClick={handleCreateUser}
                      disabled={
                        creating ||
                        !newUser.full_name ||
                        !newUser.email ||
                        !newUser.password
                      }
                    >
                      {creating ? "Criando..." : "Criar Usuário"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || "—"}
                    </TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {(users ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
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
    </div>
  );
}
