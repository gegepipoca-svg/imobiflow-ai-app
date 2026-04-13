import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/shared/components/PageHeader'
import { PARTICIPANT_TYPE_LABELS } from '@/shared/utils/constants'
import { participantSchema, type ParticipantFormValues } from '@/shared/utils/validators'
import type { ParticipantType } from '@/shared/types'
import {
  useParticipant,
  useParticipants,
  useCreateParticipant,
  useUpdateParticipant,
} from '../hooks/useParticipants'

export default function ParticipantFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const { data: participant, isLoading: isLoadingParticipant } = useParticipant(id)
  const { data: allParticipants = [], isLoading: isLoadingParticipants } = useParticipants()
  const createMutation = useCreateParticipant()
  const updateMutation = useUpdateParticipant()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ParticipantFormValues & { is_active?: boolean }>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      name: '',
      type: 'consultant',
      document: '',
      email: '',
      phone: '',
      parent_id: '',
    },
  })

  const watchedType = watch('type')
  const watchedParentId = watch('parent_id')
  const watchedIsActive = watch('is_active')

  // Populate form when editing
  useEffect(() => {
    if (isEditing && participant) {
      reset({
        name: participant.name,
        type: participant.type,
        document: participant.document ?? '',
        email: participant.email ?? '',
        phone: participant.phone ?? '',
        parent_id: participant.parent_id ?? '',
        is_active: participant.is_active,
      })
    }
  }, [isEditing, participant, reset])

  // Filter out the current participant from parent options to prevent self-referencing
  const parentOptions = allParticipants.filter((p) => p.id !== id)

  const isMutating = createMutation.isPending || updateMutation.isPending

  function onSubmit(values: ParticipantFormValues & { is_active?: boolean }) {
    if (isEditing && id) {
      updateMutation.mutate(
        {
          id,
          data: {
            ...values,
            is_active: values.is_active,
          },
        },
        { onSuccess: () => navigate('/participants') },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => navigate('/participants'),
      })
    }
  }

  if (isEditing && isLoadingParticipant) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Editar Participante' : 'Novo Participante'}
        description={
          isEditing
            ? 'Atualize os dados do participante.'
            : 'Preencha os dados para cadastrar um novo participante.'
        }
        action={
          <Link to="/participants" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Dados do Participante</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Nome completo"
                  {...register('name')}
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={watchedType}
                  onValueChange={(val) =>
                    setValue('type', val as ParticipantType, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o tipo">
                      {watchedType ? PARTICIPANT_TYPE_LABELS[watchedType as ParticipantType] : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PARTICIPANT_TYPE_LABELS) as [ParticipantType, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-destructive">{errors.type.message}</p>
                )}
              </div>

              {/* Documento */}
              <div className="space-y-2">
                <Label htmlFor="document">Documento</Label>
                <Input
                  id="document"
                  placeholder="CPF ou CNPJ"
                  {...register('document')}
                />
              </div>

              {/* E-mail */}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  {...register('phone')}
                />
              </div>

              {/* Participante Pai */}
              <div className="space-y-2">
                <Label>Participante Pai</Label>
                <Select
                  value={watchedParentId ?? ''}
                  onValueChange={(val) =>
                    setValue('parent_id', val === '__none__' ? '' : (val ?? undefined), {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full" disabled={isLoadingParticipants}>
                    <SelectValue placeholder="Nenhum (raiz)">
                      {watchedParentId
                        ? parentOptions.find((p) => p.id === watchedParentId)?.name ?? null
                        : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum (raiz)</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status (edit only) */}
            {isEditing && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_active"
                  checked={watchedIsActive ?? true}
                  onCheckedChange={(checked) =>
                    setValue('is_active', Boolean(checked), { shouldValidate: true })
                  }
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Participante ativo
                </Label>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Link to="/participants" className={buttonVariants({ variant: "outline" })}>Cancelar</Link>
              <Button type="submit" disabled={isMutating || isSubmitting}>
                {isMutating && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? 'Salvar Alterações' : 'Criar Participante'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
