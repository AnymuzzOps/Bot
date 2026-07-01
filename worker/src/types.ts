import type { SupabaseClient, User } from '@supabase/supabase-js'

export type Bindings = {
  GROQ_API_KEY: string
  GROQ_MODEL?: string
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  ALLOWED_ORIGINS?: string
}

export type Variables = {
  user: User
  supabase: SupabaseClient
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}

export type ToolExecutionContext = {
  userId: string
  supabase: SupabaseClient
  timezone: string
  currency: string
}

export type GroqToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type GroqMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  name?: string
  tool_call_id?: string
  tool_calls?: GroqToolCall[]
}
