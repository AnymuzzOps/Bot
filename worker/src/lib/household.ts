import type { Context } from 'hono'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AppEnv } from '../types'
import { assertNoDbError, HttpError } from './errors'

export type CurrentHousehold = {
  id: string
  name: string
}

export type CurrentMember = {
  id: string
  household_id: string
  auth_user_id: string
  name: string
  slug: string
  role: 'owner' | 'member'
  avatar: string | null
}

export type CurrentMembership = {
  supabase: SupabaseClient
  user: User
  household: CurrentHousehold
  member: CurrentMember
  householdId: string
  memberId: string
}

export const requireCurrentMembership = async (c: Context<AppEnv>): Promise<CurrentMembership> => {
  const supabase = c.get('supabase')
  const user = c.get('user')

  const { data: memberData, error: memberError } = await supabase
    .from('household_members')
    .select('id,household_id,auth_user_id,name,slug,role,avatar')
    .eq('auth_user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  assertNoDbError(memberError)
  if (!memberData) throw new HttpError(403, 'Tu usuario aún no pertenece a un hogar compartido.')
  if (!memberData.household_id) throw new HttpError(500, 'No fue posible resolver el hogar compartido del usuario.')

  const { data: householdData, error: householdError } = await supabase
    .from('households')
    .select('id,name')
    .eq('id', memberData.household_id)
    .maybeSingle()

  assertNoDbError(householdError)
  if (!householdData?.id) throw new HttpError(500, 'No fue posible resolver el hogar compartido del usuario.')

  const household = {
    id: String(householdData.id),
    name: String(householdData.name),
  } satisfies CurrentHousehold

  const member = {
    id: String(memberData.id),
    household_id: String(memberData.household_id),
    auth_user_id: String(memberData.auth_user_id),
    name: String(memberData.name),
    slug: String(memberData.slug),
    role: memberData.role === 'owner' ? 'owner' : 'member',
    avatar: memberData.avatar ? String(memberData.avatar) : null,
  } satisfies CurrentMember

  return {
    supabase,
    user,
    household,
    member,
    householdId: household.id,
    memberId: member.id,
  }
}

export const getCurrentHousehold = async (c: Context<AppEnv>) => {
  const membership = await requireCurrentMembership(c)
  return membership.household
}

export const requireHouseholdAccess = async (
  supabase: SupabaseClient,
  userId: string,
  householdId: unknown,
) => {
  if (typeof householdId !== 'string' || !householdId.trim()) {
    throw new HttpError(400, 'El hogar no es válido.')
  }

  const { data, error } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('auth_user_id', userId)
    .maybeSingle()

  assertNoDbError(error)
  if (!data) throw new HttpError(403, 'No tienes acceso a este hogar.')
  return true
}

export const requireMemberInHousehold = async (
  supabase: SupabaseClient,
  householdId: string,
  memberId: unknown,
) => {
  if (typeof memberId !== 'string' || !memberId.trim()) {
    throw new HttpError(400, 'El integrante no es válido.')
  }

  const { data, error } = await supabase
    .from('household_members')
    .select('id,household_id,auth_user_id,name,slug,role,avatar')
    .eq('household_id', householdId)
    .eq('id', memberId)
    .maybeSingle()

  assertNoDbError(error)
  if (!data) throw new HttpError(403, 'El integrante no pertenece a este hogar.')
  return data as CurrentMember
}
