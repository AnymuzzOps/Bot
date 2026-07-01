import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../types'
import { assertNoDbError, HttpError } from '../lib/errors'

const importSchema = z.object({
  mode: z.enum(['merge', 'replace']).default('merge'),
  data: z.object({
    profile: z.record(z.string(), z.unknown()).optional().nullable(),
    memories: z.array(z.record(z.string(), z.unknown())).default([]),
    conversations: z.array(z.record(z.string(), z.unknown())).default([]),
    tasks: z.array(z.record(z.string(), z.unknown())).default([]),
    shopping_items: z.array(z.record(z.string(), z.unknown())).default([]),
    inventory: z.array(z.record(z.string(), z.unknown())).default([]),
    finances: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
})

const sanitizeRows = (rows: Record<string, unknown>[], userId: string) =>
  rows.map(({ id: _id, user_id: _userId, created_at: _created, updated_at: _updated, ...rest }) => ({
    ...rest,
    user_id: userId,
  }))

export const backupRoutes = new Hono<AppEnv>()

backupRoutes.get('/export', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const [profile, memories, conversations, tasks, shopping, inventory, finances] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('memories').select('*').eq('user_id', user.id),
    supabase.from('conversations').select('*').eq('user_id', user.id),
    supabase.from('tasks').select('*').eq('user_id', user.id),
    supabase.from('shopping_items').select('*').eq('user_id', user.id),
    supabase.from('inventory').select('*').eq('user_id', user.id),
    supabase.from('finances').select('*').eq('user_id', user.id),
  ])
  for (const result of [profile, memories, conversations, tasks, shopping, inventory, finances]) assertNoDbError(result.error)

  return c.json({
    version: 1,
    exported_at: new Date().toISOString(),
    data: {
      profile: profile.data,
      memories: memories.data || [],
      conversations: conversations.data || [],
      tasks: tasks.data || [],
      shopping_items: shopping.data || [],
      inventory: inventory.data || [],
      finances: finances.data || [],
    },
  })
})

backupRoutes.post('/import', async (c) => {
  const parsed = importSchema.parse(await c.req.json())
  const supabase = c.get('supabase')
  const user = c.get('user')
  const tables = ['conversations', 'tasks', 'shopping_items', 'inventory', 'finances', 'memories'] as const

  if (parsed.mode === 'replace') {
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('user_id', user.id)
      assertNoDbError(error)
    }
  }

  const mapping: Array<[typeof tables[number], Record<string, unknown>[]]> = [
    ['memories', parsed.data.memories],
    ['conversations', parsed.data.conversations],
    ['tasks', parsed.data.tasks],
    ['shopping_items', parsed.data.shopping_items],
    ['inventory', parsed.data.inventory],
    ['finances', parsed.data.finances],
  ]

  const imported: Record<string, number> = {}
  for (const [table, rows] of mapping) {
    const sanitized = sanitizeRows(rows, user.id)
    if (!sanitized.length) {
      imported[table] = 0
      continue
    }
    const { error } = await supabase.from(table).insert(sanitized)
    if (error) throw new HttpError(400, `No se pudo importar ${table}: ${error.message}`)
    imported[table] = sanitized.length
  }

  if (parsed.data.profile) {
    const { id: _id, email: _email, created_at: _created, updated_at: _updated, ...profile } = parsed.data.profile
    const { error } = await supabase.from('users').update(profile).eq('id', user.id)
    assertNoDbError(error)
  }

  return c.json({ data: { imported, mode: parsed.mode } })
})
