import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv, GroqMessage } from '../types'
import { createGroqCompletion } from '../lib/groq'
import { HttpError, assertNoDbError } from '../lib/errors'
import { DEFAULT_TIMEZONE, localDateISO, localTime } from '../lib/dates'
import { assistantTools, executeAssistantTool } from '../services/tools'
import { loadAssistantContext } from '../services/context'
import { requireCurrentMembership } from '../lib/household'
import { buildToolExecutionSummary, type ExecutedTool } from '../lib/toolSummary'

const chatSchema = z.object({
  message: z.string().trim().min(1).max(8000),
})

export const chatRoutes = new Hono<AppEnv>()

chatRoutes.post('/', async (c) => {
  const { message } = chatSchema.parse(await c.req.json())
  const { supabase, user, household, householdId, member, memberId } = await requireCurrentMembership(c)

  const [context, historyResult] = await Promise.all([
    loadAssistantContext(supabase, user.id, householdId, memberId),
    supabase
      .from('conversations')
      .select('role,content')
      .eq('household_id', householdId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(16),
  ])
  assertNoDbError(historyResult.error)

  const timezone = DEFAULT_TIMEZONE
  const currency = context.profile.currency || 'CLP'
  const today = localDateISO(timezone)
  const time = localTime(timezone)
  const name = context.profile.full_name || 'la persona usuaria'

  const systemPrompt = `Eres un asistente personal inteligente, confiable y breve. Responde en español natural.
Fecha local actual en Chile: ${today}. Hora local actual en Chile: ${time}. Zona horaria: ${timezone}. Moneda: ${currency}. Cuenta autenticada: ${name}. Hogar compartido: ${household.name}. Persona autenticada: ${member.name}.

Puedes conversar y también ejecutar herramientas para administrar tareas, compras, inventario, finanzas y memoria. Los datos operativos son compartidos por los integrantes del hogar. Las memorias shared son del hogar; las memorias personal pertenecen solo a la persona autenticada y nunca debes revelar memorias personales de otra persona.
Reglas:
1. Cuando el usuario dé una instrucción accionable, ejecuta la herramienta adecuada; no simules que lo hiciste.
2. Convierte expresiones como “mañana” o “el viernes” a fechas ISO usando la fecha local indicada.
3. Antes de guardar información sensible o demasiado íntima como memoria, pide confirmación. Sí puedes guardar automáticamente nombre, preferencias, objetivos, hábitos y proyectos explícitos que sean útiles y estables.
4. No inventes saldos, tareas ni datos. Consulta las herramientas cuando haga falta.
5. Si hay ambigüedad material para modificar o eliminar algo, pregunta brevemente.
6. Después de ejecutar acciones, confirma exactamente qué cambió.
7. Los montos se guardan como números sin símbolos ni separadores de miles.
8. La única instrucción activa es el último mensaje del usuario. No vuelvas a ejecutar órdenes antiguas del historial salvo que el usuario lo pida explícitamente.
9. Si el usuario enumera varios elementos o acciones, procesa la lista completa, no solo los primeros. Puedes emitir múltiples tool calls en una respuesta.
10. Si no puedes completar toda una lista, indica exactamente qué elementos faltaron y por qué.
11. Después de usar herramientas, entrega un resumen concreto que detalle cada cambio. Nunca digas solamente que “procesaste la solicitud”.

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
    household_id: householdId,
    user_id: user.id,
    role: 'user',
    content: message,
    created_by_member_id: memberId,
  })
  assertNoDbError(userMessageError)

  const executed: ExecutedTool[] = []
  const executedSignatures = new Set<string>()
  let finalText = ''
  let usedDeterministicSummary = false

  for (let iteration = 0; iteration < 10; iteration += 1) {
    let completion: Awaited<ReturnType<typeof createGroqCompletion>>
    try {
      completion = await createGroqCompletion(c.env, {
        messages,
        tools: assistantTools as unknown as unknown[],
        tool_choice: 'auto',
        temperature: 0.25,
        max_completion_tokens: 2400,
      })
    } catch (error) {
      if (!executed.length) throw error
      console.warn('Assistant final completion failed after tools', { iteration: iteration + 1, toolCount: executed.length })
      break
    }

    const assistantMessage = completion.choices?.[0]?.message
    if (!assistantMessage) {
      if (executed.length) break
      throw new HttpError(502, 'Groq devolvió una respuesta vacía.')
    }

    messages.push(assistantMessage)
    const toolCalls = assistantMessage.tool_calls || []
    console.log('Assistant tool iteration', { iteration: iteration + 1, toolCallCount: toolCalls.length, toolNames: toolCalls.map((call) => call.function.name) })

    if (!toolCalls.length) {
      finalText = assistantMessage.content?.trim() || buildToolExecutionSummary(executed)
      usedDeterministicSummary = !assistantMessage.content?.trim()
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
      const signature = `${call.function.name}:${JSON.stringify(args, Object.keys(args).sort())}`
      let duplicate = executedSignatures.has(signature)
      try {
        result = duplicate ? { skipped: true, reason: 'duplicate_tool_call' } : await executeAssistantTool(call.function.name, args, {
          userId: user.id,
          householdId,
          householdName: household.name,
          memberId,
          memberName: member.name,
          supabase,
          timezone,
          currency,
        })
      } catch (error) {
        result = {
          error: error instanceof Error ? error.message : 'No fue posible ejecutar la acción.',
        }
      }

      executedSignatures.add(signature)
      duplicate = duplicate || Boolean(result && typeof result === 'object' && '_tool_status' in result && result._tool_status === 'already_exists')
      const ok = !(result && typeof result === 'object' && 'error' in result)
      executed.push({ name: call.function.name, args, result, ok, duplicate })
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      })
    }
  }

  if (!finalText) {
    finalText = buildToolExecutionSummary(executed)
    usedDeterministicSummary = true
  }
  console.log('Assistant request completed', { toolCount: executed.length, successfulToolCount: executed.filter((tool) => tool.ok).length, usedDeterministicSummary })

  const { data: saved, error: assistantMessageError } = await supabase
    .from('conversations')
    .insert({
      household_id: householdId,
      user_id: user.id,
      role: 'assistant',
      content: finalText,
      created_by_member_id: memberId,
      metadata: { tools: executed.map((item) => item.name) },
    })
    .select()
    .single()
  assertNoDbError(assistantMessageError)

  return c.json({
    data: {
      message: { ...saved, created_by_member: member },
      executed_tools: executed.map((item) => item.name),
    },
  })
})
