import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { listHouseholdMembers } from '../lib/members'

export const membersRoutes = new Hono<AppEnv>()

membersRoutes.get('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const members = await listHouseholdMembers(supabase, user.id)
  return c.json({ data: members })
})
