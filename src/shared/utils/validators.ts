import { z } from 'zod'

// ─── Participant ─────────────────────────────────────────────────────────────

export const participantSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['consultant', 'partner', 'office', 'intermediary'], {
    message: 'Tipo inválido',
  }),
  document: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  parent_id: z.string().uuid('ID inválido').optional().or(z.literal('')),
})

export type ParticipantFormValues = z.infer<typeof participantSchema>

// ─── Commission Rule ─────────────────────────────────────────────────────────

export const commissionRuleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  product_type: z.enum(['imovel', 'auto', 'servico', 'outros'], {
    message: 'Tipo de produto inválido',
  }),
  commission_model: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(1, 'Máximo 100%'),
  installments: z
    .array(
      z.object({
        number: z.number().int().positive('Número da parcela deve ser positivo'),
        percentage_of_credit: z
          .number()
          .min(0, 'Mínimo 0%')
          .max(1, 'Máximo 100%'),
      })
    )
    .min(1, 'Pelo menos uma parcela é obrigatória'),
})

export type CommissionRuleFormValues = z.infer<typeof commissionRuleSchema>

// ─── Operation ───────────────────────────────────────────────────────────────

export const operationSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  credit_value: z.number().positive('Valor do crédito deve ser positivo'),
  commission_model: z
    .number()
    .min(0, 'Mínimo 0%')
    .max(1, 'Máximo 100%'),
  product_type: z.enum(['imovel', 'auto', 'servico', 'outros'], {
    message: 'Tipo de produto inválido',
  }),
  commission_rule_id: z.string().uuid('ID inválido').optional().or(z.literal('')),
  operation_date: z.string().min(1, 'Data da operação é obrigatória'),
})

export type OperationFormValues = z.infer<typeof operationSchema>

// ─── Participant Assignment ──────────────────────────────────────────────────

export const participantAssignmentSchema = z
  .array(
    z.object({
      participant_id: z.string().uuid('ID do participante inválido'),
      percentage_share: z
        .number()
        .min(0, 'Mínimo 0%')
        .max(1, 'Máximo 100%'),
      role_in_operation: z.string().optional(),
    })
  )
  .min(1, 'Pelo menos um participante é obrigatório')
  .refine(
    (participants) => {
      const sum = participants.reduce((acc, p) => acc + p.percentage_share, 0)
      return Math.abs(sum - 1.0) < 0.001
    },
    { message: 'A soma das participações deve ser igual a 100%' }
  )

export type ParticipantAssignmentFormValues = z.infer<typeof participantAssignmentSchema>

// ─── Payment ─────────────────────────────────────────────────────────────────

export const paymentSchema = z.object({
  distribution_id: z.string().uuid('ID da distribuição inválido'),
  amount: z.number().positive('Valor deve ser positivo'),
  payment_date: z.string().min(1, 'Data do pagamento é obrigatória'),
  method: z.enum(['pix', 'transfer', 'cash', 'check', 'other'], {
    message: 'Método de pagamento inválido',
  }),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export type PaymentFormValues = z.infer<typeof paymentSchema>
