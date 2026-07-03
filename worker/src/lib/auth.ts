import { createClient } from '@supabase/supabase-js'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import { HttpError } from './errors'

const logSupabaseAuthError = (stage: string, error: unknown) => {
  console.error('Supabase auth error', {
    stage,
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authorization = c.req.header('Authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null

  if (!token) {
    throw new HttpError(401, 'Debes iniciar sesión.')
  }

  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_PUBLISHABLE_KEY) {
    logSupabaseAuthError('missing-env', new Error('Missing Supabase environment bindings.'))
    throw new HttpError(500, 'No fue posible inicializar la conexión con Supabase.')
  }

  let supabase: ReturnType<typeof createClient>
  try {
    supabase = createClient(
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
  } catch (error) {
    logSupabaseAuthError('create-client', error)
    throw new HttpError(500, 'No fue posible inicializar la conexión con Supabase.')
  }

  let authResult: Awaited<ReturnType<typeof supabase.auth.getUser>>
  try {
    authResult = await supabase.auth.getUser(token)
  } catch (error) {
    logSupabaseAuthError('get-user', error)
    throw new HttpError(502, 'No fue posible conectar con Supabase Auth.')
  }

  const { data, error } = authResult
  if (error || !data.user) {
    throw new HttpError(401, 'La sesión no es válida o expiró.')
  }

  c.set('user', data.user)
  c.set('supabase', supabase)
  await next()
}
