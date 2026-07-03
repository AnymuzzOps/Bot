import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { financeCreateSchema, financeUpdateSchema } from '../lib/schemas'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject, escapeSearch, parseLimit } from '../lib/query'
import { localDateISO, monthBounds } from '../lib/dates'
import { requireCurrentMembership } from '../lib/household'

export const financesRoutes = new Hono<AppEnv>()

financesRoutes.get('/summary', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { month, start, end } = monthBounds(c.req.query('month'))

  const [monthlyResult, allTimeResult] = await Promise.all([
    supabase
      .from('finances')
      .select('type,amount,category,transaction_date')
      .eq('household_id', householdId)
      .gte('transaction_date', start)
      .lt('transaction_date', end),
    supabase
      .from('finances')
      .select('type,amount')
      .eq('household_id', householdId),
  ])
  assertNoDbError(monthlyResult.error)
  assertNoDbError(allTimeResult.error)

  const summary = (monthlyResult.data || []).reduce(
    (acc, item) => {
      const amount = Number(item.amount)
      if (item.type === 'income') acc.income += amount
      else acc.expense += amount
      acc.by_category[item.category] = (acc.by_category[item.category] || 0) + (item.type === 'expense' ? amount : 0)
      return acc
    },
    { income: 0, expense: 0, balance: 0, by_category: {} as Record<string, number> },
  )
  summary.balance = summary.income - summary.expense
  const currentBalance = (allTimeResult.data || []).reduce(
    (total, item) => total + (item.type === 'income' ? Number(item.amount) : -Number(item.amount)),
    0,
  )

  return c.json({ data: { month, ...summary, current_balance: currentBalance } })
})

financesRoutes.get('/', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const type = c.req.query('type')
  const month = c.req.query('month')
  const q = escapeSearch(c.req.query('q') || '')
  const limit = parseLimit(c.req.query('limit'))

  let query = supabase
    .from('finances')
    .select('*')
    .eq('household_id', householdId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type && ['income', 'expense'].includes(type)) query = query.eq('type', type)
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { start, end } = monthBounds(month)
    query = query.gte('transaction_date', start).lt('transaction_date', end)
  }
  if (q) query = query.or(`description.ilike.%${q}%,category.ilike.%${q}%`)

  const { data, error } = await query
  assertNoDbError(error)
  return c.json({ data })
})

financesRoutes.post('/', async (c) => {
  const body = financeCreateSchema.parse(await c.req.json())
  const { supabase, user, householdId, memberId } = await requireCurrentMembership(c)
  const { data: profile } = await supabase.from('users').select('timezone').eq('id', user.id).maybeSingle()
  const { data, error } = await supabase
    .from('finances')
    .insert({
      ...finance,
      transaction_date: body.transaction_date || localDateISO(profile?.timezone || 'America/Santiago'),
      household_id: householdId,
      user_id: user.id,
      created_by_member_id: memberId,
    })
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data }, 201)
})

financesRoutes.patch('/:id', async (c) => {
  const body = cleanObject(financeUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { data, error } = await supabase
    .from('finances')
    .update({ ...finance, ...(createdByMemberId ? { created_by_member_id: createdByMemberId } : {}) })
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data })
})

financesRoutes.delete('/:id', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { error } = await supabase
    .from('finances')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
  assertNoDbError(error)
  return c.body(null, 204)
})
