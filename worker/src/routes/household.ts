import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireCurrentMembership } from '../lib/household'

export const householdRoutes = new Hono<AppEnv>()

householdRoutes.get('/me', async (c) => {
  const { household, member } = await requireCurrentMembership(c)

  return c.json({
    data: {
      household,
      member: {
        id: member.id,
        name: member.name,
        slug: member.slug,
        role: member.role,
        avatar: member.avatar,
      },
    },
  })
})
