import { supabase } from '@/lib/supabase'
import type {
  CommissionRule,
  CommissionRuleInsert,
  CommissionRuleUpdate,
  ProductType,
} from '@/shared/types'

const TABLE = 'commission_rules'

export async function getCommissionRules(): Promise<CommissionRule[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('product_type')
    .order('name')

  if (error) throw error
  return data
}

export async function getCommissionRule(id: string): Promise<CommissionRule> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createCommissionRule(
  rule: CommissionRuleInsert,
): Promise<CommissionRule> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(rule)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCommissionRule(
  id: string,
  rule: CommissionRuleUpdate,
): Promise<CommissionRule> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(rule)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCommissionRule(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)

  if (error) throw error
}

export async function getCommissionRulesByProduct(
  productType: ProductType,
): Promise<CommissionRule[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('product_type', productType)
    .order('name')

  if (error) throw error
  return data
}
