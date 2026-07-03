import type { SupabaseClient } from '@supabase/supabase-js'
import { daysFromNowISO, monthBounds } from '../lib/dates'

export const loadAssistantContext = async (
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
  memberId: string,
) => {
  const { start, end, month } = monthBounds()
  const [profileResult, memoriesResult, tasksResult, shoppingResult, inventoryResult, financesResult, allFinancesResult] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('memories')
      .select('key,value,category,importance,scope')
      .eq('household_id', householdId)
      .or(`scope.eq.shared,and(scope.eq.personal,member_id.eq.${memberId})`)
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase
      .from('tasks')
      .select('id,title,description,status,priority,due_date')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(15),
    supabase
      .from('shopping_items')
      .select('id,name,quantity,unit,category,purchased')
      .eq('household_id', householdId)
      .eq('purchased', false)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('inventory')
      .select('id,name,quantity,unit,expiration_date,location')
      .eq('household_id', householdId)
      .not('expiration_date', 'is', null)
      .lte('expiration_date', daysFromNowISO(14))
      .order('expiration_date', { ascending: true })
      .limit(15),
    supabase
      .from('finances')
      .select('type,amount,category,description,transaction_date')
      .eq('household_id', householdId)
      .gte('transaction_date', start)
      .lt('transaction_date', end)
      .order('transaction_date', { ascending: false })
      .limit(100),
    supabase
      .from('finances')
      .select('type,amount')
      .eq('household_id', householdId),
  ])

  const finances = (financesResult.data || []).reduce(
    (acc, item) => {
      const amount = Number(item.amount)
      if (item.type === 'income') acc.income += amount
      else acc.expense += amount
      return acc
    },
    { income: 0, expense: 0 },
  )

  const currentBalance = (allFinancesResult.data || []).reduce(
    (total, item) => total + (item.type === 'income' ? Number(item.amount) : -Number(item.amount)),
    0,
  )

  return {
    profile: profileResult.data || {
      full_name: null,
      timezone: 'America/Santiago',
      currency: 'CLP',
      preferences: {},
    },
    memories: memoriesResult.data || [],
    pending_tasks: tasksResult.data || [],
    pending_shopping: shoppingResult.data || [],
    expiring_inventory: inventoryResult.data || [],
    finance_month: {
      month,
      income: finances.income,
      expense: finances.expense,
      balance: finances.income - finances.expense,
      current_balance: currentBalance,
    },
  }
}
