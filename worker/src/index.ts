import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { z } from 'zod'
import type { AppEnv } from './types'
import { requireAuth } from './lib/auth'
import { HttpError } from './lib/errors'
import { tasksRoutes } from './routes/tasks'
import { shoppingRoutes } from './routes/shopping'
import { inventoryRoutes } from './routes/inventory'
import { financesRoutes } from './routes/finances'
import { memoriesRoutes } from './routes/memories'
import { profileRoutes } from './routes/profile'
import { conversationsRoutes } from './routes/conversations'
import { chatRoutes } from './routes/chat'
import { dashboardRoutes } from './routes/dashboard'
import { searchRoutes } from './routes/search'
import { backupRoutes } from './routes/backup'
import { membersRoutes } from './routes/members'

const app = new Hono<AppEnv>()

app.use('*', logger())
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return cors({
    origin: (origin) => {
      if (!origin) return allowed[0] || ''
      return allowed.includes(origin) ? origin : ''
    },
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: false,
  })(c, next)
})

app.get('/', (c) => c.json({
  name: 'Asistente Personal IA API',
  status: 'ok',
  version: '1.0.0',
}))

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use('/api/*', requireAuth)
app.route('/api/members', membersRoutes)
app.route('/api/chat', chatRoutes)
app.route('/api/tasks', tasksRoutes)
app.route('/api/shopping', shoppingRoutes)
app.route('/api/inventory', inventoryRoutes)
app.route('/api/finances', financesRoutes)
app.route('/api/memories', memoriesRoutes)
app.route('/api/profile', profileRoutes)
app.route('/api/conversations', conversationsRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/search', searchRoutes)
app.route('/api', backupRoutes)

app.notFound((c) => c.json({ error: 'Ruta no encontrada.' }, 404))

app.onError((error, c) => {
  console.error('Worker request error', {
    method: c.req.method,
    pathname: new URL(c.req.url).pathname,
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })

  if (error instanceof HttpError) {
    return c.json({ error: error.message, details: error.details }, error.status as 400)
  }

  if (error instanceof z.ZodError) {
    return c.json({
      error: 'Los datos enviados no son válidos.',
      details: error.issues,
    }, 400)
  }

  return c.json({ error: 'Ocurrió un error interno.' }, 500)
})

export default app
