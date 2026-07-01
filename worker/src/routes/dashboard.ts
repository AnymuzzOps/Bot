import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { daysFromNowISO, monthBounds } from '../lib/dates'
import { assertNoDbError } from '../lib/errors'

export const dashboardRoutes = new Hono<AppEnv>()

dashboardRoutes.get('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const { start, end, month } = monthBounds()

  const [profile, tasks, shopping, inventory, finances, allFinances, activity] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('tasks').select('*').eq('user_id', user.id).eq('status', 'pending').order('due_date', { ascending: true, nullsFirst: false }).limit(6),
    supabase.from('shopping_items').select('*').eq('user_id', user.id).eq('purchased', false).order('created_at', { ascending: false }).limit(6),
    supabase.from('inventory').select('*').eq('user_id', user.id).not('expiration_date', 'is', null).lte('expiration_date', daysFromNowISO(14)).order('expiration_date', { ascending: true }).limit(6),
    supabase.from('finances').select('type,amount').eq('user_id', user.id).gte('transaction_date', start).lt('transaction_date', end),
    supabase.from('finances').select('type,amount').eq('user_id', user.id),
    supabase.from('conversations').select('id,role,content,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
  ])

  for (const result of [profile, tasks, shopping, inventory, finances, allFinances, activity]) assertNoDbError(result.error)

  const totals = (finances.data || []).reduce((acc, row) => {
    const amount = Number(row.amount)
    if (row.type === 'income') acc.income += amount
    else acc.expense += amount
    return acc
  }, { income: 0, expense: 0 })

  const currentBalance = (allFinances.data || []).reduce(
    (total, row) => total + (row.type === 'income' ? Number(row.amount) : -Number(row.amount)),
    0,
  )

  return c.json({
    data: {
      profile: profile.data,
      pending_tasks: tasks.data || [],
      pending_shopping: shopping.data || [],
      expiring_inventory: inventory.data || [],
      finances: { month, ...totals, balance: totals.income - totals.expense, current_balance: currentBalance },
      recent_activity: activity.data || [],
    },
  })
})
