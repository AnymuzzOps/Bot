import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiData } from '../lib/api'
import type { HouseholdMember } from '../lib/types'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'household_active_member_id'

type ActiveMemberContextValue = {
  members: HouseholdMember[]
  activeMember: HouseholdMember | null
  loading: boolean
  needsSelection: boolean
  selectInitialMember: (member: HouseholdMember) => void
}

const ActiveMemberContext = createContext<ActiveMemberContextValue | null>(null)

export function ActiveMemberProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [activeMember, setActiveMember] = useState<HouseholdMember | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setMembers([])
      setActiveMember(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    apiData<HouseholdMember[]>('/api/members')
      .then((rows) => {
        if (cancelled) return
        setMembers(rows)
        const savedId = localStorage.getItem(STORAGE_KEY)
        const savedMember = rows.find((member) => member.id === savedId) || null
        setActiveMember(savedMember)
        if (!savedMember) localStorage.removeItem(STORAGE_KEY)
      })
      .catch(() => {
        if (cancelled) return
        setMembers([])
        setActiveMember(null)
        localStorage.removeItem(STORAGE_KEY)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user])

  const selectInitialMember = useCallback((member: HouseholdMember) => {
    localStorage.setItem(STORAGE_KEY, member.id)
    setActiveMember(member)
  }, [])

  const value = useMemo<ActiveMemberContextValue>(() => ({
    members,
    activeMember,
    loading,
    needsSelection: Boolean(user && !loading && members.length > 0 && !activeMember),
    selectInitialMember,
  }), [members, activeMember, loading, user, selectInitialMember])

  return <ActiveMemberContext.Provider value={value}>{children}</ActiveMemberContext.Provider>
}

export const useActiveMember = () => {
  const context = useContext(ActiveMemberContext)
  if (!context) throw new Error('useActiveMember debe usarse dentro de ActiveMemberProvider.')
  return context
}
