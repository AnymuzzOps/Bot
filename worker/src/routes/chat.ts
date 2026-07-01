import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv, GroqMessage } from '../types'
import { createGroqCompletion } from '../lib/groq'
import { HttpError, assertNoDbError } from '../lib/errors'
import { localDateISO } from '../lib/dates'
import { assistantTools, executeAssistantTool } from '../services/tools'
import { loadAssistantContext } from '../services/context'

const chatSchema = z.object({
  message: z.string().trim().min(1).max(8000),
})

export const chatRoutes = new Hono<AppEnv>()

chatRoutes.post('/', async (c) => {
  const { message } = chatSchema.parse(await c.req.json())
  const supabase = c.get('supabase')
  const user = c.get('user')

  const [context, historyResult] = await Promise.all([
    loadAssistantContext(supabase, user.id),
    supabase
      .from('conversations')
      .select('role,content')
      .eq('user_id', user.id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(16),
  ])
  assertNoDbError(historyResult.error)

  const timezone = context.profile.timezone || 'America/Santiago'
  const currency = context.profile.currency || 'CLP'
  const today = localDateISO(timezone)
  const name = context.profile.full_name || 'la persona usuaria'

  const systemPrompt = `Eres un asistente personal inteligente, confiable y breve. Responde en español natural.
Fecha local actual: ${today}. Zona horaria: ${timezone}. Moneda: ${currency}. Nombre: ${name}.

Puedes conversar y también ejecutar herramientas para administrar tareas, compras, inventario, finanzas y memoria.
Reglas:
1. Cuando el usuario dé una instrucción accionable, ejecuta la herramienta adecuada; no simules que lo hiciste.
2. Convierte expresiones como “mañana” o “el viernes” a fechas ISO usando la fecha local indicada.
3. Antes de guardar información sensible o demasiado íntima como memoria, pide confirmación. Sí puedes guardar automáticamente nombre, preferencias, objetivos, hábitos y proyectos explícitos que sean útiles y estables.
4. No inventes saldos, tareas ni datos. Consulta las herramientas cuando haga falta.
5. Si hay ambigüedad material para modificar o eliminar algo, pregunta brevemente.
6. Después de ejecutar acciones, confirma exactamente qué cambió.
7. Los montos se guardan como números sin símbolos ni separadores de miles.

Contexto actual del usuario:
${JSON.stringify(context)}`

  const history: GroqMessage[] = (historyResult.data || [])
    .reverse()
    .map((item) => ({
      role: item.role as 'user' | 'assistant',
      content: item.content,
    }))

  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ]

  const { error: userMessageError } = await supabase.from('conversations').insert({
    user_id: user.id,
    role: 'user',
    content: message,
  })
  assertNoDbError(userMessageError)

  const executed: Array<{ name: string; result: unknown }> = []
  let finalText = ''

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const completion = await createGroqCompletion(c.env, {
      messages,
      tools: assistantTools as unknown as unknown[],
      tool_choice: 'auto',
      temperature: 0.25,
      max_completion_tokens: 1400,
    })

    const assistantMessage = completion.choices?.[0]?.message
    if (!assistantMessage) throw new HttpError(502, 'Groq devolvió una respuesta vacía.')

    messages.push(assistantMessage)
    const toolCalls = assistantMessage.tool_calls || []

    if (!toolCalls.length) {
      finalText = assistantMessage.content?.trim() || 'Listo.'
      break
    }

    for (const call of toolCalls) {
      let args: Record<string, unknown>
      try {
        args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
      } catch {
        args = {}
      }

      let result: unknown
      try {
        result = await executeAssistantTool(call.function.name, args, {
          userId: user.id,
          supabase,
          timezone,
          currency,
        })
      } catch (error) {
        result = {
          error: error instanceof Error ? error.message : 'No fue posible ejecutar la acción.',
        }
      }

      executed.push({ name: call.function.name, result })
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      })
    }
  }

  if (!finalText) {
    finalText = executed.length
      ? 'Procesé la solicitud, pero no pude generar el resumen final. Revisa los cambios realizados.'
      : 'No pude completar la respuesta.'
  }

  const { data: saved, error: assistantMessageError } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      role: 'assistant',
      content: finalText,
      metadata: { tools: executed.map((item) => item.name) },
    })
    .select()
    .single()
  assertNoDbError(assistantMessageError)

  return c.json({
    data: {
      message: saved,
      executed_tools: executed.map((item) => item.name),
    },
  })
})
