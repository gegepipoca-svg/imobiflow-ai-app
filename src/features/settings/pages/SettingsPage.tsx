import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  User,
  Shield,
  Settings2,
  Loader2,
  Save,
  KeyRound,
  Info,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { PageHeader } from '@/shared/components/PageHeader'
import { DataTable, type DataTableColumn } from '@/shared/components/DataTable'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { USER_ROLE_LABELS } from '@/shared/utils/constants'
import { formatDate } from '@/shared/utils/formatters'
import type { Profile, UserRole } from '@/shared/types'

// ─── Profile Service ──────────────────────────────────────────────────────────

async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')

  if (error) throw error
  return data
}

async function updateProfileName(
  userId: string,
  fullName: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId)

  if (error) throw error
}

async function updateProfileRole(
  userId: string,
  role: UserRole,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)

  if (error) throw error
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAdmin } = useAuth()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuracoes"
        description="Gerencie seu perfil e configuracoes do sistema"
      />

      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">
            <User className="size-4" />
            Perfil
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="usuarios">
              <Shield className="size-4" />
              Usuarios
            </TabsTrigger>
          )}
          <TabsTrigger value="sistema">
            <Settings2 className="size-4" />
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <ProfileTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="usuarios">
            <UsersTab />
          </TabsContent>
        )}

        <TabsContent value="sistema">
          <SystemTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { profile, user } = useAuth()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (profile) {
      // AuthProvider Profile uses 'name', DB Profile uses 'full_name'
      const currentName =
        (profile as unknown as Record<string, unknown>).full_name as string ||
        profile.name ||
        ''
      setName(currentName)
    }
  }, [profile])

  const updateNameMutation = useMutation({
    mutationFn: () => updateProfileName(user!.id, name),
    onSuccess: () => {
      toast.success('Nome atualizado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar nome: ${error.message}`)
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Senha alterada com sucesso.')
      setIsChangingPassword(false)
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (error: Error) => {
      toast.error(`Erro ao alterar senha: ${error.message}`)
    },
  })

  const handleSaveName = () => {
    if (!name.trim()) {
      toast.error('O nome nao pode estar vazio.')
      return
    }
    updateNameMutation.mutate()
  }

  const handleChangePassword = () => {
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas nao coincidem.')
      return
    }
    changePasswordMutation.mutate()
  }

  if (!profile || !user) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const profileRecord = profile as unknown as Record<string, unknown>
  const displayName =
    (profileRecord.full_name as string) || profile.name || ''
  const displayRole =
    USER_ROLE_LABELS[profile.role as UserRole] || profile.role

  return (
    <div className="space-y-6">
      {/* Current Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informacoes do Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Funcao</Label>
              <div>
                <Badge variant="outline">{displayRole}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Name */}
      <Card>
        <CardHeader>
          <CardTitle>Editar Nome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
            />
          </div>
          <Button
            onClick={handleSaveName}
            disabled={
              updateNameMutation.isPending || name.trim() === displayName
            }
          >
            {updateNameMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar Nome
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Seguranca</CardTitle>
        </CardHeader>
        <CardContent>
          {!isChangingPassword ? (
            <Button
              variant="outline"
              onClick={() => setIsChangingPassword(true)}
            >
              <KeyRound className="size-4" />
              Alterar Senha
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleChangePassword}
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Salvar Senha
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsChangingPassword(false)
                    setNewPassword('')
                    setConfirmPassword('')
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const queryClient = useQueryClient()
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('consultant')

  const {
    data: profiles = [],
    isLoading,
  } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: getAllProfiles,
  })

  const updateRoleMutation = useMutation({
    mutationFn: () => updateProfileRole(editingUser!.id, editRole),
    onSuccess: () => {
      toast.success('Funcao atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] })
      setEditingUser(null)
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar funcao: ${error.message}`)
    },
  })

  const columns: DataTableColumn<Profile>[] = [
    {
      key: 'full_name',
      header: 'Nome',
      sortable: true,
      cell: (row) => (
        <span className="font-medium">{row.full_name || '-'}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
    },
    {
      key: 'role',
      header: 'Funcao',
      sortable: true,
      cell: (row) => (
        <Badge variant="outline">
          {USER_ROLE_LABELS[row.role] || row.role}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Criado em',
      sortable: true,
      cell: (row) => (
        <span className="tabular-nums">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditingUser(row)
            setEditRole(row.role)
          }}
        >
          Editar
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={profiles}
            loading={isLoading}
            searchable
            searchKey="full_name"
            pagination
            pageSize={10}
            emptyMessage="Nenhum usuario encontrado."
          />
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Funcao</DialogTitle>
            <DialogDescription>
              Altere a funcao de{' '}
              <span className="font-medium">
                {editingUser?.full_name || editingUser?.email}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Funcao</Label>
              <Select
                value={editRole}
                onValueChange={(val) => {
                  if (val) setEditRole(val as UserRole)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(USER_ROLE_LABELS) as [UserRole, string][]
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              onClick={() => updateRoleMutation.mutate()}
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── System Tab ───────────────────────────────────────────────────────────────

function SystemTab() {
  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Configuracoes Gerais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-6 text-center">
            <Settings2 className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Configuracoes adicionais estarao disponiveis em breve.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4" />
            Sobre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Aplicacao</Label>
              <p className="text-sm font-medium">ComissãoPro</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Versao</Label>
              <p className="text-sm font-medium">1.0.0</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Stack</Label>
              <p className="text-sm font-medium">
                React 19 + TypeScript + Supabase
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Ambiente</Label>
              <p className="text-sm font-medium">
                {import.meta.env.MODE === 'production'
                  ? 'Producao'
                  : 'Desenvolvimento'}
              </p>
            </div>
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground">
            Sistema de gestao de comissoes imobiliarias. Desenvolvido com
            tecnologia de ponta para automatizar e otimizar o controle
            financeiro de operacoes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
