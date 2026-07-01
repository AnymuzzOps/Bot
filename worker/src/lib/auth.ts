import { createClient } from '@supabase/supabase-js'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import { HttpError } from './errors'

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authorization = c.req.header('Authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null

  if (!token) {
    throw new HttpError(401, 'Debes iniciar sesión.')
  }

  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  )

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    throw new HttpError(401, 'La sesión no es válida o expiró.')
  }

  c.set('user', data.user)
  c.set('supabase', supabase)
  await next()
}
