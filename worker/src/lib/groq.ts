import type { Bindings, GroqMessage } from '../types'
import { HttpError } from './errors'

export type GroqRequest = {
  messages: GroqMessage[]
  tools?: unknown[]
  tool_choice?: 'auto' | 'none'
  temperature?: number
  max_completion_tokens?: number
}

export type GroqResponse = {
  choices?: Array<{
    message?: GroqMessage
    finish_reason?: string
  }>
  error?: { message?: string }
}

export const createGroqCompletion = async (
  env: Bindings,
  request: GroqRequest,
): Promise<GroqResponse> => {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      ...request,
    }),
  })

  const payload = await response.json<GroqResponse>()
  if (!response.ok) {
    throw new HttpError(
      response.status,
      payload.error?.message || 'Groq no pudo procesar la solicitud.',
    )
  }

  return payload
}
