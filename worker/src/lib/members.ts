import type { SupabaseClient } from '@supabase/supabase-js'
import { assertNoDbError, HttpError } from './errors'

export type HouseholdMember = {
  id: string
  user_id: string
  name: string
  slug: 'benjamin' | 'javiera'
  avatar: string | null
  created_at: string
}

const memberOrder = { benjamin: 0, javiera: 1 } as const

export const sortHouseholdMembers = (members: HouseholdMember[]) =>
  [...members].sort((left, right) => {
    const order = memberOrder[left.slug] - memberOrder[right.slug]
    return order || left.name.localeCompare(right.name, 'es')
  })

export const listHouseholdMembers = async (
  supabase: SupabaseClient,
  userId: string,
) => {
  const { data, error } = await supabase
    .from('household_members')
    .select('id,user_id,name,slug,avatar,created_at')
    .eq('user_id', userId)
    .in('slug', ['benjamin', 'javiera'])

  assertNoDbError(error)
  return sortHouseholdMembers((data || []) as HouseholdMember[])
}

export const requireHouseholdMember = async (
  supabase: SupabaseClient,
  userId: string,
  memberId: unknown,
) => {
  if (typeof memberId !== 'string' || !memberId.trim()) {
    throw new HttpError(400, 'Debes seleccionar quién está usando el asistente.')
  }

  const { data, error } = await supabase
    .from('household_members')
    .select('id,user_id,name,slug,avatar,created_at')
    .eq('user_id', userId)
    .eq('id', memberId)
    .maybeSingle()

  assertNoDbError(error)
  if (!data) throw new HttpError(403, 'El perfil seleccionado no pertenece a esta cuenta.')
  return data as HouseholdMember
}
