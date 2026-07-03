import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { escapeSearch } from '../lib/query'
import { assertNoDbError } from '../lib/errors'
import { requireCurrentMembership } from '../lib/household'

export const searchRoutes = new Hono<AppEnv>()

searchRoutes.get('/', async (c) => {
  const query = escapeSearch(c.req.query('q') || '')
  if (!query) return c.json({ data: [] })
  const { supabase, householdId, memberId } = await requireCurrentMembership(c)

  const [tasks, shopping, inventory, finances, memories] = await Promise.all([
    supabase.from('tasks').select('id,title,description,status,created_at').eq('household_id', householdId).or(`title.ilike.%${query}%,description.ilike.%${query}%`).limit(10),
    supabase.from('shopping_items').select('id,name,category,purchased,created_at').eq('household_id', householdId).or(`name.ilike.%${query}%,category.ilike.%${query}%`).limit(10),
    supabase.from('inventory').select('id,name,category,location,created_at').eq('household_id', householdId).or(`name.ilike.%${query}%,category.ilike.%${query}%`).limit(10),
    supabase.from('finances').select('id,description,category,type,amount,created_at').eq('household_id', householdId).or(`description.ilike.%${query}%,category.ilike.%${query}%`).limit(10),
    supabase.from('memories').select('id,key,value,category,created_at').eq('household_id', householdId).or(`scope.eq.shared,and(scope.eq.personal,member_id.eq.${memberId})`).or(`key.ilike.%${query}%,value.ilike.%${query}%`).limit(10),
  ])

  for (const result of [tasks, shopping, inventory, finances, memories]) assertNoDbError(result.error)

  const data = [
    ...(tasks.data || []).map((item) => ({ type: 'task', title: item.title, subtitle: item.description || item.status, item })),
    ...(shopping.data || []).map((item) => ({ type: 'shopping', title: item.name, subtitle: item.category, item })),
    ...(inventory.data || []).map((item) => ({ type: 'inventory', title: item.name, subtitle: `${item.category} · ${item.location}`, item })),
    ...(finances.data || []).map((item) => ({ type: 'finance', title: item.description || item.category, subtitle: `${item.type} · ${item.amount}`, item })),
    ...(memories.data || []).map((item) => ({ type: 'memory', title: item.key, subtitle: item.value, item })),
  ]

  return c.json({ data })
})
